// Client-side fetch helpers for admin audit logs.
// All calls go through the centralized FastAPI backend client.

import { apiFetch } from './api-client'

export interface AuditLogEntry {
  id: string
  action: string
  ipAddress: string | null
  details: string | null
  timestamp: string
  user: { id: string; name: string; email: string; role: string } | null
}

export interface ListAuditLogsOptions {
  limit?: number
  offset?: number
  action?: string
}

/**
 * Fetch a paginated list of audit logs from the admin-only API.
 * Throws if the response is not OK (e.g. 401 Unauthorized).
 */
export async function listAuditLogs(
  opts?: ListAuditLogsOptions,
): Promise<{ logs: AuditLogEntry[] }> {
  const searchParams = new URLSearchParams()
  if (opts?.limit !== undefined) searchParams.set('limit', String(opts.limit))
  if (opts?.offset !== undefined) searchParams.set('offset', String(opts.offset))
  if (opts?.action) searchParams.set('action', opts.action)

  const qs = searchParams.toString()
  return apiFetch(`/audit-logs${qs ? `?${qs}` : ''}`)
}
