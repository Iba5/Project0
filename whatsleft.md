Work through this in the exact phase order below. After each phase, run `npm run build` and confirm 0 errors before moving to the next phase. Do not skip ahead or combine phases.

PHASE 1 — Error handling
1. In app/api/_lib/backend.ts: when BACKEND_API_URL is set and a real request fails, do NOT silently return the mock fallback. Instead return a proper error response (502/503) with a clear message, so the frontend can show a real error state.
2. Add a global error boundary (app/error.tsx and app/global-error.tsx) with a friendly fallback UI and a "Try again" button.
3. Ensure every API route that talks to the backend wraps calls in try/catch and surfaces failures via toast (using the existing Sonner setup), not silent failures.

PHASE 2 — Complete the scaffolded features
1. Participants: add Create, Edit, Delete UI (dialogs, matching the existing Events CRUD pattern) and wire to real API routes with PATCH/POST/DELETE handlers.
2. Notifications: replace the hardcoded 3-item array in app-shell.tsx with a real fetch from a new /api/notifications route, including an unread count badge.
3. Global search: make the top-nav search query real entities (events by name, participants by name, payments by reference) via a new /api/search route, not just route names.
4. Wire zod schemas + react-hook-form on ALL forms (login, signup, forgot-password, event create/edit, participant create/edit, settings) — proper validation messages, required field enforcement.
5. Fix auth/login/route.ts: role should NOT depend on rememberMe. Always return "Administrator" in mock mode.
6. Fix _store.ts: make initialDashboardSummary.totalParticipants match the actual seeded participants array length.
7. Change payment amount fields from formatted strings ("$320.00") to numeric values with a separate currency field; update all display code to format at render time only.

PHASE 3 — Design modernization
1. Fix globals.css: the glass-panel shadow (rgba(15,23,42,0.45)) needs a dark-mode-aware variant.
2. Replace every native <select> element (Events, Participants, Payments, Settings filters) with the shadcn/ui Select component for visual consistency.
3. Fix the hydration mismatch in components/theme-toggle.tsx — guard the icon render so it doesn't render a theme-dependent icon until mounted client-side (use a mounted state + useEffect pattern).
4. Replace the Sparkles icon on the Google sign-in button with an actual Google "G" logo SVG.
5. Add empty states (illustration + message) to any table/list that could be empty, if not already present.

PHASE 4 — Real-time sync
1. Add a WebSocket or polling mechanism (your choice, prefer polling with a 5-10s interval for simplicity given the timeline) so the Dashboard's vote/revenue counts update without a manual refresh.
2. Make the Social Media Router page's Connect/Disconnect buttons actually call backend endpoints instead of just refetching a static query.

