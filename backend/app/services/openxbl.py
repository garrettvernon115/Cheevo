from __future__ import annotations

import json
import logging
from typing import Any

import httpx
import redis.asyncio as aioredis

from app.config import settings

logger = logging.getLogger(__name__)


class OpenXBLError(Exception):
    pass


class OpenXBLClient:
    """
    Async client for the OpenXBL (xbl.io) API with Redis-backed caching.

    OpenXBL has strict rate limits, so every response is cached.
    Think of this like a repository layer that happens to be a remote HTTP API
    instead of a database — callers get data, not raw HTTP.
    """

    def __init__(self, http: httpx.AsyncClient, cache: aioredis.Redis) -> None:
        self._http = http
        self._cache = cache

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
            raise OpenXBLError("OpenXBL rate limit hit — data served from cache where possible")
        if response.status_code != 200:
            raise OpenXBLError(f"OpenXBL returned {response.status_code} for {path}: {response.text}")
        data = response.json()
        # All OpenXBL v2 responses wrap their payload in a top-level "content" key
        if isinstance(data, dict) and "content" in data:
            return data["content"]
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
        """Return the Xbox profile for a given XUID."""
        return await self._cached_request(
            cache_key=f"profile:{xuid}",
            path=f"/account/{xuid}",
            ttl=settings.cache_ttl_profile,
        )

    async def get_my_profile(self) -> dict[str, Any]:
        """Return the profile for the authenticated account (uses the linked API key)."""
        return await self._cached_request(
            cache_key="profile:me",
            path="/account",
            ttl=settings.cache_ttl_profile,
        )

    # ------------------------------------------------------------------
    # Games
    # ------------------------------------------------------------------

    async def get_games(self, xuid: str) -> list[dict[str, Any]]:
        """Return all games for the authenticated user (OpenXBL doesn't support per-XUID title history)."""
        return await self.get_my_games()

    async def get_my_games(self) -> list[dict[str, Any]]:
        data = await self._cached_request(
            cache_key="games:me",
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
            cache_key=f"achievements:me:{title_id}",
            path=f"/achievements/title/{title_id}",
            ttl=settings.cache_ttl_achievements,
        )
        # After content-unwrap: {"achievements": [...]}
        return data.get("achievements", []) if isinstance(data, dict) else []

    # ------------------------------------------------------------------
    # Cache management
    # ------------------------------------------------------------------

    async def invalidate(self, pattern: str) -> int:
        """Delete cache keys matching a pattern. Returns count deleted."""
        keys = await self._cache.keys(pattern)
        if keys:
            return await self._cache.delete(*keys)
        return 0


async def get_openxbl_client() -> OpenXBLClient:
    """
    FastAPI dependency that yields a ready OpenXBLClient.
    httpx and redis clients are created per-request for simplicity in Phase 1.
    In Phase 2, lift these to app lifespan for connection pooling.
    """
    headers = {
        "X-Authorization": settings.openxbl_api_key,
        "Accept": "application/json",
        "Accept-Language": "en-US",
    }
    async with httpx.AsyncClient(headers=headers, timeout=30.0) as http:
        redis = aioredis.from_url(settings.redis_url, decode_responses=True)
        try:
            client = OpenXBLClient(http=http, cache=redis)
            yield client
        finally:
            await redis.aclose()
