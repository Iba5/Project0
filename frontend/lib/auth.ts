import type { AuthResult } from "@/lib/types"

const TOKEN_COOKIE = "auth-token"
const USER_COOKIE = "auth-user"
const MAX_AGE = 60 * 60 * 24 * 7 // 7 days

// Saves the token and user from a login/signup response into cookies.
export function setAuth(result: AuthResult) {
  document.cookie = `${TOKEN_COOKIE}=${encodeURIComponent(result.token)}; path=/; max-age=${MAX_AGE}; SameSite=Lax`
  document.cookie = `${USER_COOKIE}=${encodeURIComponent(JSON.stringify(result.user))}; path=/; max-age=${MAX_AGE}; SameSite=Lax`
}

// Reads the auth token from cookies on the client side.
export function getAuthToken(): string | null {
  if (typeof document === "undefined") return null
  const match = document.cookie.match(new RegExp(`(?:^|; )${TOKEN_COOKIE}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

// Clears the auth cookies by expiring them immediately.
export function clearAuth() {
  document.cookie = `${TOKEN_COOKIE}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0; SameSite=Lax`
  document.cookie = `${USER_COOKIE}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0; SameSite=Lax`
}
