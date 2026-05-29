"""Symmetric encryption for per-user OpenXBL tokens at rest.

Each user authorizes their own Xbox account via OpenXBL OAuth and we receive a
per-user API key (appKey). That key grants read access to their Xbox account, so
it must never be stored in plaintext. We encrypt it with Fernet (AES-128-CBC +
HMAC) keyed by settings.token_encryption_key before persisting, and decrypt only
when building that user's API client.
"""

from __future__ import annotations

from functools import lru_cache

from cryptography.fernet import Fernet

from app.config import settings


@lru_cache(maxsize=1)
def _fernet() -> Fernet:
    key = settings.token_encryption_key
    if not key:
        raise RuntimeError(
            "TOKEN_ENCRYPTION_KEY is not set. Generate one with: "
            'python -c "from cryptography.fernet import Fernet; '
            'print(Fernet.generate_key().decode())"'
        )
    return Fernet(key.encode())


def encrypt_token(plaintext: str) -> str:
    """Encrypt a per-user token for storage. Returns a URL-safe string."""
    return _fernet().encrypt(plaintext.encode()).decode()


def decrypt_token(ciphertext: str) -> str:
    """Decrypt a stored per-user token."""
    return _fernet().decrypt(ciphertext.encode()).decode()
