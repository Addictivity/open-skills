"""Shared Google OAuth for the YouTube scripts. Tokens are stored as JSON with owner-only permissions."""

import os
import sys
from pathlib import Path

from google.auth.exceptions import RefreshError
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow


def get_credentials(credentials_path: Path, token_store: Path, scopes: list):
    """Cached token if valid, a refresh if possible, otherwise a browser consent."""
    creds = None
    if token_store.exists():
        creds = Credentials.from_authorized_user_file(str(token_store), scopes)
    if creds and creds.valid:
        return creds

    refreshed = False
    if creds and creds.expired and creds.refresh_token:
        try:
            creds.refresh(Request())
            refreshed = True
        except RefreshError:
            # OAuth apps in Testing mode lose refresh tokens after 7 days.
            print("Saved token no longer works, asking for consent again...", file=sys.stderr)

    if not refreshed:
        if not credentials_path.exists():
            sys.exit(f"No valid token and OAuth client file missing: {credentials_path}")
        flow = InstalledAppFlow.from_client_secrets_file(str(credentials_path), scopes)
        print("Opening browser for OAuth consent. Choose the channel you want to publish to.", file=sys.stderr)
        # The default prompt prints to stdout, which would corrupt the JSON callers capture.
        creds = flow.run_local_server(port=0, prompt="consent", authorization_prompt_message="")

    token_store.parent.mkdir(parents=True, exist_ok=True)
    token_store.write_text(creds.to_json(), encoding="utf-8")
    os.chmod(token_store, 0o600)
    return creds
