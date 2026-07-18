import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Optional, Union
from jose import jwt
from sqlalchemy.orm import Session
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from app.core.config import settings

logger = logging.getLogger(__name__)

# Shared Argon2 hasher for the whole process. Argon2id is the modern default.
ph = PasswordHasher()


def hash_password(password: str) -> str:
    """
    Hashes a plain password using Argon2.
    """
    return ph.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifies a plain password against an Argon2 hash.
    Returns False cleanly on a mismatch rather than raising.
    """
    try:
        return ph.verify(hashed_password, plain_password)
    except VerifyMismatchError:
        return False
    except Exception:
        # Any other argon2 error (malformed hash, bad parameters, etc.) must
        # also fail closed — never authenticate on a hash we cannot interpret.
        return False


def create_access_token(
    subject: Union[str, Any], expires_delta: timedelta = None
) -> str:
    """
    Generates a JWT access token for a subject (e.g. user ID).

    FIX 6: Every token now carries a unique `jti` (JWT ID). The logout flow
    records this jti in the `revoked_tokens` blocklist so the token can be
    invalidated before its natural expiry. Without a jti we would have no
    stable identifier with which to revoke an individual token.
    """
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )

    # Mint a cryptographically random, URL-safe token id. 16 bytes (128 bits)
    # is more than enough to make collisions effectively impossible.
    token_jti = secrets.token_urlsafe(16)

    to_encode = {
        "exp": expire,
        "sub": str(subject),
        "jti": token_jti,
    }

    encoded_jwt = jwt.encode(
        to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM
    )
    return encoded_jwt


def decode_access_token(token: str) -> Union[dict, None]:
    """
    Decodes and validates a JWT's signature and expiry.

    NOTE: This only proves the token is well-formed and unexpired. It does NOT
    check the blocklist — call `is_token_revoked` afterwards (the auth
    dependency in dependencies.py does both) so that DB access stays explicit
    at the request boundary rather than hidden in a crypto helper.
    """
    try:
        decoded = jwt.decode(
            token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]
        )
        return decoded
    except jwt.JWTError:
        return None


def extract_jti(token: str) -> Optional[str]:
    """
    Best-effort extraction of the `jti` claim from a token.

    Used by the logout endpoint to revoke the presented token without requiring
    full re-validation (the caller has already authenticated the user). Returns
    None for tokens that are malformed or missing the jti claim.
    """
    payload = decode_access_token(token)
    if payload is None:
        return None
    jti = payload.get("jti")
    return jti if isinstance(jti, str) and jti else None
