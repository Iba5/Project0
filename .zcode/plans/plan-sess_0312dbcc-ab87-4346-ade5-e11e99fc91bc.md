# Implementation Plan: Fixes 1–7 for Voting_Admin_App

I've read every relevant file across backend and frontend. Here is the concrete, file-by-file plan to fix pitfalls 1–7 from the audit. All fixes are production-grade (no stubs/TODOs), preserve existing business flows, add detailed inline comments, and ship an Alembic migration where schema changes are needed.

---

## 🛑 FIX 1 — Money-to-Votes Fractional Truncation Bug
**Problem:** `services.py:637` does `votes_to_add = int(payment.amount)`. A $0.50 payment = 0 votes; the event's `vote_price` / `votes_per_payment` rules are ignored entirely.

**Challenge:** The `payments` table has no `event_id` FK, so we can't directly look up the pricing rule for a payment. The link is `payment → contestant → (no event link on participant either)`. 

**Solution (2 parts):**
1. **Add `event_id` columns** to `payments` and `participants` via a new Alembic migration (nullable, backfilled to the active event for existing rows where possible, else NULL). Update `Payment` and `Participant` models to include `event_id` FK. Update `EventCreate`/`ParticipantCreate` schemas.
2. **Rewrite vote calc** in `process_paynow_callback`:
   - Load the payment's event (via `payment.event_id`, fallback to contestant's `event_id`, fallback to active event, fallback to defaults: `vote_price=1.0`, `votes_per_payment=1`).
   - Compute `votes_to_add = floor((payment.amount / event.vote_price) * event.votes_per_payment)` using `Decimal` for cent-accuracy.
   - Guard: if `vote_price <= 0` → default 1.0; if result < 1 → log + treat as 0 votes but still mark payment PAID.
   - Also fix `initiate_payment` to stamp `event_id` onto the payment at creation time (uses active event or request-supplied event).

**Files:** `backend/app/services/services.py`, `backend/app/models/models.py`, `backend/app/schemas/schemas.py`, `backend/app/repositories/repositories.py` (helper to get event by id), new migration `backend/migrations/versions/<rev>_link_payments_participants_to_events.py`.

---

## 🛑 FIX 2 — Paynow Callback Idempotency Race Condition
**Problem:** `process_paynow_callback` reads `payment.status`, then later mutates it. Two concurrent callbacks both pass the check → double-credited votes.

**Solution (defense in depth):**
1. **DB row lock:** Re-fetch the payment inside the transaction with `with_for_update()` so the second concurrent callback blocks until the first commits. Add `get_by_reference_for_update()` to `PaymentRepository`.
2. **Unique constraint guard:** The `vote_transactions` table already has `UniqueConstraint('payment_id')` — I'll rely on this as the hard floor: a duplicate insert raises `IntegrityError`, which the service catches and treats as already-processed (rollback + return, no error to Paynow).
3. **Idempotency re-check inside lock:** After acquiring the lock, re-check `payment.status` — if already PAID/FAILED, return early.

**Files:** `backend/app/repositories/repositories.py` (add `get_by_reference_for_update`), `backend/app/services/services.py` (rewrite `process_paynow_callback` lock + try/except IntegrityError), `backend/app/services/idempotency.py` (optionally move check to use locked row — kept for clarity).

Note: SQLite (local fallback) doesn't support true `FOR UPDATE`, but SQLAlchemy will no-op it silently. Postgres (Supabase prod) gets real locking. This is correct behavior for both.

---

## 🔐 FIX 5 — HttpOnly Cookie for JWT (was pitfall #5 in audit)
**Problem:** `frontend/lib/auth.ts` stores JWT in a JS-readable cookie — XSS can steal it.

