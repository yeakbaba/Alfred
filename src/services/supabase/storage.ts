import type { StorageError, FileObject } from "@supabase/supabase-js"
import * as FileSystem from "expo-file-system"

import { supabase } from "./supabaseClient"

/**
 * Storage Service
 * Helper functions for file storage operations
 */

export interface StorageUploadResponse {
  path: string | null
  error: StorageError | null
}

export interface StorageDownloadResponse {
  data: Blob | null
  error: StorageError | null
}

export interface StorageListResponse {
  data: FileObject[] | null
  error: StorageError | null
}

/**
 * Upload a file to storage
 * @param bucket - Bucket name
 * @param path - File path in the bucket
 * @param file - File to upload (can be File, Blob, or ArrayBuffer)
 * @param options - Upload options
 */
export async function uploadFile(
  bucket: string,
  path: string,
  file: File | Blob | ArrayBuffer,
  options?: {
    cacheControl?: string
    contentType?: string
    upsert?: boolean
  },
): Promise<StorageUploadResponse> {
  const { data, error } = await supabase.storage.from(bucket).upload(path, file, options)

  return { path: data?.path ?? null, error }
}

/**
 * Upload a file with a unique name (UUID)
 * @param bucket - Bucket name
 * @param file - File to upload
 * @param folder - Optional folder path
 * @param options - Upload options
 */
export async function uploadFileWithUUID(
  bucket: string,
  file: File | Blob | ArrayBuffer,
  folder?: string,
  options?: {
    cacheControl?: string
    contentType?: string
  },
): Promise<StorageUploadResponse> {
  const uuid = crypto.randomUUID()
  const extension = file instanceof File ? file.name.split(".").pop() : ""
  const fileName = extension ? `${uuid}.${extension}` : uuid
  const path = folder ? `${folder}/${fileName}` : fileName

  return uploadFile(bucket, path, file, options)
}

/**
 * Download a file from storage
 * @param bucket - Bucket name
 * @param path - File path in the bucket
 */
export async function downloadFile(
  bucket: string,
  path: string,
): Promise<StorageDownloadResponse> {
  const { data, error } = await supabase.storage.from(bucket).download(path)

  return { data, error }
}

/**
 * Get public URL for a file
 * @param bucket - Bucket name
 * @param path - File path in the bucket
 * @returns Public URL string
 */
export function getPublicUrl(bucket: string, path: string): string {
  const {
    data: { publicUrl },
  } = supabase.storage.from(bucket).getPublicUrl(path)

  return publicUrl
}

/**
 * Create a signed URL for private file access
 * @param bucket - Bucket name
 * @param path - File path in the bucket
 * @param expiresIn - Expiration time in seconds (default: 60)
 */
export async function createSignedUrl(
  bucket: string,
  path: string,
  expiresIn = 60,
): Promise<{ signedUrl: string | null; error: StorageError | null }> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn)

  return { signedUrl: data?.signedUrl ?? null, error }
}

/**
 * Create signed URLs for multiple files
 * @param bucket - Bucket name
 * @param paths - Array of file paths
 * @param expiresIn - Expiration time in seconds (default: 60)
 */
export async function createSignedUrls(
  bucket: string,
  paths: string[],
  expiresIn = 60,
): Promise<{
  data: Array<{ path: string; signedUrl: string }> | null
  error: StorageError | null
}> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrls(paths, expiresIn)

  return { data, error }
}

/**
 * List files in a bucket
 * @param bucket - Bucket name
 * @param path - Folder path (optional)
 * @param options - List options
 */
export async function listFiles(
  bucket: string,
  path?: string,
  options?: {
    limit?: number
    offset?: number
    sortBy?: { column: string; order: "asc" | "desc" }
  },
): Promise<StorageListResponse> {
  const { data, error } = await supabase.storage.from(bucket).list(path, options)

  return { data, error }
}

/**
 * Delete a file from storage
 * @param bucket - Bucket name
 * @param path - File path to delete
 */
export async function deleteFile(
  bucket: string,
  path: string,
): Promise<{ error: StorageError | null }> {
  const { error } = await supabase.storage.from(bucket).remove([path])

  return { error }
}

/**
 * Delete multiple files from storage
 * @param bucket - Bucket name
 * @param paths - Array of file paths to delete
 */
export async function deleteFiles(
  bucket: string,
  paths: string[],
): Promise<{ error: StorageError | null }> {
  const { error } = await supabase.storage.from(bucket).remove(paths)

  return { error }
}

