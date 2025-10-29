import React, { useState, useEffect } from "react"
import { View, ViewStyle, Linking, Pressable, Image, ActivityIndicator, Text as RNText } from "react-native"
import Markdown from "react-native-markdown-display"
import { Text } from "@/components/Text"
import { ImageViewModal } from "@/components/ImageViewModal"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

interface MessageContentProps {
  content: string
  contentType?: "text" | "image" | "video" | "audio" | "file" | "location" | "contact" | "poll"
  isOwnMessage: boolean
  isAlfred: boolean
}

interface URLPreview {
  url: string
  title?: string
  description?: string
  image?: string
  siteName?: string
}

// URL regex pattern
const URL_REGEX = /(https?:\/\/[^\s]+)/g

/**
 * Extract URLs from text content
 */
const extractURLs = (text: string): string[] => {
  const matches = text.match(URL_REGEX)
  return matches || []
}

/**
 * Fetch URL metadata for preview
 */
const fetchURLPreview = async (url: string): Promise<URLPreview | null> => {
  try {
    // Use a simple metadata extraction service
    // For production, you might want to use your own backend service
    const response = await fetch(
      `https://api.microlink.io/?url=${encodeURIComponent(url)}&screenshot=false&video=false`
    )
    const data = await response.json()

    if (data.status === "success" && data.data) {
      return {
        url,
        title: data.data.title,
        description: data.data.description,
        image: data.data.image?.url,
        siteName: data.data.publisher,
      }
    }
    return null
  } catch (error) {
    console.error("Error fetching URL preview:", error)
    return null
  }
}

/**
 * Component to render URL preview card
 */
const URLPreviewCard: React.FC<{
  preview: URLPreview
  isOwnMessage: boolean
  onPress: () => void
}> = ({ preview, isOwnMessage, onPress }) => {
  const { themed, theme } = useAppTheme()

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        themed($previewCard),
        {
          backgroundColor: isOwnMessage
            ? theme.colors.palette.neutral100
            : theme.colors.palette.neutral200,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      {preview.image && (
        <Image
          source={{ uri: preview.image }}
          style={themed($previewImage)}
          resizeMode="cover"
        />
      )}
      <View style={themed($previewContent)}>
        {preview.siteName && (
          <Text
            text={preview.siteName}
            style={[
              themed($previewSiteName),
              { color: theme.colors.textDim },
            ]}
            numberOfLines={1}
          />
        )}
        {preview.title && (
          <Text
            text={preview.title}
            style={[
              themed($previewTitle),
              { color: isOwnMessage ? theme.colors.palette.neutral800 : theme.colors.text },
            ]}
            numberOfLines={2}
          />
        )}
        {preview.description && (
          <Text
            text={preview.description}
            style={[
              themed($previewDescription),
              { color: theme.colors.textDim },
            ]}
            numberOfLines={2}
          />
        )}
      </View>
    </Pressable>
  )
}

/**
 * Component to render message content with markdown and URL previews
 */
