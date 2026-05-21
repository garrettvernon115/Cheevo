from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.games import router as games_router
from app.api.routes.profile import router as profile_router
from app.config import settings

logging.basicConfig(level=logging.DEBUG if settings.debug else logging.INFO)

app = FastAPI(
    title="Achievement Hunter API",
    description="Xbox achievement tracking and hunting companion",
    version="0.1.0",
    debug=True,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://localhost:8080"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(profile_router, prefix="/api")
app.include_router(games_router, prefix="/api")


@app.get("/health")
async def health():
    return {"status": "ok"}
