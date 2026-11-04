#!/usr/bin/env python3
"""
podcast-transcript: transcribe a podcast episode with AssemblyAI.

Writes four files into the episode folder:
- transcript-raw.txt    : plain text
- transcript-clean.md   : speaker-labelled, timestamped, with frontmatter
- chapters.md           : section list, formatted for YouTube descriptions
- transcript-words.json : word-level timings in milliseconds (used to cut shorts)

Usage:
    python transcribe.py \\
        --input-file /path/to/episode-audio.m4a \\   # or --url "https://youtu.be/..."
        --output-dir "/path/to/Episode N - Guest Name" \\
        --guest-name "Guest Name" \\
        [--episode N] [--host-name "Host Name"] [--model universal-2] \\
        [--cost-cap-usd 1.5] [--force] [--dry-run] [--config path] [--env-file path]

--dry-run checks settings, key and cost, then stops before any network call
that would bill you.
"""

import argparse
import json
import os
import subprocess
import sys
import tempfile
import time
from datetime import datetime
from pathlib import Path
from typing import Optional

import requests
from dotenv import load_dotenv

ASSEMBLY_API_BASE = "https://api.assemblyai.com/v2"
DEFAULT_CONFIG = "~/.config/podcast-skills/config.json"
OUTPUT_FILES = ("transcript-raw.txt", "transcript-clean.md", "chapters.md", "transcript-words.json")

# Prefer the yt-dlp in this venv. Fall back to PATH.
_VENV_YTDLP = Path(sys.executable).parent / "yt-dlp"
YTDLP = str(_VENV_YTDLP) if _VENV_YTDLP.exists() else "yt-dlp"


def load_config(path: Optional[str] = None) -> dict:
    p = Path(path or os.environ.get("PODCAST_CONFIG") or DEFAULT_CONFIG).expanduser()
    if not p.exists():
        sys.exit(f"ERROR: settings file not found: {p}\nCopy podcast/config.example.json there and fill it in, or pass --config.")
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        sys.exit(f"ERROR: {p} is not valid JSON: {e}")


def find_env_file(output_dir: Path, config: dict) -> Optional[Path]:
    """Settings file path first, then a .env beside the episode or in its parent."""
    configured = (config.get("paths") or {}).get("env_file")
    candidates = [Path(configured).expanduser()] if configured else []
    candidates += [output_dir / ".env", output_dir.parent / ".env"]
    return next((c for c in candidates if c.exists()), None)


def probe_duration(path: Path) -> int:
    """Seconds, or 0 if ffprobe is missing or cannot read the file."""
    try:
        out = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(path)],
            capture_output=True, text=True, check=True,
        ).stdout
        return int(float(out.strip()))
    except (OSError, ValueError, subprocess.CalledProcessError):
        return 0


def get_video_info(url: str) -> dict:
    """Fetch video metadata with yt-dlp (no download)."""
    cmd = [YTDLP, "--no-playlist", "--skip-download", "--dump-single-json", url]
    result = subprocess.run(cmd, capture_output=True, text=True, check=True)
    return json.loads(result.stdout)


def download_audio(url: str, dest_dir: Path) -> Path:
    """Download audio with yt-dlp into dest_dir. Returns the file path."""
    output_template = str(dest_dir / "podcast-%(id)s.%(ext)s")
    # Fallback chain: audio-only m4a, any audio-only, best mp4, best. The mp4 fallback
    # covers unlisted videos where YouTube only exposes merged formats. AssemblyAI pulls
    # the audio out of a video file on its side.
    cmd = [
        YTDLP,
        "-f", "bestaudio[ext=m4a]/bestaudio/best[ext=mp4]/best",
        "--no-playlist",
        "-o", output_template,
        "--print", "after_move:filepath",
        url,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, check=True)
    lines = [line for line in result.stdout.split("\n") if line.strip()]
    if not lines:
        raise RuntimeError(f"yt-dlp did not report a downloaded file. stderr:\n{result.stderr}")
    return Path(lines[-1])


def _raise_with_body(response: requests.Response, context: str) -> None:
    if response.ok:
        return
    try:
        body = response.json()
    except ValueError:
        body = response.text
    raise RuntimeError(f"AssemblyAI {context} failed: HTTP {response.status_code}\nResponse: {body}")


