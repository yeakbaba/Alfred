import React, { useState, useEffect } from "react"
import { View, ViewStyle, Linking, Pressable, Image, ActivityIndicator, Text as RNText } from "react-native"
import Markdown from "react-native-markdown-display"
import { Text } from "@/components/Text"
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
  const [imageLoading, setImageLoading] = useState(true)
  const [imageError, setImageError] = useState(false)

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
      fontSize: 14,
      fontFamily: theme.typography.primary.normal,
    },
    paragraph: {
      marginTop: 0,
      marginBottom: 4,
    },
    strong: {
      fontFamily: theme.typography.primary.semiBold,
    },
    em: {
      fontStyle: "italic",
    },
    code_inline: {
      backgroundColor: isOwnMessage
        ? theme.colors.palette.neutral200
        : theme.colors.palette.neutral300,
      color: theme.colors.text,
      padding: 2,
      borderRadius: 4,
      fontFamily: theme.typography.code.normal,
      fontSize: 13,
    },
    code_block: {
      backgroundColor: isOwnMessage
        ? theme.colors.palette.neutral200
        : theme.colors.palette.neutral300,
      color: theme.colors.text,
      padding: 8,
      borderRadius: 8,
      fontFamily: theme.typography.code.normal,
      fontSize: 13,
      marginTop: 4,
      marginBottom: 4,
    },
    link: {
      color: isOwnMessage ? theme.colors.palette.accent300 : theme.colors.tint,
      textDecorationLine: "underline",
    },
    list_item: {
      marginTop: 2,
      marginBottom: 2,
    },
  }

  // Render image message
  if (contentType === "image") {
    return (
      <View style={themed($imageContainer)}>
        <Pressable onPress={() => handleURLPress(content)}>
          {imageLoading && (
            <View style={themed($imageLoadingContainer)}>
              <ActivityIndicator size="small" color={theme.colors.textDim} />
            </View>
          )}
          {imageError ? (
            <View style={themed($imageErrorContainer)}>
              <Text text="Failed to load image" style={{ color: theme.colors.error }} />
            </View>
          ) : (
            <Image
              source={{ uri: content }}
              style={themed($messageImage)}
              resizeMode="cover"
              onLoadStart={() => setImageLoading(true)}
              onLoadEnd={() => setImageLoading(false)}
              onError={() => {
                setImageLoading(false)
                setImageError(true)
              }}
            />
          )}
        </Pressable>
      </View>
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
  borderRadius: 12,
  overflow: "hidden",
})

const $messageImage: ThemedStyle<any> = () => ({
  width: "100%",
  height: 200,
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
