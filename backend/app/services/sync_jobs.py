"""Background full-sync with progress tracked in Redis.

A full sync makes ~1 OpenXBL call per game, so even parallelized it takes tens of
seconds — too long to block an HTTP request and leave the user staring at a
spinner. Instead the API kicks this off as a background task and the frontend
polls a status endpoint to render a progress bar.

Status shape (Redis key ``sync:status:{xuid}``):
    {"status": "running"|"complete"|"error",
     "total_games": int, "synced_games": int, "achievements_synced": int,
     "error": str | None}
"""

from __future__ import annotations

import asyncio
import json
import logging

import redis.asyncio as aioredis

from app.config import settings
from app.db import AsyncSessionLocal
from app.services.openxbl import openxbl_client, resolve_user_token
from app.services.sync import (
    SYNC_CONCURRENCY,
    _fetch_achievements,
    _persist_achievements,
    sync_games,
    sync_profile,
)

logger = logging.getLogger(__name__)

STATUS_TTL = 900  # seconds to keep a finished status around


def _key(xuid: str) -> str:
    return f"sync:status:{xuid}"


async def _update(redis: aioredis.Redis, xuid: str, **fields) -> None:
    raw = await redis.get(_key(xuid))
    data = json.loads(raw) if raw else {}
    data.update(fields)
    await redis.setex(_key(xuid), STATUS_TTL, json.dumps(data))


async def get_status(xuid: str) -> dict | None:
    redis = aioredis.from_url(settings.redis_url, decode_responses=True)
    try:
        raw = await redis.get(_key(xuid))
        return json.loads(raw) if raw else None
    finally:
        await redis.aclose()


async def mark_running(xuid: str) -> None:
    """Set an initial 'running' status synchronously, before the task is scheduled,
    so the first status poll never sees a stale/missing state."""
    redis = aioredis.from_url(settings.redis_url, decode_responses=True)
    try:
        await _update(
            redis, xuid,
            status="running", total_games=0, synced_games=0,
            achievements_synced=0, error=None,
        )
    finally:
        await redis.aclose()


async def run_background_sync(xuid: str) -> None:
    """Run a full sync for one user, writing progress to Redis as it goes."""
    redis = aioredis.from_url(settings.redis_url, decode_responses=True)
    try:
        await _update(redis, xuid, status="running")
        async with AsyncSessionLocal() as db:
            token = await resolve_user_token(xuid, db)
            async with openxbl_client(token, xuid) as client:
                user = await sync_profile(xuid, client, db)
                games = await sync_games(user, client, db)
                await _update(redis, xuid, total_games=len(games))

                # Fetch concurrently, bumping progress as each game's fetch lands.
                sem = asyncio.Semaphore(SYNC_CONCURRENCY)
                done = 0
                progress_lock = asyncio.Lock()

                async def fetch_one(game):
                    nonlocal done
                    result = await _fetch_achievements(client, user, game, sem)
                    async with progress_lock:
                        done += 1
                        await _update(redis, xuid, synced_games=done)
                    return result

                fetched = await asyncio.gather(*(fetch_one(g) for g in games))

                total_ach = 0
                for game, raw_achievements in fetched:
                    total_ach += await _persist_achievements(user, game, raw_achievements, db)

                await db.commit()
                await _update(
                    redis, xuid,
                    status="complete", synced_games=len(games), achievements_synced=total_ach,
                )
                logger.info(
                    "Background sync complete for %s: %d games, %d achievements",
                    xuid, len(games), total_ach,
                )
    except Exception as exc:
        logger.error("Background sync failed for %s: %s", xuid, exc)
        try:
            await _update(redis, xuid, status="error", error=str(exc)[:200])
        except Exception:
            pass
    finally:
        await redis.aclose()
