import axios, { AxiosError } from "axios"
import type { ApiErrorShape } from "@/lib/types"
import { getAuthToken } from "@/lib/auth"

export const api = axios.create({
  baseURL: "/api",
  headers: {
    "Content-Type": "application/json",
  },
})

// Attaches the stored JWT token to every outgoing request.
api.interceptors.request.use((config) => {
  const token = getAuthToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Converts transport or backend failures into a user-facing error payload.
export function getApiError(error: unknown): ApiErrorShape {
  if (axios.isAxiosError(error)) {
    return normalizeAxiosError(error)
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      hint: "Try again in a moment or refresh the page if the issue persists.",
    }
  }

  return {
    message: "Something unexpected happened while communicating with the admin API.",
    hint: "Refresh the page and retry the action.",
  }
}

// Extracts the most useful backend message while keeping the copy readable.
function normalizeAxiosError(error: AxiosError): ApiErrorShape {
  const response = error.response?.data as Partial<ApiErrorShape> | undefined

  return {
    message:
      response?.message ||
      error.message ||
      "The admin API did not return a usable response.",
    hint:
      response?.hint ||
      "Check that the backend is running and reachable from the frontend.",
    status: error.response?.status,
  }
}