def upload_audio(api_key: str, audio_path: Path) -> str:
    """Upload a local file to AssemblyAI. Returns the upload_url."""
    with audio_path.open("rb") as f:
        response = requests.post(f"{ASSEMBLY_API_BASE}/upload", headers={"authorization": api_key}, data=f)
    _raise_with_body(response, "upload")
    return response.json()["upload_url"]


def transcript_request_body(audio_url: str, model: str, language_code: str) -> dict:
    # AssemblyAI deprecated auto_chapters. Summarization under speech_understanding
    # is its documented replacement and returns the same kind of timed sections.
    return {
        "audio_url": audio_url,
        "speech_models": [model],
        "speaker_labels": True,
        "language_code": language_code,
        "speech_understanding": {"request": {"summarization": {"summary_type": "paragraph"}}},
    }


def request_transcript(api_key: str, audio_url: str, model: str, language_code: str) -> str:
    response = requests.post(
        f"{ASSEMBLY_API_BASE}/transcript",
        headers={"authorization": api_key, "content-type": "application/json"},
        json=transcript_request_body(audio_url, model, language_code),
        timeout=60,
    )
    _raise_with_body(response, "transcript request")
    return response.json()["id"]


def poll_transcript(api_key: str, transcript_id: str, poll_interval: int = 5) -> dict:
    """Poll until completed or errored. Returns the full transcript JSON."""
    url = f"{ASSEMBLY_API_BASE}/transcript/{transcript_id}"
    last_status = None
    while True:
        response = requests.get(url, headers={"authorization": api_key}, timeout=60)
        _raise_with_body(response, "transcript poll")
        data = response.json()
        status = data.get("status")
        if status == "completed":
            return data
        if status == "error":
            raise RuntimeError(f"AssemblyAI transcript error: {data.get('error')}")
        if status != last_status:
            print(f"  status: {status}", flush=True)
            last_status = status
        time.sleep(poll_interval)


def format_timestamp(ms: int) -> str:
    """Milliseconds to MM:SS or HH:MM:SS."""
    total_seconds = int(ms) // 1000
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    seconds = total_seconds % 60
    if hours:
        return f"{hours:02d}:{minutes:02d}:{seconds:02d}"
    return f"{minutes:02d}:{seconds:02d}"


def build_speaker_map(utterances: list, host_name: str, guest_name: str) -> dict:
    """First voice heard is the host, second is the guest, the rest get numbered."""
    unique = list(dict.fromkeys(u["speaker"] for u in utterances))
    if not unique:
        return {}
    mapping = {unique[0]: host_name}
    if len(unique) >= 2:
        mapping[unique[1]] = guest_name
    for i, label in enumerate(unique[2:], start=2):
        mapping[label] = f"Guest {i}"
    return mapping


def get_sections(transcript: dict) -> list:
    """Timed sections from the summarization response: start, end, headline, text."""
    understanding = transcript.get("speech_understanding") or {}
    summary = ((understanding.get("response") or {}).get("summarization") or {}).get("summary")
    return summary if isinstance(summary, list) else []


def write_raw(transcript: dict, output_dir: Path) -> Path:
    path = output_dir / "transcript-raw.txt"
    path.write_text(transcript.get("text") or "", encoding="utf-8")
    return path


def write_words(transcript: dict, output_dir: Path) -> Path:
    path = output_dir / "transcript-words.json"
    words = [{"text": w.get("text"), "start": w.get("start"), "end": w.get("end"), "speaker": w.get("speaker")}
             for w in transcript.get("words") or []]
    path.write_text(json.dumps(words), encoding="utf-8")
    return path


def write_clean(transcript, speaker_map, output_dir, episode_num, guest_name, host_name, show_slug) -> Path:
    utterances = transcript.get("utterances") or []
    duration_s = int(transcript.get("audio_duration") or 0)
    word_count = len((transcript.get("text") or "").split())
    speakers = list(dict.fromkeys(speaker_map.values()))
    title = f"Episode {episode_num} - {guest_name} - Transcript" if episode_num else f"{guest_name} - Transcript"

    fm = [
        "---",
        f"title: {title}",
        f"date: {datetime.now().strftime('%Y-%m-%d')}",
        f"tags: [podcast, transcript, {show_slug}]",
        "status: complete",
    ]
    if episode_num:
        fm.append(f"episode: {episode_num}")
    fm.extend([
        f"guest: {guest_name}",
        f"host: {host_name}",
        f"duration_seconds: {duration_s}",
        f"word_count: {word_count}",
        f"speakers: {json.dumps(speakers, ensure_ascii=False)}",
        "---",
        "",
    ])

    body = []
    for u in utterances:
        ts = format_timestamp(u.get("start", 0))
        speaker = speaker_map.get(u.get("speaker"), u.get("speaker", "?"))
        body.append(f"[{ts}] **{speaker}:** {(u.get('text') or '').strip()}")
        body.append("")

    path = output_dir / "transcript-clean.md"
    path.write_text("\n".join(fm) + "\n" + "\n".join(body), encoding="utf-8")
    return path


