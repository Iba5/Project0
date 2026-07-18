"""
FIX 3: Password-strength enforcement.

Previously, the only password validation was the Pydantic/Zod minimum-length
rules on the request schemas. This module centralizes a single, stronger policy
applied consistently at registration, invitation signup completion, and password
reset. Raising a ValidationException gives the frontend a clean 422 error with
field-level detail instead of an opaque 400.
"""
import re
from typing import List
from app.exceptions.exceptions import ValidationException

# Policy constants — deliberately conservative for an admin console.
MIN_LENGTH = 10
MAX_LENGTH = 128

_UPPER = re.compile(r"[A-Z]")
_LOWER = re.compile(r"[a-z]")
_DIGIT = re.compile(r"\d")
_SYMBOL = re.compile(r"[^A-Za-z0-9]")


def validate_password_strength(password: str) -> str:
    """
    Validate `password` against the platform password policy and return it
    unchanged if it passes. Raises ValidationException with a list of human
    readable failures if it does not.

    Policy:
      * 10–128 characters
      * at least one uppercase letter
      * at least one lowercase letter
      * at least one digit
      * at least one symbol (any non-alphanumeric character)
    """
    if not isinstance(password, str):
        raise ValidationException(
            message="Password must be a string.",
            errors=[{"field": "password", "message": "Password must be a string."}],
        )

    errors: List[str] = []

    if len(password) < MIN_LENGTH:
        errors.append(f"Password must be at least {MIN_LENGTH} characters long.")
    if len(password) > MAX_LENGTH:
        errors.append(f"Password must be no more than {MAX_LENGTH} characters long.")
    if not _UPPER.search(password):
        errors.append("Password must include at least one uppercase letter.")
    if not _LOWER.search(password):
        errors.append("Password must include at least one lowercase letter.")
    if not _DIGIT.search(password):
        errors.append("Password must include at least one digit.")
    if not _SYMBOL.search(password):
        errors.append("Password must include at least one symbol.")

    if errors:
        raise ValidationException(
            message="Password does not meet the security requirements.",
            errors=[{"field": "password", "message": msg} for msg in errors],
        )

    return password
