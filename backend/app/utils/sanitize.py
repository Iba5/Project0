"""
FIX 7: Input-sanitization helpers for database LIKE queries.

SQL `LIKE`/`ILIKE` treat `%` and `_` as wildcard metacharacters. When a raw
user search term is interpolated into a LIKE pattern, an attacker can submit a
single `%` to match every row (forcing an expensive full scan — a cheap DoS),
or craft patterns that quietly bypass intended filtering. These helpers escape
those metacharacters so search input is matched literally.
"""

# Cap how much of a search term we ever consider. Long inputs are almost always
# abusive; bounding length protects the query planner and the DB.
MAX_SEARCH_LENGTH = 100


def escape_like(value: str|None=None, escape_char: str = "\\") -> str:
    """
    Escape the LIKE/ILIKE wildcard metacharacters in `value` so it matches
    literally when wrapped in a `%...%` pattern.

    Rules:
      1. The escape character itself must be escaped first (so an attacker
         cannot smuggle a backslash-escape sequence through).
      2. `%` (match any sequence) and `_` (match any single char) are escaped.
      3. The input is length-capped to MAX_SEARCH_LENGTH.

    The returned string is intended to be used together with SQLAlchemy's
    `escape` clause, e.g.:
        Column.ilike(f"%{escape_like(term)}%", escape="\\\\")
    so the DB emits `ESCAPE '\'` and interprets our backslash escaping.
    """
    if value is None:
        return ""

    # Truncate before escaping so we don't waste work on abusive inputs.
    trimmed = value[:MAX_SEARCH_LENGTH]

    # Order matters: escape the escape char first, then the metacharacters.
    escaped = (
        trimmed
        .replace(escape_char, escape_char + escape_char)
        .replace("%", escape_char + "%")
        .replace("_", escape_char + "_")
    )
    return escaped