export const MessageContent: React.FC<MessageContentProps> = ({
  content,
  contentType = "text",
  isOwnMessage,
  isAlfred,
}) => {
  const { themed, theme } = useAppTheme()
  const [urlPreviews, setUrlPreviews] = useState<URLPreview[]>([])
  const [isLoadingPreviews, setIsLoadingPreviews] = useState(false)
  const [imageLoading, setImageLoading] = useState(contentType === "image")
  const [imageError, setImageError] = useState(false)
  const [showImageModal, setShowImageModal] = useState(false)

  // Reset image loading state when content changes
  useEffect(() => {
    if (contentType === "image") {
      console.log("Resetting image loading state for:", content)
      setImageLoading(true)
      setImageError(false)

      // Fallback: Force hide loading after 10 seconds
      const timeout = setTimeout(() => {
        console.log("[Image] Timeout reached, forcing loading to false")
        setImageLoading(false)
      }, 10000)

      return () => clearTimeout(timeout)
    }
  }, [content, contentType])

  // Debug: Log state changes
  useEffect(() => {
    console.log("ImageLoading state changed:", imageLoading, "for content:", content?.substring(0, 50))
  }, [imageLoading])

  useEffect(() => {
    // Only load URL previews for text messages
    if (contentType !== "text") return

    const loadURLPreviews = async () => {
      const urls = extractURLs(content)

      if (urls.length === 0) return

      setIsLoadingPreviews(true)

      // Fetch previews for all URLs (limit to first 3 to avoid too many requests)
      const previewPromises = urls.slice(0, 3).map((url) => fetchURLPreview(url))
      const previews = await Promise.all(previewPromises)

      // Filter out null previews
      const validPreviews = previews.filter((p): p is URLPreview => p !== null)
      setUrlPreviews(validPreviews)
      setIsLoadingPreviews(false)
    }

    loadURLPreviews()
  }, [content, contentType])

  const handleURLPress = (url: string) => {
    Linking.openURL(url).catch((err) => {
      console.error("Failed to open URL:", err)
    })
  }

  // Custom link renderer to ensure links are clickable
  const renderLink = (node: any, children: any, parent: any, styles: any) => {
    const href = node.attributes?.href || ""
    return (
      <RNText
        key={node.key}
        style={[
          styles.link,
          {
            color: isOwnMessage ? theme.colors.palette.accent300 : theme.colors.tint,
            textDecorationLine: "underline",
          },
        ]}
        onPress={() => {
          console.log("Link pressed:", href)
          handleURLPress(href)
        }}
      >
        {children}
      </RNText>
    )
  }

  // Custom text renderer to make plain URLs clickable
  const renderText = (node: any, children: any, parent: any, styles: any) => {
    const text = node.content
    const urls = text.match(URL_REGEX)

    if (!urls) {
      return <RNText key={node.key} style={styles.text}>{text}</RNText>
    }

    // Split text by URLs and render them as clickable links
    const parts: any[] = []
    let lastIndex = 0

    urls.forEach((url: string, urlIdx: number) => {
      const urlIndex = text.indexOf(url, lastIndex)

      // Add text before URL
      if (urlIndex > lastIndex) {
        parts.push(
          <RNText key={`text-before-${urlIdx}`}>
            {text.substring(lastIndex, urlIndex)}
          </RNText>
        )
      }

      // Add clickable URL
      parts.push(
        <RNText
          key={`url-${urlIdx}`}
          style={{
            color: isOwnMessage ? theme.colors.palette.accent300 : theme.colors.tint,
            textDecorationLine: "underline",
          }}
          onPress={() => {
            console.log("Plain URL pressed:", url)
            handleURLPress(url)
          }}
        >
          {url}
        </RNText>
      )

      lastIndex = urlIndex + url.length
    })

    // Add remaining text after last URL
    if (lastIndex < text.length) {
      parts.push(
        <RNText key="text-after">
          {text.substring(lastIndex)}
        </RNText>
      )
    }

    return <RNText key={node.key} style={styles.text}>{parts}</RNText>
  }

  // Markdown styles based on message type
  const markdownStyles = {
    body: {
      color: isOwnMessage ? theme.colors.palette.neutral100 : theme.colors.text,
      fontSize: 15,
      lineHeight: 20,
      fontFamily: theme.typography.primary.normal,
    },
    paragraph: {
      marginTop: 0,
      marginBottom: 8,
      flexWrap: "wrap",
      flexDirection: "row",
      alignItems: "flex-start",
    },
    text: {
      color: isOwnMessage ? theme.colors.palette.neutral100 : theme.colors.text,
      fontSize: 15,
      lineHeight: 20,
      fontFamily: theme.typography.primary.normal,
    },
    strong: {
      fontFamily: theme.typography.primary.semiBold,
      fontWeight: "600",
    },
    em: {
      fontStyle: "italic",
      fontFamily: theme.typography.primary.normal,
    },
    code_inline: {
      backgroundColor: isOwnMessage
        ? "rgba(255,255,255,0.2)"
        : theme.colors.palette.neutral300,
      color: isOwnMessage ? theme.colors.palette.neutral100 : theme.colors.text,
      paddingHorizontal: 4,
      paddingVertical: 2,
      borderRadius: 4,
      fontFamily: theme.typography.code?.normal || "Courier",
      fontSize: 14,
    },
    code_block: {
      backgroundColor: isOwnMessage
        ? "rgba(255,255,255,0.15)"
        : theme.colors.palette.neutral300,
      color: isOwnMessage ? theme.colors.palette.neutral100 : theme.colors.text,
      padding: 12,
      borderRadius: 8,
      fontFamily: theme.typography.code?.normal || "Courier",
      fontSize: 13,
      lineHeight: 18,
      marginTop: 8,
      marginBottom: 8,
    },
    fence: {
      backgroundColor: isOwnMessage
        ? "rgba(255,255,255,0.15)"
        : theme.colors.palette.neutral300,
      color: isOwnMessage ? theme.colors.palette.neutral100 : theme.colors.text,
      padding: 12,
      borderRadius: 8,
      fontFamily: theme.typography.code?.normal || "Courier",
      fontSize: 13,
      lineHeight: 18,
      marginTop: 8,
      marginBottom: 8,
    },
    link: {
      color: isOwnMessage ? theme.colors.palette.accent300 : theme.colors.tint,
      textDecorationLine: "underline",
    },
    list_item: {
      marginTop: 4,
      marginBottom: 4,
      flexDirection: "row",
    },
    bullet_list: {
      marginTop: 4,
      marginBottom: 8,
    },
    ordered_list: {
      marginTop: 4,
      marginBottom: 8,
    },
    heading1: {
      fontSize: 20,
      lineHeight: 26,
      fontFamily: theme.typography.primary.bold,
      fontWeight: "bold",
      marginTop: 12,
      marginBottom: 8,
    },
    heading2: {
      fontSize: 18,
      lineHeight: 24,
      fontFamily: theme.typography.primary.semiBold,
      fontWeight: "600",
      marginTop: 10,
      marginBottom: 6,
    },
    heading3: {
      fontSize: 16,
      lineHeight: 22,
      fontFamily: theme.typography.primary.semiBold,
      fontWeight: "600",
      marginTop: 8,
      marginBottom: 4,
    },
    blockquote: {
      backgroundColor: isOwnMessage
        ? "rgba(255,255,255,0.1)"
        : theme.colors.palette.neutral200,
      borderLeftWidth: 4,
      borderLeftColor: isOwnMessage ? theme.colors.palette.accent300 : theme.colors.tint,
      paddingLeft: 12,
      paddingVertical: 8,
      marginVertical: 8,
    },
  }

  // Render image message
  if (contentType === "image") {
    // Check if content has caption (format: "url\ncaption")
    const parts = content.split("\n")
    const imageUrl = parts[0]
    const caption = parts.length > 1 ? parts.slice(1).join("\n") : null

    return (
      <>
        <View style={themed($imageContainer)}>
          <Pressable onPress={() => setShowImageModal(true)}>
            {imageError ? (
              <View style={themed($imageErrorContainer)}>
                <Text text="Failed to load image" style={{ color: theme.colors.error }} />
              </View>
            ) : (
              <View style={{ position: "relative" }}>
                <Image
                  source={{ uri: imageUrl }}
                  style={themed($messageImage)}
                  resizeMode="contain"
                  onLoadStart={() => {
                    console.log("[Image] Load started:", imageUrl)
                    setImageLoading(true)
                    setImageError(false)
                  }}
                  onLoadEnd={() => {
                    console.log("[Image] Load ended:", imageUrl)
                    setImageLoading(false)
                  }}
                  onLoad={() => {
                    console.log("[Image] onLoad called:", imageUrl)
                    setImageLoading(false)
                  }}
                  onError={(e) => {
                    console.error("[Image] Load error:", imageUrl, e.nativeEvent.error)
                    setImageLoading(false)
                    setImageError(true)
                  }}
                />
                {imageLoading && !imageError && (
                  <View style={themed($imageLoadingContainer)}>
                    <ActivityIndicator size="large" color={theme.colors.tint} />
                    <RNText style={{ color: "white", marginTop: 8, fontSize: 12 }}>
                      Loading...
                    </RNText>
                  </View>
                )}
              </View>
            )}
          </Pressable>

          {/* Caption */}
          {caption && (
            <View style={themed($captionContainer)}>
              <Text
                text={caption}
                style={{
                  color: isOwnMessage ? theme.colors.palette.neutral100 : theme.colors.text,
                  fontSize: 14,
                }}
              />
            </View>
          )}
        </View>

        {/* Full screen image modal */}
        <ImageViewModal
          visible={showImageModal}
          imageUri={imageUrl}
          onClose={() => setShowImageModal(false)}
        />
      </>
    )
  }

  // Render text message with markdown and URL previews
  return (
    <View>
      {/* Render markdown content */}
      <Markdown
        style={markdownStyles}
        rules={{
          link: renderLink,
          text: renderText,
        }}
      >
        {content}
      </Markdown>

      {/* Render URL previews */}
      {isLoadingPreviews && (
        <View style={themed($previewLoadingContainer)}>
          <ActivityIndicator size="small" color={theme.colors.textDim} />
        </View>
      )}

      {urlPreviews.length > 0 && (
        <View style={themed($previewsContainer)}>
          {urlPreviews.map((preview, index) => (
            <URLPreviewCard
              key={`${preview.url}-${index}`}
              preview={preview}
              isOwnMessage={isOwnMessage}
              onPress={() => handleURLPress(preview.url)}
            />
          ))}
        </View>
      )}
    </View>
  )
}

