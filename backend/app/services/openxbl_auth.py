"""OpenXBL app OAuth: exchange an authorization code for a per-user API key.

Flow (see https://xbl.io app guides):
  1. User visits https://xbl.io/app/auth/{public_key} and signs in with Microsoft.
  2. OpenXBL redirects back to our callback with ?code=...
  3. We POST that code to /app/claim (within a few minutes) and receive the
     user's per-user appKey plus their identity (xuid, gamertag, email, avatar).

The appKey is the per-user X-Authorization token for all of that user's Xbox API
calls (sent together with the static `X-Contract: 100` header).
"""

from __future__ import annotations

import logging

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


class OpenXBLClaimError(Exception):
    pass


async def claim_code(code: str) -> dict:
    """Exchange an OAuth code for the user's appKey + identity.

    Returns the raw claim payload: {appKey, xuid, gamertag, email, avatar}.
    """
    if not settings.openxbl_public_key:
        raise OpenXBLClaimError("OPENXBL_PUBLIC_KEY is not configured.")

    url = settings.openxbl_claim_url
    try:
        async with httpx.AsyncClient(timeout=30.0) as http:
            resp = await http.post(
                url,
                json={"code": code, "app_key": settings.openxbl_public_key},
                headers={"Accept": "application/json"},
            )
    except httpx.HTTPError as exc:
        raise OpenXBLClaimError(f"Could not reach OpenXBL to claim code: {exc}") from exc

    if resp.status_code != 200:
        raise OpenXBLClaimError(
            f"OpenXBL claim failed ({resp.status_code}): {resp.text[:300]}"
        )

    data = resp.json()
    # OpenXBL v2 responses sometimes wrap the payload in a "content" key.
    if isinstance(data, dict) and "content" in data and isinstance(data["content"], dict):
        data = data["content"]

    if not isinstance(data, dict) or not data.get("app_key") or not data.get("xuid"):
        logger.warning(
            "Unexpected OpenXBL claim response (HTTP 200 but no app_key/xuid). "
            "Top-level keys: %s",
            list(data.keys()) if isinstance(data, dict) else type(data).__name__,
        )
        raise OpenXBLClaimError(
            "Claim response missing app_key/xuid — the code may be expired or already used."
        )
    return data