def write_chapters(transcript, output_dir, episode_num, guest_name) -> Path:
    sections = get_sections(transcript)
    title = f"Episode {episode_num} - Chapters" if episode_num else f"{guest_name} - Chapters"
    lines = [f"# {title}", ""]

    if not sections:
        lines.append("(AssemblyAI returned no sections for this audio. Write the chapters by hand from the transcript.)")
    else:
        lines += ["## YouTube timestamps", "", "```"]
        for s in sections:
            lines.append(f"{format_timestamp(s.get('start', 0))} {(s.get('headline') or '').strip()}")
        lines += ["```", "", "## Chapter summaries", ""]
        for s in sections:
            lines.append(f"### {format_timestamp(s.get('start', 0))} - {(s.get('headline') or '').strip()}")
            text = (s.get("text") or "").strip()
            if text:
                lines.append(text)
            lines.append("")

    path = output_dir / "chapters.md"
    path.write_text("\n".join(lines), encoding="utf-8")
    return path


def main():
    parser = argparse.ArgumentParser(description="Transcribe a podcast episode with AssemblyAI.")
    parser.add_argument("--url", help="YouTube URL of the episode.")
    parser.add_argument("--input-file", help="Local audio or video file (alternative to --url).")
    parser.add_argument("--output-dir", required=True, help="Episode folder where outputs land.")
    parser.add_argument("--guest-name", required=True)
    parser.add_argument("--host-name", help="Defaults to show.host in the settings file.")
    parser.add_argument("--episode", type=int, help="Episode number for frontmatter.")
    parser.add_argument("--force", action="store_true", help="Overwrite existing output files.")
    parser.add_argument("--cost-cap-usd", type=float, help="Abort if the estimate exceeds this.")
    parser.add_argument("--config", help="Settings file path.")
    parser.add_argument("--env-file", help="Env file holding ASSEMBLYAI_API_KEY.")
    parser.add_argument("--model", choices=["universal-2", "universal-3-5-pro"],
                        help="AssemblyAI speech model. universal-2 is cheaper; universal-3-5-pro is the newer model.")
    parser.add_argument("--dry-run", action="store_true", help="Check everything, then stop before uploading or billing.")
    args = parser.parse_args()

    if not args.url and not args.input_file:
        parser.error("One of --url or --input-file is required.")

    config = load_config(args.config)
    show = config.get("show") or {}
    settings = config.get("transcription") or {}
    host_name = args.host_name or show.get("host")
    if not host_name:
        sys.exit("ERROR: no host name. Set show.host in the settings file or pass --host-name.")
    model = args.model or settings.get("model", "universal-2")
    language_code = settings.get("language_code", "en")
    cost_per_hour = float(settings.get("cost_per_hour_usd", 0.20))
    cost_cap = args.cost_cap_usd if args.cost_cap_usd is not None else float(settings.get("cost_cap_usd", 1.50))

    output_dir = Path(args.output_dir).expanduser().resolve()
    if not output_dir.exists():
        sys.exit(f"ERROR: output dir does not exist: {output_dir}")

    if not args.force:
        for name in OUTPUT_FILES:
            if (output_dir / name).exists():
                sys.exit(f"ERROR: {name} already exists. Use --force to overwrite.")

    env_path = Path(args.env_file).expanduser().resolve() if args.env_file else find_env_file(output_dir, config)
    if args.env_file and not env_path.exists():
        sys.exit(f"ERROR: --env-file does not exist: {env_path}")
    if env_path:
        load_dotenv(env_path)
        print(f"Loaded env from: {env_path}", flush=True)

    api_key = os.environ.get("ASSEMBLYAI_API_KEY")
    if not api_key and not args.dry_run:
        sys.exit("ERROR: ASSEMBLYAI_API_KEY not found.\nSet it in the environment, in paths.env_file, or pass --env-file <path>.")

    local_path = None
    if args.url:
        print("Fetching video info from yt-dlp...", flush=True)
        try:
            info = get_video_info(args.url)
        except (OSError, subprocess.CalledProcessError) as e:
            sys.exit(f"ERROR: yt-dlp failed.\n{getattr(e, 'stderr', e)}")
        duration_s = int(info.get("duration") or 0)
        print(f"Title: {info.get('title', '(unknown)')}", flush=True)
    else:
        local_path = Path(args.input_file).expanduser().resolve()
        if not local_path.exists():
            sys.exit(f"ERROR: --input-file does not exist: {local_path}")
        duration_s = probe_duration(local_path)
        print(f"Local file: {local_path.name}", flush=True)

    estimated = (duration_s / 3600) * cost_per_hour
    if duration_s:
        print(f"Duration: {duration_s // 60}m {duration_s % 60}s", flush=True)
    else:
        print("WARNING: could not read the duration, so the cost cap cannot protect this run.", flush=True)
    print(f"Estimated cost: USD {estimated:.3f} at USD {cost_per_hour:.2f}/hr", flush=True)

    if estimated > cost_cap:
        sys.exit(f"ERROR: estimated cost USD {estimated:.2f} exceeds cap USD {cost_cap:.2f}. Use --cost-cap-usd to override.")

    if args.dry_run:
        print(f"Dry run OK. Model: {model}. API key {'found' if api_key else 'MISSING'}. Would write to {output_dir}:", flush=True)
        for name in OUTPUT_FILES:
            print(f"  {name}", flush=True)
        return

    if args.url:
        with tempfile.TemporaryDirectory(prefix="podcast-transcript-") as tmp:
            print("Downloading audio with yt-dlp...", flush=True)
            try:
                audio_path = download_audio(args.url, Path(tmp))
            except subprocess.CalledProcessError as e:
                sys.exit(f"ERROR: yt-dlp download failed.\nstderr:\n{e.stderr}")
            print(f"Downloaded: {audio_path.name} ({audio_path.stat().st_size / 1_048_576:.1f} MB)", flush=True)
            print("Uploading to AssemblyAI...", flush=True)
            upload_url = upload_audio(api_key, audio_path)
    else:
        print("Uploading local file to AssemblyAI...", flush=True)
        upload_url = upload_audio(api_key, local_path)

    print(f"Submitting transcription request (model: {model})...", flush=True)
    transcript_id = request_transcript(api_key, upload_url, model, language_code)
    print(f"Transcript ID: {transcript_id}", flush=True)
    print("Polling for completion...", flush=True)
    transcript = poll_transcript(api_key, transcript_id)

    speaker_map = build_speaker_map(transcript.get("utterances") or [], host_name, args.guest_name)
    print(f"Speaker map: {speaker_map}", flush=True)
    if len(speaker_map) > 2:
        print(f"WARNING: detected {len(speaker_map)} speakers. Review the labels in transcript-clean.md.", flush=True)

    raw_path = write_raw(transcript, output_dir)
    clean_path = write_clean(transcript, speaker_map, output_dir, args.episode, args.guest_name, host_name,
                             show.get("slug", "podcast"))
    chapters_path = write_chapters(transcript, output_dir, args.episode, args.guest_name)
    words_path = write_words(transcript, output_dir)

    final_duration = int(transcript.get("audio_duration") or duration_s)
    print("", flush=True)
    print("Done.", flush=True)
    for label, path in (("Raw", raw_path), ("Clean", clean_path), ("Chapters", chapters_path), ("Words", words_path)):
        print(f"  {label + ':':10}{path}", flush=True)
    print("", flush=True)
    print(f"Duration:    {final_duration}s ({final_duration // 60}m {final_duration % 60}s)", flush=True)
    print(f"Word count:  {len((transcript.get('text') or '').split())}", flush=True)
    print(f"Speakers:    {len(speaker_map)}", flush=True)
    print(f"Chapters:    {len(get_sections(transcript))}", flush=True)
    print(f"Cost:        USD {(final_duration / 3600) * cost_per_hour:.3f} (estimate)", flush=True)


if __name__ == "__main__":
    main()
