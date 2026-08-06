// Client-side fetch helpers for participant vote-history analytics.
// All calls go through the centralized FastAPI backend client.

import { apiFetch } from './api-client'

export interface VoteHistoryPoint {
  date: string // YYYY-MM-DD
  votes: number
  cumulative: number
}

/**
 * Fetch the daily-aggregated vote history for a participant.
 * Supports a `days` parameter (7 or 30, default 30).
 * Returns `{ history: VoteHistoryPoint[] }` (may be empty if no data).
 * Throws on non-OK responses (e.g. 404 when participant is not found).
 */
export async function getParticipantVoteHistory(
  id: string,
  days: 7 | 30 = 30,
): Promise<{ history: VoteHistoryPoint[] }> {
  return apiFetch(`/participants/public/${id}/vote-history?days=${days}`)
}
