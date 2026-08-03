// Client-side image upload helper.
// Uploads to the FastAPI backend via the centralized client.

import { apiUrl } from './api-client'

export interface UploadResult {
  url: string
  fileName: string
}

/**
 * Upload an image File to the FastAPI backend.
 * Returns the public URL and the generated file name on success.
 * Throws on non-OK responses.
 */
export async function uploadImage(file: File): Promise<UploadResult> {
  const formData = new FormData()
  formData.append('image', file)
  formData.append('fileName', file.name)

  const res = await fetch(apiUrl('/upload'), {
    method: 'POST',
    body: formData,
    credentials: 'include', // Important for sending httpOnly cookies
    // Do NOT set Content-Type — browser sets it with boundary for FormData
  })

  const data = await res.json()
  if (!res.ok) {
    throw new Error(data?.detail || data?.error || 'Failed to upload image')
  }

  return data as UploadResult
}
