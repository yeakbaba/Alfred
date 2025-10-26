import * as ImagePicker from "expo-image-picker"
import * as ImageManipulator from "expo-image-manipulator"
import { Image } from "react-native-compressor"

export interface OptimizedImage {
  uri: string
  width: number
  height: number
  size: number // in bytes
  type: string
}

export interface ImageCompressionOptions {
  maxWidth?: number
  maxHeight?: number
  quality?: number // 0-1
  format?: "jpeg" | "png" | "webp"
}

const DEFAULT_OPTIONS: Required<ImageCompressionOptions> = {
  maxWidth: 1920,
  maxHeight: 1920,
  quality: 0.8,
  format: "jpeg",
}

/**
 * Request permission to access photo library
 */
export async function requestImagePermissions(): Promise<boolean> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
  return status === "granted"
}

/**
 * Pick an image from the device library
 */
export async function pickImage(): Promise<ImagePicker.ImagePickerAsset | null> {
  try {
    // Request permissions
    const hasPermission = await requestImagePermissions()
    if (!hasPermission) {
      console.warn("Image library permission denied")
      return null
    }

    // Launch image picker
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: undefined, // Allow any aspect ratio
      quality: 1, // We'll compress it ourselves
      allowsMultipleSelection: false,
    })

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return null
    }

    return result.assets[0]
  } catch (error) {
    console.error("Error picking image:", error)
    return null
  }
}

/**
 * Calculate new dimensions while maintaining aspect ratio
 */
function calculateDimensions(
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number } {
  let width = originalWidth
  let height = originalHeight

  // Check if resize is needed
  if (width <= maxWidth && height <= maxHeight) {
    return { width, height }
  }

  // Calculate scaling factor
  const widthScale = maxWidth / width
  const heightScale = maxHeight / height
  const scale = Math.min(widthScale, heightScale)

  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  }
}

/**
 * Optimize and compress an image WhatsApp-style
 * - Resize to reasonable dimensions (max 1920x1920)
 * - Compress with quality 0.8
 * - Convert to JPEG for smaller file size
 */
export async function optimizeImage(
  imageAsset: ImagePicker.ImagePickerAsset,
  options: ImageCompressionOptions = {},
): Promise<OptimizedImage> {
  try {
    const opts = { ...DEFAULT_OPTIONS, ...options }

    // Calculate new dimensions
    const { width, height } = calculateDimensions(
      imageAsset.width,
      imageAsset.height,
      opts.maxWidth,
      opts.maxHeight,
    )

    console.log(
      `Optimizing image from ${imageAsset.width}x${imageAsset.height} to ${width}x${height}`,
    )

    // Step 1: Resize using ImageManipulator
    const resizedImage = await ImageManipulator.manipulateAsync(
      imageAsset.uri,
      [{ resize: { width, height } }],
      {
        compress: opts.quality,
        format:
          opts.format === "jpeg"
            ? ImageManipulator.SaveFormat.JPEG
            : opts.format === "png"
              ? ImageManipulator.SaveFormat.PNG
              : ImageManipulator.SaveFormat.WEBP,
      },
    )

    // Step 2: Further compress using react-native-compressor
    const compressedUri = await Image.compress(resizedImage.uri, {
      compressionMethod: "auto",
      maxWidth: width,
      maxHeight: height,
      quality: opts.quality,
    })

    // Get file size
    const response = await fetch(compressedUri)
    const blob = await response.blob()
    const size = blob.size

    console.log(`Original size: ${imageAsset.fileSize || "unknown"}, Compressed size: ${size}`)

    return {
      uri: compressedUri,
      width: resizedImage.width,
      height: resizedImage.height,
      size,
      type: `image/${opts.format}`,
    }
  } catch (error) {
    console.error("Error optimizing image:", error)
    throw error
  }
}

/**
 * Generate a thumbnail from an image
 */
export async function generateThumbnail(
  imageUri: string,
  size: number = 200,
): Promise<string> {
  try {
    const thumbnail = await ImageManipulator.manipulateAsync(
      imageUri,
      [{ resize: { width: size, height: size } }],
      {
        compress: 0.7,
        format: ImageManipulator.SaveFormat.JPEG,
      },
    )

    return thumbnail.uri
  } catch (error) {
    console.error("Error generating thumbnail:", error)
    throw error
  }
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes"

  const k = 1024
  const sizes = ["Bytes", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i]
}
