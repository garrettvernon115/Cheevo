from __future__ import annotations

import json
import logging
from typing import Any

import httpx
import redis.asyncio as aioredis
from fastapi import Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import get_db
from app.models.user import User
from app.services.crypto import decrypt_token

logger = logging.getLogger(__name__)


class OpenXBLError(Exception):
    pass


class OpenXBLRateLimitError(OpenXBLError):
    """Raised when OpenXBL's request quota is exhausted (HTTP 429 or a 200 limit body)."""

    pass


class OpenXBLClient:
    """
    Async client for the OpenXBL (xbl.io) API with Redis-backed caching.

    OpenXBL has strict rate limits, so every response is cached.
    Think of this like a repository layer that happens to be a remote HTTP API
    instead of a database — callers get data, not raw HTTP.
    """

    def __init__(
        self, http: httpx.AsyncClient, cache: aioredis.Redis, cache_namespace: str = "shared"
    ) -> None:
        self._http = http
        self._cache = cache
        # Cache keys are namespaced per user so one user's cached data is never
        # served to another. In multi-user mode this is the user's XUID.
        self._ns = cache_namespace

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _get_cached(self, cache_key: str) -> Any | None:
        raw = await self._cache.get(cache_key)
        if raw:
            logger.debug("Cache hit: %s", cache_key)
            return json.loads(raw)
        return None

    async def _set_cached(self, cache_key: str, data: Any, ttl: int) -> None:
        await self._cache.setex(cache_key, ttl, json.dumps(data))

    async def _request(self, path: str) -> Any:
        url = f"{settings.openxbl_base_url}{path}"
        response = await self._http.get(url)
        if response.status_code == 429:
            raise OpenXBLRateLimitError("OpenXBL request quota reached. Try again in a few minutes.")
        if response.status_code != 200:
            raise OpenXBLError(f"OpenXBL returned {response.status_code} for {path}: {response.text}")
        data = response.json()
        # All OpenXBL v2 responses wrap their payload in a top-level "content" key
        if isinstance(data, dict) and "content" in data:
            data = data["content"]
        # When the hourly quota is exhausted OpenXBL replies 200 with a limit body
        # ({"limitType": ..., "currentRequests": N, "maxRequests": N, ...}) and no real
        # payload. Detect it so callers don't mistake it for empty/valid data.
        if (
            isinstance(data, dict)
            and "limitType" in data
            and "currentRequests" in data
            and "maxRequests" in data
        ):
            raise OpenXBLRateLimitError("OpenXBL request quota reached. Try again in a few minutes.")
        return data

    async def _cached_request(self, cache_key: str, path: str, ttl: int) -> Any:
        cached = await self._get_cached(cache_key)
        if cached is not None:
            return cached
        data = await self._request(path)
        await self._set_cached(cache_key, data, ttl)
        return data

    # ------------------------------------------------------------------
    # Profile
    # ------------------------------------------------------------------

    async def get_profile(self, xuid: str) -> dict[str, Any]:
        """Return the Xbox profile for the token's owner.

        With a per-user token the authenticated account IS this user, so this
        delegates to /account rather than /account/{xuid}.
        """
        return await self.get_my_profile()

    async def get_my_profile(self) -> dict[str, Any]:
        """Return the profile for the authenticated account (the token's owner)."""
        return await self._cached_request(
            cache_key=f"profile:{self._ns}",
            path="/account",
            ttl=settings.cache_ttl_profile,
        )

    async def get_xuid_by_gamertag(self, gamertag: str) -> str:
        """Resolve a gamertag to an XUID via OpenXBL search."""
        cache_key = f"gt:{gamertag.lower()}"
        cached = await self._get_cached(cache_key)
        if cached is not None:
            return cached
        data = await self._request(f"/search/{gamertag}")
        # Response shape: {"people": [{"xuid": "...", "gamertag": "..."}]}
        people = data.get("people", []) if isinstance(data, dict) else []
        if not people:
            raise OpenXBLError(f"No Xbox account found for gamertag: {gamertag}")
        xuid = str(people[0]["xuid"])
        await self._set_cached(cache_key, xuid, settings.cache_ttl_profile)
        return xuid

    # ------------------------------------------------------------------
    # Games
    # ------------------------------------------------------------------

    async def get_games(self, xuid: str) -> list[dict[str, Any]]:
        """Return all games for the authenticated user (OpenXBL doesn't support per-XUID title history)."""
        return await self.get_my_games()

    async def get_my_games(self) -> list[dict[str, Any]]:
        data = await self._cached_request(
            cache_key=f"games:{self._ns}",
            path="/player/titleHistory",
            ttl=settings.cache_ttl_games,
        )
        # After content-unwrap: {"xuid": "...", "titles": [...]}
        return data.get("titles", []) if isinstance(data, dict) else []

    # ------------------------------------------------------------------
    # Achievements
    # ------------------------------------------------------------------

    async def get_achievements_for_title(
        self, xuid: str, title_id: str
    ) -> list[dict[str, Any]]:
        """Return achievement definitions + unlock state for a specific game."""
        return await self.get_my_achievements_for_title(title_id)

    async def get_my_achievements_for_title(self, title_id: str) -> list[dict[str, Any]]:
        data = await self._cached_request(
            cache_key=f"achievements:{self._ns}:{title_id}",
            path=f"/achievements/title/{title_id}",
            ttl=settings.cache_ttl_achievements,
        )
        if isinstance(data, list):
            return data
        if isinstance(data, dict):
            # Modern: {"achievements": [...]}
            # Some responses nest under an extra key — walk one level deep
            for key in ("achievements", "Achievements"):
                if key in data and isinstance(data[key], list):
                    return data[key]
            # If there's only one list-valued key, use it
            list_vals = [v for v in data.values() if isinstance(v, list)]
            if len(list_vals) == 1:
                return list_vals[0]
        return []

    # ------------------------------------------------------------------
    # Cache management
    # ------------------------------------------------------------------

    async def invalidate(self, pattern: str) -> int:
        """Delete cache keys matching a pattern. Returns count deleted."""
        keys = await self._cache.keys(pattern)
        if keys:
            return await self._cache.delete(*keys)
        return 0


async def get_openxbl_client(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> OpenXBLClient:
    """
    FastAPI dependency that yields an OpenXBLClient scoped to the current user.

    Resolves the user from the `x-user-xuid` header and uses their stored
    (decrypted) per-user OpenXBL token, sent with the `X-Contract: 100` header
    that designates a consumer account. Falls back to the legacy shared dev key
    when a user has no per-user token yet (e.g. demo data).
    """
    xuid = request.headers.get("x-user-xuid")
    token: str | None = None
    if xuid:
        result = await db.execute(select(User).where(User.xuid == xuid))
        user = result.scalar_one_or_none()
        if user and user.openxbl_token:
            token = decrypt_token(user.openxbl_token)

    headers = {"Accept": "application/json", "Accept-Language": "en-US"}
    if token:
        headers["X-Authorization"] = token
        headers["X-Contract"] = "100"  # designates a per-user (consumer) token
    elif settings.openxbl_api_key:
        headers["X-Authorization"] = settings.openxbl_api_key
    else:
        raise OpenXBLError("No OpenXBL credentials available for this request.")

    async with httpx.AsyncClient(headers=headers, timeout=30.0) as http:
        redis = aioredis.from_url(settings.redis_url, decode_responses=True)
        try:
            yield OpenXBLClient(http=http, cache=redis, cache_namespace=xuid or "shared")
        finally:
            await redis.aclose()