// Styles
const $previewsContainer: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginTop: spacing.xs,
  gap: spacing.xs,
})

const $previewCard: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  borderRadius: 8,
  overflow: "hidden",
  borderWidth: 1,
  borderColor: "rgba(0, 0, 0, 0.1)",
})

const $previewImage: ThemedStyle<any> = () => ({
  width: "100%",
  height: 120,
  backgroundColor: "#f0f0f0",
})

const $previewContent: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  padding: spacing.sm,
  gap: spacing.xxs,
})

const $previewSiteName: ThemedStyle<any> = () => ({
  fontSize: 11,
  textTransform: "uppercase",
})

const $previewTitle: ThemedStyle<any> = () => ({
  fontSize: 14,
  fontWeight: "600",
})

const $previewDescription: ThemedStyle<any> = () => ({
  fontSize: 12,
})

const $previewLoadingContainer: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginTop: spacing.xs,
  alignItems: "center",
  padding: spacing.xs,
})

const $imageContainer: ThemedStyle<ViewStyle> = () => ({
  width: "100%",
  maxWidth: 280,
  borderRadius: 12,
  overflow: "hidden",
})

const $messageImage: ThemedStyle<any> = () => ({
  width: "100%",
  aspectRatio: 4 / 3,
  minHeight: 150,
  maxHeight: 300,
  borderRadius: 12,
})

const $imageLoadingContainer: ThemedStyle<ViewStyle> = () => ({
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  justifyContent: "center",
  alignItems: "center",
  backgroundColor: "rgba(0,0,0,0.1)",
})

const $imageErrorContainer: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  padding: spacing.md,
  justifyContent: "center",
  alignItems: "center",
  backgroundColor: "rgba(255,0,0,0.1)",
  borderRadius: 12,
})

const $captionContainer: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginTop: spacing.xs,
  paddingTop: spacing.xs,
})
