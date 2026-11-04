#!/usr/bin/env python3
"""
youtube-manage.py: manage already-uploaded videos (unschedule, schedule, privacy).

Needs the broader youtube.force-ssl scope, because upload-only tokens cannot call
videos.update. It keeps its own token file and asks for its own consent on first run.
Pick the same channel as the uploads.

Usage:
    youtube-manage.py --credentials client.json --token-store manage-token.json unschedule VIDEO_ID [VIDEO_ID ...]
    youtube-manage.py --credentials client.json --token-store manage-token.json schedule VIDEO_ID ISO_TIME
    youtube-manage.py --credentials client.json --token-store manage-token.json privacy VIDEO_ID public|unlisted|private
"""

import argparse
import json
from pathlib import Path

from googleapiclient.discovery import build

from youtube_auth import get_credentials

SCOPES = ["https://www.googleapis.com/auth/youtube.force-ssl"]


def set_status(yt, video_id, privacy, publish_at=None):
    # Always send embeddable: a status update that omits it resets the video to
    # not-embeddable, which breaks site embeds with no warning.
    # Setting private does not clear a pending publishAt. unschedule() handles that.
    status = {
        "privacyStatus": privacy,
        "selfDeclaredMadeForKids": False,
        "embeddable": True,
        "publicStatsViewable": True,
    }
    if publish_at:
        status["privacyStatus"] = "private"
        status["publishAt"] = publish_at
    resp = yt.videos().update(part="status", body={"id": video_id, "status": status}).execute()
    return {
        "video_id": video_id,
        "privacy": resp["status"]["privacyStatus"],
        "publish_at": resp["status"].get("publishAt"),
    }


def unschedule(yt, video_id):
    # publishAt cannot be nulled directly. Bouncing through unlisted clears it.
    set_status(yt, video_id, "unlisted")
    return set_status(yt, video_id, "private")


def main():
    p = argparse.ArgumentParser(description="Manage already-uploaded YouTube videos.")
    p.add_argument("--credentials", required=True)
    p.add_argument("--token-store", required=True)
    sub = p.add_subparsers(dest="cmd", required=True)
    u = sub.add_parser("unschedule"); u.add_argument("video_ids", nargs="+")
    s = sub.add_parser("schedule"); s.add_argument("video_id"); s.add_argument("iso_time")
    v = sub.add_parser("privacy"); v.add_argument("video_id"); v.add_argument("value", choices=["public", "unlisted", "private"])
    args = p.parse_args()

    creds = get_credentials(Path(args.credentials).expanduser(), Path(args.token_store).expanduser(), SCOPES)
    yt = build("youtube", "v3", credentials=creds)

    results = []
    if args.cmd == "unschedule":
        results = [unschedule(yt, vid) for vid in args.video_ids]
    elif args.cmd == "schedule":
        results.append(set_status(yt, args.video_id, "private", publish_at=args.iso_time))
    elif args.cmd == "privacy":
        results.append(set_status(yt, args.video_id, args.value))
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
