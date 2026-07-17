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