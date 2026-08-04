// Client-side image upload helper.
// Uploads to the FastAPI backend via the centralized client.

import { apiUrl, apiUpload } from './api-client'

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

  return apiUpload<UploadResult>('/upload', formData)
}
