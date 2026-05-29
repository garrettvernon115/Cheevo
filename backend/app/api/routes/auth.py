from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.user import User
from app.services.crypto import encrypt_token
from app.services.openxbl_auth import OpenXBLClaimError, claim_code

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])


class ClaimRequest(BaseModel):
    code: str


@router.post("/openxbl/claim")
async def openxbl_claim(body: ClaimRequest, db: AsyncSession = Depends(get_db)):
    """Exchange an OpenXBL OAuth code for a per-user token, then upsert the user.

    Returns the user's identity so the frontend can establish a session. The
    per-user token is encrypted at rest and never returned to the client.
    """
    try:
        claim = await claim_code(body.code.strip())
    except OpenXBLClaimError as exc:
        logger.warning("OpenXBL claim failed: %s", exc)
        raise HTTPException(status_code=400, detail=str(exc))

    xuid = str(claim["xuid"])
    encrypted = encrypt_token(claim["appKey"])

    result = await db.execute(select(User).where(User.xuid == xuid))
    user = result.scalar_one_or_none()

    if user is None:
        user = User(
            xuid=xuid,
            gamertag=claim.get("gamertag") or "Unknown",
            gamerscore=0,
            email=claim.get("email"),
            avatar_url=claim.get("avatar"),
            openxbl_token=encrypted,
        )
        db.add(user)
    else:
        user.openxbl_token = encrypted
        if claim.get("gamertag"):
            user.gamertag = claim["gamertag"]
        if claim.get("email"):
            user.email = claim["email"]
        if claim.get("avatar"):
            user.avatar_url = claim["avatar"]

    await db.commit()

    return {
        "xuid": xuid,
        "gamertag": user.gamertag,
        "email": user.email,
        "avatar_url": user.avatar_url,
    }
