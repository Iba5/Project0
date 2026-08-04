/**
 * Centralized API client for the FastAPI backend.
 *
 * All API calls go through this module so the backend URL is configured
 * in one place. Set NEXT_PUBLIC_API_URL in your .env.local to point
 * to your FastAPI server (e.g. http://localhost:8000).
 *
 * If the variable is not set, it defaults to http://localhost:8000.
 */

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || process.env.BACKEND_API_URL || 'http://localhost:8000/api/v1'

const TOKEN_KEY = 'voting_admin_token'

/**
 * Get the stored JWT token from localStorage.
 * NOTE: This is being phased out in favor of cookie-based refresh tokens.
 * Kept for backward compatibility during transition.
 */
export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

/**
 * Store the JWT token in localStorage.
 * NOTE: This is being phased out in favor of cookie-based refresh tokens.
 * Kept for backward compatibility during transition.
 */
export function storeToken(token: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(TOKEN_KEY, token)
}

/**
 * Clear the stored JWT token from localStorage.
 * NOTE: This is being phased out in favor of cookie-based refresh tokens.
 * Kept for backward compatibility during transition.
 */
export function clearToken(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(TOKEN_KEY)
}

/**
 * Flag to track if a token refresh is in progress
 */
let isRefreshing = false
let refreshSubscribers: Array<(token: string) => void> = []

/**
 * Add a callback to be called when token refresh completes
 */
function subscribeTokenRefresh(callback: (token: string) => void) {
  refreshSubscribers.push(callback)
}

/**
 * Notify all subscribers that token refresh completed
 */
function onTokenRefreshed(token: string) {
  refreshSubscribers.forEach(callback => callback(token))
  refreshSubscribers = []
}

/**
 * Clear all pending subscribers
 */
function clearRefreshSubscribers() {
  refreshSubscribers = []
}

/**
 * Attempt to refresh the access token using the refresh endpoint
 */
async function refreshAccessToken(): Promise<string | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include', // Important for sending cookies
    })

    if (!response.ok) {
      throw new Error('Token refresh failed')
    }

    const data = await response.json()
    const newToken = data.token

    // Update the stored token (for backward compatibility)
    if (newToken) {
      storeToken(newToken)
    }

    return newToken
  } catch (error) {
    console.error('Failed to refresh token:', error)
    clearToken()
    clearRefreshSubscribers()
    return null
  }
}

/**
 * Build a full URL for a FastAPI endpoint.
 * Example: apiUrl('/auth/login') → 'http://localhost:8000/api/v1/auth/login'
 * 
 * Automatically appends trailing slashes for collection endpoints that require them.
 */
export function apiUrl(path: string): string {
  // Ensure the path starts with /
  let normalized = path.startsWith('/') ? path : `/${path}`
  
  // List of collection endpoints that require trailing slashes
  const collectionEndpoints = [
    '/events',
    '/participants',
    '/payments',
    '/dashboard',
    '/settings',
    '/admins',
    '/audit-logs',
    '/social-router',
  ]
  
  // Add trailing slash for collection endpoints if not already present
  for (const endpoint of collectionEndpoints) {
    if (normalized === endpoint) {
      normalized = endpoint + '/'
      break
    }
  }
  
  return `${API_BASE_URL}${normalized}`
}

/**
 * Get the base API URL (useful for WebSocket connections, etc.)
 */
export function getApiBaseUrl(): string {
  return API_BASE_URL
}

/**
 * Convenience fetch wrapper that automatically prepends the FastAPI base URL.
 * Handles JSON responses and throws on non-OK status codes.
 * Automatically includes the JWT Authorization header if available.
 * Implements automatic token refresh on 401 errors.
 */