**Solution — full HttpOnly cookie architecture:**
1. **Backend sets the cookie** on `/auth/login`, `/auth/register`, `/auth/complete-signup` responses via `Set-Cookie: auth-token=<jwt>; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=604800`. Use `DEBUG` flag to gate `Secure` (off for localhost http dev).
2. **Backend reads the cookie** for auth: update `dependencies.py` `oauth2_scheme` to `OAuth2PasswordBearer(auto_error=False)` AND add an `access_token_cookie` extraction. `get_current_user` tries header first, then cookie.
3. **Backend logout** clears the cookie (`Max-Age=0`) in addition to blocklist (Fix 6).
4. **Frontend:** 
   - `lib/auth.ts`: remove token storage; keep a **non-sensitive** `auth-user` cookie (id/name/email/role only — no token) so the UI can show the user's name. Token is now HttpOnly and never touched by JS.
   - `lib/api.ts`: remove the `Authorization` header interceptor (browser auto-sends the HttpOnly cookie with same-origin requests).
   - `proxy.ts`: route guard now reads `auth-user` cookie (presence = logged in) instead of `auth-token`.
   - `app/api/_lib/backend.ts`: stop forwarding `Authorization` header (cookie travels end-to-end automatically; backend reads it).
   - Auth pages (`auth-login-page.tsx`, `auth-signup-page.tsx`): on success, **don't** call `setAuth(token)` — the cookie is set by the backend response. Still call a light `setAuthUser(user)` for the non-sensitive user cookie, and redirect.
   - `app-shell.tsx`: logout calls `POST /api/auth/logout` (which proxies to backend that clears HttpOnly cookie), then clears the local `auth-user` cookie, then redirects.

**Files:** `backend/app/api/v1/endpoints/auth.py`, `backend/app/api/v1/dependencies.py`, `backend/app/core/config.py` (add `COOKIE_SECURE` derived flag), `frontend/lib/auth.ts`, `frontend/lib/api.ts`, `frontend/proxy.ts`, `frontend/app/api/_lib/backend.ts`, `frontend/components/pages/auth-login-page.tsx`, `frontend/components/pages/auth-signup-page.tsx`, `frontend/components/app-shell.tsx`.

---

## 🔐 FIX 6 — JWT Invalidation on Logout (Token Blocklist)
**Problem:** Logout only writes an audit log; the JWT stays valid for 8 days. No revocation.

**Solution — DB-backed token blocklist (jti-based):**
1. **Add `jti` (JWT ID) claim** to every token in `create_access_token` (`secrets.token_urlsafe(16)`). 
2. **New `revoked_tokens` table** (`id`, `jti` UNIQUE, `user_id`, `expires_at`, `created_at`) — via Alembic migration. Auto-prune: queries filter `expires_at > now()` so expired entries are ignored; add a lightweight cleanup that deletes rows older than 7 days on each logout (bounded cost).
3. **New `RevokedTokenRepository`** with `revoke(jti, user_id, exp)` and `is_revoked(jti)`.
4. **`decode_access_token` / `get_current_user`** checks the blocklist after signature verification; revoked → 401.
5. **`logout_admin`** extracts `jti` from the current token and revokes it.

**Files:** `backend/app/core/security.py` (jti + blocklist check), `backend/app/models/models.py` (`RevokedToken`), `backend/app/repositories/repositories.py` (`RevokedTokenRepository`), `backend/app/services/services.py` (`logout_admin` revokes jti), `backend/app/api/v1/endpoints/auth.py` (logout extracts token + sets cookie clear), `backend/app/api/v1/dependencies.py` (already covered via security check), new migration `<rev>_add_revoked_tokens.py`.

---

## 🔐 FIX 3 — Open Admin Registration + Empty Hash Hygiene (was pitfall #12)
**Problem:** `/auth/register` lets anyone create an `ADMIN` account. Invitation users get `hashed_password=""`.

**Solution:**
1. **Lock down `/auth/register`:**
   - Rename intent: registration becomes either (a) **bootstrap mode** — allowed only when zero users exist in the DB (first Super Admin), or (b) **requires a valid invitation token** passed in the body.
   - New endpoint behavior: if `UserRepository.count() == 0` → allow, create as `SUPER_ADMIN` (bootstrap). Otherwise require `invitation_token` in the request; validate it, expire-check, then create the user with the invitation's role.
   - This subsumes `complete-signup` cleanly; I'll keep `complete-signup` working too but route register through the same secure path.
2. **Password strength validation:** add `validate_password_strength()` util (≥10 chars, upper+lower+digit+symbol) used by register, complete-signup, and reset-password. Raise `ValidationException` on failure.
3. **Kill the empty-hash footgun:** in `create_admin_invitation`, set `hashed_password` to a random 32-byte Argon2 hash of a random string (`hash_password(secrets.token_urlsafe(32))`) instead of `""`. That way the row is never loginable until signup completes, and `verify_password` always returns False for any guess.

**Files:** `backend/app/api/v1/endpoints/auth.py`, `backend/app/services/services.py`, `backend/app/repositories/repositories.py` (add `count()`), `backend/app/schemas/schemas.py` (extend `UserRegister` with optional `invitation_token`), new `backend/app/utils/password.py` (strength validator), `backend/app/utils/__init__.py` if needed.