CONSTRAINTS FOR ALL PHASES:
- Don't modify anything not listed above
- Keep using existing component patterns already in the codebase (don't introduce new libraries unless explicitly needed)
- After each phase, summarize exactly which files changed

When all 4 phases are done, run npm run lint and fix anything it reports.




# BACKEND IMPLEMENTATION ROADMAP
## Digital Entertainment Voting Platform

> **Status:** Authentication groundwork has been partially implemented.
> The following features are either incomplete or require redesign before the backend can be considered production-ready.

---

# Phase 1 — Authentication & User Management (Highest Priority)

## 1. Complete Password Reset Flow

### Current State
- Email service exists.
- Reset token generation exists.
- Reset endpoint exists.

### Remaining Work

- Hash reset tokens before storing them.
- Add secure token validation.
- Invalidate previous reset tokens.
- One active reset token per user.
- Add rate limiting.
- Add brute-force protection.
- Store reset request timestamps.
- Prevent user enumeration.
- Queue email sending in background tasks.
- Add email delivery retry mechanism.
- Add frontend reset page integration.

### Intended Flow

Forgot Password

```
User
    ↓
Enter Email
    ↓
Backend
    ↓
Generate Secure Token
    ↓
Hash Token
    ↓
Store Hash + Expiry
    ↓
Send Email
    ↓
User Clicks Link
    ↓
Frontend Reset Page
    ↓
Backend validates token
    ↓
Password Updated
    ↓
Delete Token
```

---

## 2. Single Super Admin Architecture

### Current State

Invitation system exists.

### Remaining Work

The system **must guarantee** there is only ONE Super Admin.

### Requirements

- Bootstrap first super admin only.
- Database uniqueness enforcement.
- No API endpoint to create another Super Admin.
- Super Admin cannot be deleted.
- Super Admin cannot be invalidated.
- Super Admin cannot be demoted accidentally.

### Intended Flow

```
Database

Super Admin
      │
      ├── Invite Admin
      ├── Invite Moderator
      ├── Invalidate Users
      ├── Reset User Accounts
      ├── Assign Roles
      └── View Audit Logs
```

---

## 3. Invitation System

### Remaining Work

Instead of immediate signup:

```
Super Admin
      │
Invite Admin
      │
Generate Invitation
      │
Email Link
      │
Admin Opens Link
      │
Verify Invitation
      │
Verify Email OTP
      │
Create Password
      │
Create PIN
      │
Generate RSA Keys
      │
Activate Account
```

Invitation should expire after 48 hours.

---

# Phase 2 — Account Security

---

## 4. Email Verification

New admins should never become active immediately.

Flow

```
Invitation
      │
Create Password
      │
Receive OTP
      │
Verify OTP
      │
Activate Account
```

---

## 5. PIN Setup

Every administrator should create a PIN.

PIN should be used for

- sensitive actions
- decrypting private key
- approving financial operations

---

## 6. RSA Key Generation

After PIN setup

```
Generate RSA Keys
        │
Private Key
        │
Encrypt using PIN
        │
Store
```

Public key remains public.

Private key remains encrypted.

---

## 7. Session Management

Implement

- Refresh Tokens
- HttpOnly Cookies
- Session Revocation
- Logout everywhere
- Device Tracking

---

## 8. Switch Account

Current implementation does nothing.

Desired

```
User Menu

Switch Account

↓

Logout Current

↓

Select Account

↓

Login

↓

Dashboard
```

No manual clearing of browser state.

---

# Phase 3 — Social Platform Integration

Current status:

Not implemented.

---

## Goals

Support unlimited social platforms.

Architecture

```
Platform Registry

Facebook

Instagram

TikTok

YouTube

Twitter/X

Future Platforms
```

No platform-specific code should exist inside the main application.

Each platform should expose

```
Authenticate()

Sync()

Refresh()

Fetch Posts()

Fetch Engagement()

Disconnect()
```

---

## Social Scheduler

Need background jobs

```
Every X minutes

↓

Check Connected Platforms

↓

Sync Posts

↓

Sync Views

↓

Sync Likes

↓

Sync Comments

↓

Store Metrics
```

---

## Webhooks

Support

Facebook

Instagram

TikTok

YouTube

Webhook updates should avoid polling whenever possible.

---

# Phase 4 — Admin Experience

---

## 1. Logged-in Admin

Frontend should display

```
Welcome,
John Doe
Super Admin
```

Backend should expose

```
GET /me
```

Returning

- id
- name
- role
- avatar
- permissions

---

## 2. User Profile

Admin should manage

- Name
- Avatar
- Password
- PIN
- Email

---

## 3. Admin Dashboard

Show

- Current admin
- Role
- Last login
- Active sessions

---

# Phase 5 — Payment Security

Highest business priority.

---

## 1. Locked Payment Links

Current status

Not implemented.

Desired

```
Backend

↓

Generate Payment Link

↓

Amount Locked

↓

Participant Opens

↓

Cannot Edit Amount

↓

Payment Submitted
```

Only Open Bid events may modify amounts.

---

## 2. Signed Payment Links

Every payment link should contain

- Event ID
- Contestant ID
- Amount
- Expiry
- Signature

Tampering invalidates link.

---

## 3. Expiration

Payment links should expire.

Examples

- 30 minutes
- 1 hour
- configurable

---

## 4. Payment Verification

After callback

Verify

- Amount
- Currency
- Event
- Contestant
- Signature
- Transaction ID

before accepting payment.

---

## 5. Idempotency

Duplicate callbacks should never create duplicate votes.

---

## 6. Fraud Detection

Detect

- repeated callbacks
- replay attacks
- impossible voting speed
- abnormal IP activity
- suspicious payment behaviour

---

# Phase 6 — Super Admin Controls

---

## 1. Invalidate Admin

Current implementation only disables account.

Needs

- immediate session revocation
- logout all devices
- revoke refresh tokens
- prevent API access immediately

---

## 2. Suspend Admin

Temporary disable

```
Suspend

↓

Cannot Login

↓

Can Restore
```

---

## 3. Delete Admin

Soft delete only.

Maintain

- audit logs
- ownership
- payment history

---

## 4. Permissions

Replace role checks with permission checks.

Example

```
Role

↓

Permissions

↓

Endpoint Access
```

---

# Phase 7 — Production Improvements

---

## Background Jobs

Move

- emails
- social sync
- cleanup
- reports

to workers.

---

## Audit Logging

Every action should log

- actor
- target
- timestamp
- IP
- device
- action
- metadata

---

## Health Checks

Expose

```
/health

/database

/storage

/payment

/social
```

---

## Monitoring

Integrate

- Prometheus
- Grafana
- Sentry

---

## Rate Limiting

Protect

- login
- forgot password
- invitations
- payment endpoints

---

## Secrets

Never expose

- SMTP passwords
- JWT secrets
- Paynow keys

Use environment variables only.

---

# Final Production Checklist

- [ ] Password reset fully secured
- [ ] Single Super Admin enforced
- [ ] Invitation workflow completed
- [ ] Email verification implemented
- [ ] PIN setup implemented
- [ ] RSA key generation implemented
- [ ] Refresh token system
- [ ] Session management
- [ ] Unlimited social integrations
- [ ] Social synchronization workers
- [ ] Logged-in admin endpoint
- [ ] Smooth account switching
- [ ] Locked payment links
- [ ] Signed payment URLs
- [ ] Payment verification
- [ ] Fraud detection
- [ ] Immediate admin invalidation
- [ ] Permission-based authorization
- [ ] Background workers
- [ ] Comprehensive audit logging
- [ ] Health endpoints
- [ ] Monitoring & alerting
- [ ] Rate limiting
- [ ] Production security review