#!/usr/bin/env python3
"""
youtube-upload.py: upload one video through the YouTube Data API.

Usage:
    youtube-upload.py --video /path/to/clip.mp4 --title "..." --description "..." \\
        --tags "coffee,podcast" --credentials /path/to/client-secret.json \\
        --token-store /path/to/token.json [--privacy unlisted] [--publish-at ISO_TIME] \\
        [--category 22] [--full-episode]

First run opens a browser for OAuth consent, and the token is saved to --token-store.

Writes a JSON object to stdout: video_id, url, title, privacy, publish_at, channel,
channel_id, uploaded_at. Everything else goes to stderr, so callers can capture stdout.
"""

import argparse
import json
import sys
from pathlib import Path

from youtube_auth import get_credentials

from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaFileUpload

SCOPES = ["https://www.googleapis.com/auth/youtube.upload"]
CATEGORY_PEOPLE_AND_BLOGS = "22"


def upload_video(creds, video_path, title, description, tags, privacy, category, publish_at=None):
    youtube = build("youtube", "v3", credentials=creds)

    video_status = {
        "privacyStatus": privacy,
        "selfDeclaredMadeForKids": False,
        "embeddable": True,
    }
    if publish_at:
        # YouTube requires private until publishAt, when it flips to public by itself.
        video_status["privacyStatus"] = "private"
        video_status["publishAt"] = publish_at

    body = {
        "snippet": {
            "title": title[:100],
            "description": description[:5000],
            "tags": tags,
            "categoryId": category,
        },
        "status": video_status,
    }

    media = MediaFileUpload(str(video_path), chunksize=-1, resumable=True, mimetype="video/mp4")
    insert = youtube.videos().insert(part="snippet,status", body=body, media_body=media)

    response = None
    last_progress = 0
    while response is None:
        try:
            progress_status, response = insert.next_chunk()
            if progress_status:
                progress = int(progress_status.progress() * 100)
                if progress >= last_progress + 10:
                    print(f"  upload progress: {progress}%", file=sys.stderr)
                    last_progress = progress
        except HttpError as e:
            if e.resp.status in (500, 502, 503, 504):
                print(f"  retryable HTTP {e.resp.status}, retrying...", file=sys.stderr)
                continue
            raise
    return response


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--video", required=True, help="Path to MP4")
    p.add_argument("--title", required=True)
    p.add_argument("--description", required=True)
    p.add_argument("--tags", default="", help="Comma-separated tags")
    p.add_argument("--credentials", required=True, help="Path to the Google OAuth client JSON")
    p.add_argument("--token-store", required=True, help="Path to the saved token (created on first run)")
    p.add_argument("--privacy", default="unlisted", choices=["public", "unlisted", "private"])
    p.add_argument("--publish-at", default=None, help="ISO 8601 UTC time to schedule release (forces private until then)")
    p.add_argument("--category", default=CATEGORY_PEOPLE_AND_BLOGS, help="YouTube category ID")
    p.add_argument("--full-episode", action="store_true", help="Report a watch URL instead of a Shorts URL")
    args = p.parse_args()

    video_path = Path(args.video).expanduser()
    if not video_path.exists():
        sys.exit(f"Video not found: {video_path}")

    token_path = Path(args.token_store).expanduser()
    print(f"Authenticating ({token_path.name})...", file=sys.stderr)
    creds = get_credentials(Path(args.credentials).expanduser(), token_path, SCOPES)

    tags = [t.strip() for t in args.tags.split(",") if t.strip()]
    print(f"Uploading: {video_path.name}", file=sys.stderr)
    print(f"  Title:   {args.title}", file=sys.stderr)
    print(f"  Tags:    {len(tags)} tags", file=sys.stderr)
    print(f"  Privacy: {args.privacy}", file=sys.stderr)

    response = upload_video(creds, video_path, args.title, args.description, tags, args.privacy, args.category, args.publish_at)
    video_id = response["id"]
    url = f"https://www.youtube.com/watch?v={video_id}" if args.full_episode else f"https://www.youtube.com/shorts/{video_id}"

    print(json.dumps({
        "video_id": video_id,
        "url": url,
        "title": response["snippet"]["title"],
        "privacy": response["status"]["privacyStatus"],
        "publish_at": response["status"].get("publishAt"),
        "channel": response["snippet"].get("channelTitle", ""),
        "channel_id": response["snippet"].get("channelId", ""),
        "uploaded_at": response["snippet"]["publishedAt"],
    }, indent=2))


if __name__ == "__main__":
    main()
