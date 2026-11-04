#!/usr/bin/env python3
"""Set a custom thumbnail on an uploaded video. Needs the youtube.force-ssl scope, so it
shares youtube-manage.py's token file, not the upload token.

  youtube-thumbnail.py --credentials client.json --token-store manage-token.json VIDEO_ID thumbnail.png
"""
import argparse
import mimetypes
from pathlib import Path

from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

from youtube_auth import get_credentials

SCOPES = ["https://www.googleapis.com/auth/youtube.force-ssl"]

p = argparse.ArgumentParser(description="Set a custom thumbnail on an uploaded video.")
p.add_argument("--credentials", required=True)
p.add_argument("--token-store", required=True)
p.add_argument("video_id")
p.add_argument("image")
a = p.parse_args()

if not Path(a.image).expanduser().exists():
    raise SystemExit(f"Image not found: {a.image}")
creds = get_credentials(Path(a.credentials).expanduser(), Path(a.token_store).expanduser(), SCOPES)
yt = build("youtube", "v3", credentials=creds)
mime = mimetypes.guess_type(a.image)[0] or "image/png"
res = yt.thumbnails().set(videoId=a.video_id, media_body=MediaFileUpload(str(Path(a.image).expanduser()), mimetype=mime)).execute()
print("thumbnail set:", res.get("items", [{}])[0].get("default", {}).get("url", res))
