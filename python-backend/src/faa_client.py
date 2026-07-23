"""
OAuth2 client for the FAA NOTAM Management Service API (NMS-API).

Auth flow (per FAA's NMS-API FAQ and OpenAPI spec):
- POST {host}/v1/auth/token (NOT under /nmsapi) with grant_type=client_credentials,
  using HTTP Basic auth with client_id/client_secret.
- Response includes access_token and expires_in (seconds, ~1799 = 30 min for
  the staging/pre-prod environment).
- The bearer token must be renewed before it expires; this client caches the
  token in memory and renews automatically when it's close to expiry.
"""

import time
import requests

from src.config import FAA_NMS_CLIENT_ID, FAA_NMS_CLIENT_SECRET, FAA_NMS_AUTH_URL

# Renew this many seconds before actual expiry, as a safety margin.
_RENEW_MARGIN_SECONDS = 60


class FAANmsClient:
    def __init__(self):
        self._token: str | None = None
        self._token_expires_at: float = 0.0

    def _fetch_new_token(self) -> None:
        if not FAA_NMS_CLIENT_ID or not FAA_NMS_CLIENT_SECRET:
            raise RuntimeError(
                "FAA_NMS_CLIENT_ID / FAA_NMS_CLIENT_SECRET are not set. "
                "Add them to your .env file."
            )

        response = requests.post(
            FAA_NMS_AUTH_URL,
            data={"grant_type": "client_credentials"},
            auth=(FAA_NMS_CLIENT_ID, FAA_NMS_CLIENT_SECRET),
            timeout=15,
        )
        response.raise_for_status()
        payload = response.json()

        self._token = payload["access_token"]
        expires_in = float(payload.get("expires_in", 1799))
        self._token_expires_at = time.time() + expires_in

    def get_valid_token(self) -> str:
        """Return a valid bearer token, renewing it if missing or near expiry."""
        if self._token is None or time.time() >= (self._token_expires_at - _RENEW_MARGIN_SECONDS):
            self._fetch_new_token()
        return self._token