---

## 🛡️ FIX 4 — Distributed Rate Limiting (was pitfall #4)
**Problem:** In-memory dict — breaks under multi-worker, leaks memory.

**Solution — DB-backed sliding-window rate limiter:**
1. **New `rate_limit_buckets` table** (`id`, `client_ip`, `window_start`, `request_count`, composite unique on `(client_ip)` so upserts are atomic). Via Alembic migration.
2. **Rewrite `RateLimitingMiddleware`** to use the DB with an atomic upsert:
   - Postgres: `INSERT ... ON CONFLICT (client_ip) DO UPDATE SET request_count = rate_limit_buckets.request_count + 1 ... WHERE ...` returning the new count.
   - SQLite: fall back to a `BEGIN IMMEDIATE` row lock + read/conditional-write (works for local dev).
   - If count > limit → 429.
   - Window reset: if `now - window_start > 60s`, reset count to 1 and update window_start.
3. **Auto-pruning:** delete buckets with `window_start < now - 5 minutes` on each request (cheap, bounded; or run every Nth request).
4. **Health/callback exemption:** skip rate-limiting for `/health` and `/payments/paynow/callback` (Paynow must always reach us; a separate per-IP limit can be added later if abused).

Trade-off note: DB-based limiting adds ~1 query per request. For an admin app with low traffic this is fine and gives correct cross-worker behavior. I'll note Redis as the upgrade path in a comment.

**Files:** `backend/app/middleware/middleware.py`, `backend/app/models/models.py` (`RateLimitBucket`), `backend/app/repositories/repositories.py` (`RateLimitRepository` with dialect-aware upsert), new migration `<rev>_add_rate_limit_and_revoked_tokens.py` (combined with Fix 6's migration to keep revision count tidy).

---

## 🛡️ FIX 7 — SQL LIKE Wildcard Sanitization in Search (was pitfall #8)
**Problem:** `ParticipantRepository.search_and_filter` interpolates raw `search` into `ilike(f"%{search}%")` — `%`/`_` wildcards cause broad scans / DoS.

**Solution:**
1. **New util `backend/app/utils/sanitize.py`** with `escape_like(value: str) -> str` that escapes `\`, `%`, `_` and optionally caps length (e.g. 100 chars).
2. **Apply in `search_and_filter`:** `Participant.name.ilike(f"%{escape_like(search)}%", escape='\\')` and same for `category`. Pass `escape='\\'` so SQLAlchemy emits `ESCAPE '\'`.
3. Also bound `search` length at the endpoint layer (`Query(None, max_length=100)`) as defense in depth.

**Files:** `backend/app/repositories/repositories.py`, `backend/app/utils/sanitize.py`, `backend/app/api/v1/endpoints/participants.py` (max_length guard).

---

## Migration Strategy
Two new Alembic migrations, chained after `ad71a2c892e3`:
- **Migration A** (`<rev_a>_link_payments_participants_to_events.py`): adds `payments.event_id` (FK→events, nullable) and `participants.event_id` (FK→events, nullable). Fix 1.
- **Migration B** (`<rev_b>_add_revoked_tokens_and_rate_limits.py`): creates `revoked_tokens` (Fix 6) and `rate_limit_buckets` (Fix 4). 

Each migration has a full `upgrade()` and `downgrade()`. I'll generate revision IDs deterministically (12-hex) per the existing convention.

---

## Verification
After implementation I will:
1. Run `python -c "import app.main"` (syntax/import check) from `backend/`.
2. Run `alembic upgrade head` against a throwaway SQLite DB to confirm migrations apply cleanly.
3. Run `npx tsc --noEmit` in `frontend/` to confirm TypeScript compiles with the cookie/auth refactor.
4. Report any errors verbatim; fix before declaring done.

I will NOT introduce Redis, Docker, or test suites (those are fixes 8–15, out of scope for this request). I will NOT modify business logic beyond what each fix requires.

---

## Order of Execution
1. Backend models + migration(s) first (foundation for 1, 4, 6).
2. `security.py` jti + blocklist (6).
3. `services.py` payment math + locking + auth changes (1, 2, 3, 6).
4. `auth.py` endpoints + cookies (3, 5, 6).
5. `dependencies.py` cookie reading (5).
6. `middleware.py` rate limit (4).
7. `repositories.py` search sanitization (7).
8. Frontend auth refactor (5).
9. Verify (imports, alembic, tsc).

Ready to implement on approval.