export async function apiFetch<T = unknown>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const headers = new Headers(options?.headers || {})
  
  // Add JSON content type only for methods that have a body
  const method = options?.method || 'GET'
  if (method !== 'GET' && method !== 'HEAD' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  
  // Add Authorization header with stored token if available
  const token = getStoredToken()
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  
  const res = await fetch(apiUrl(path), {
    ...options,
    headers,
    credentials: 'include', // Important for sending cookies
  })

  // Parse JSON response, handle non-JSON responses
  let data
  const contentType = res.headers.get('content-type')
  if (contentType && contentType.includes('application/json')) {
    data = await res.json()
  } else {
    data = await res.text()
  }

  // Handle 401 errors with automatic token refresh
  if (res.status === 401 && !isRefreshing) {
    isRefreshing = true
    
    try {
      const newToken = await refreshAccessToken()
      
      if (newToken) {
        isRefreshing = false
        onTokenRefreshed(newToken)
        
        // Retry the original request with the new token
        const retryHeaders = new Headers(options?.headers || {})
        const retryMethod = options?.method || 'GET'
        if (retryMethod !== 'GET' && retryMethod !== 'HEAD' && !retryHeaders.has('Content-Type')) {
          retryHeaders.set('Content-Type', 'application/json')
        }
        retryHeaders.set('Authorization', `Bearer ${newToken}`)
        
        const retryRes = await fetch(apiUrl(path), {
          ...options,
          headers: retryHeaders,
          credentials: 'include',
        })
        
        // Parse JSON response, handle non-JSON responses
        let retryData
        const retryContentType = retryRes.headers.get('content-type')
        if (retryContentType && retryContentType.includes('application/json')) {
          retryData = await retryRes.json()
        } else {
          retryData = await retryRes.text()
        }
        
        if (!retryRes.ok) {
          const errorMessage = typeof retryData === 'string' ? retryData : (retryData?.detail || retryData?.error || retryData?.message || `Request failed with status ${retryRes.status}`)
          throw new Error(errorMessage)
        }
        
        return retryData as T
      } else {
        // Token refresh failed, throw error to let UI handle it
        isRefreshing = false
        clearRefreshSubscribers()
        throw new Error('Authentication failed. Please login again.')
      }
    } catch (refreshError) {
      isRefreshing = false
      clearRefreshSubscribers()
      // Throw error to let UI handle auth failure
      throw new Error('Authentication failed. Please login again.')
    }
  } else if (res.status === 401 && isRefreshing) {
    // If already refreshing, wait for the refresh to complete
    return new Promise((resolve, reject) => {
      subscribeTokenRefresh((token: string) => {
        const retryHeaders = new Headers(options?.headers || {})
        const retryMethod = options?.method || 'GET'
        if (retryMethod !== 'GET' && retryMethod !== 'HEAD' && !retryHeaders.has('Content-Type')) {
          retryHeaders.set('Content-Type', 'application/json')
        }
        retryHeaders.set('Authorization', `Bearer ${token}`)
        
        fetch(apiUrl(path), {
          ...options,
          headers: retryHeaders,
          credentials: 'include',
        })
          .then(async retryRes => {
            // Parse JSON response, handle non-JSON responses
            let retryData
            const retryContentType = retryRes.headers.get('content-type')
            if (retryContentType && retryContentType.includes('application/json')) {
              retryData = await retryRes.json()
            } else {
              retryData = await retryRes.text()
            }
            
            if (!retryRes.ok) {
              const errorMessage = typeof retryData === 'string' ? retryData : (retryData?.detail || retryData?.error || retryData?.message || `Request failed with status ${retryRes.status}`)
              reject(new Error(errorMessage))
            } else {
              resolve(retryData as T)
            }
          })
          .catch(reject)
      })
    })
  }

  if (!res.ok) {
    const errorMessage = typeof data === 'string' ? data : (data?.detail || data?.error || data?.message || `Request failed with status ${res.status}`)
    throw new Error(errorMessage)
  }

  return data as T
}

/**
 * Upload a file to the FastAPI backend (multipart/form-data).
 */
export async function apiUpload<T = unknown>(
  path: string,
  formData: FormData,
): Promise<T> {
  const headers = new Headers()
  
  // Add Authorization header with stored token if available
  const token = getStoredToken()
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  
  const res = await fetch(apiUrl(path), {
    method: 'POST',
    body: formData,
    headers,
    credentials: 'include', // Important for sending cookies
    // Do NOT set Content-Type — browser sets it with boundary for FormData
  })

  // Parse JSON response, handle non-JSON responses
  let data
  const contentType = res.headers.get('content-type')
  if (contentType && contentType.includes('application/json')) {
    data = await res.json()
  } else {
    data = await res.text()
  }

  if (!res.ok) {
    const errorMessage = typeof data === 'string' ? data : (data?.detail || data?.error || data?.message || `Upload failed with status ${res.status}`)
    throw new Error(errorMessage)
  }

  return data as T
}