/**
 * Move a file to a new location
 * @param bucket - Bucket name
 * @param fromPath - Current file path
 * @param toPath - New file path
 */
export async function moveFile(
  bucket: string,
  fromPath: string,
  toPath: string,
): Promise<{ error: StorageError | null }> {
  const { error } = await supabase.storage.from(bucket).move(fromPath, toPath)

  return { error }
}

/**
 * Copy a file to a new location
 * @param bucket - Bucket name
 * @param fromPath - Source file path
 * @param toPath - Destination file path
 */
export async function copyFile(
  bucket: string,
  fromPath: string,
  toPath: string,
): Promise<{ error: StorageError | null }> {
  const { error } = await supabase.storage.from(bucket).copy(fromPath, toPath)

  return { error }
}

/**
 * Create a new storage bucket
 * @param bucketId - Bucket ID/name
 * @param options - Bucket options
 */
export async function createBucket(
  bucketId: string,
  options?: {
    public?: boolean
    fileSizeLimit?: number
    allowedMimeTypes?: string[]
  },
): Promise<{ data: { name: string } | null; error: StorageError | null }> {
  const { data, error } = await supabase.storage.createBucket(bucketId, options)

  return { data, error }
}

/**
 * Delete a storage bucket
 * @param bucketId - Bucket ID/name
 */
export async function deleteBucket(
  bucketId: string,
): Promise<{ error: StorageError | null }> {
  const { error } = await supabase.storage.deleteBucket(bucketId)

  return { error }
}

/**
 * Empty a storage bucket (delete all files)
 * @param bucketId - Bucket ID/name
 */
export async function emptyBucket(bucketId: string): Promise<{ error: StorageError | null }> {
  const { error } = await supabase.storage.emptyBucket(bucketId)

  return { error }
}

// ============================================================================
// Chat Image Specific Functions
// ============================================================================

const CHAT_IMAGES_BUCKET = "chat-images"

export interface UploadChatImageResult {
  url: string
  path: string
  error: StorageError | null
}

/**
 * Upload a chat image from local file URI
 * @param uri - Local file URI (from image picker or camera)
 * @param userId - User ID for organizing files
 * @param chatId - Chat ID for organizing files
 */
export async function uploadChatImage(
  uri: string,
  userId: string,
  chatId: string,
): Promise<UploadChatImageResult> {
  try {
    // Generate unique filename
    const timestamp = Date.now()
    const fileName = `${userId}/${chatId}/${timestamp}.jpg`

    // Read file as base64
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    })

    // Convert base64 to ArrayBuffer
    const byteCharacters = atob(base64)
    const byteNumbers = new Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }
    const byteArray = new Uint8Array(byteNumbers)
    const blob = new Blob([byteArray], { type: "image/jpeg" })

    // Upload to Supabase storage
    const { data, error } = await supabase.storage
      .from(CHAT_IMAGES_BUCKET)
      .upload(fileName, blob, {
        contentType: "image/jpeg",
        cacheControl: "3600",
        upsert: false,
      })

    if (error) {
      console.error("Supabase upload error:", error)
      return { url: "", path: "", error }
    }

    // Get public URL
    const publicUrl = getPublicUrl(CHAT_IMAGES_BUCKET, data.path)

    console.log("Image uploaded successfully:", publicUrl)

    return {
      url: publicUrl,
      path: data.path,
      error: null,
    }
  } catch (error) {
    console.error("Error uploading chat image:", error)
    return {
      url: "",
      path: "",
      error: error as StorageError,
    }
  }
}

/**
 * Delete a chat image
 * @param path - File path in storage
 */
export async function deleteChatImage(path: string): Promise<{ error: StorageError | null }> {
  return deleteFile(CHAT_IMAGES_BUCKET, path)
}

/**
 * Get public URL for a chat image
 * @param path - File path in storage
 */
export function getChatImageUrl(path: string): string {
  return getPublicUrl(CHAT_IMAGES_BUCKET, path)
}

/**
 * List all images for a specific chat
 * @param userId - User ID
 * @param chatId - Chat ID
 */
export async function listChatImages(
  userId: string,
  chatId: string,
): Promise<StorageListResponse> {
  return listFiles(CHAT_IMAGES_BUCKET, `${userId}/${chatId}`, {
    limit: 100,
    offset: 0,
    sortBy: { column: "created_at", order: "desc" },
  })
}
