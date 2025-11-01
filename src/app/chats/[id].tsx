import { useEffect, useRef, useState } from "react"
import {
  FlatList,
  View,
  ViewStyle,
  TextInput,
  Pressable,
  Text as RNText,
  Alert,
  Modal,
  Image,
  ImageStyle,
  Animated,
  Easing,
  ActivityIndicator,
  ScrollView,
} from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { MaterialCommunityIcons } from "@expo/vector-icons"

import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { MessageContent } from "@/components/MessageContent"
import { useAuth } from "@/hooks/useAuth"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"
import { pickImage, optimizeImage } from "@/utils/imageOptimization"
import { uploadChatImage } from "@/services/supabase/storage"
import {
  fetchSingleFromTable,
  fetchFromTable,
  executeQuery,
  getProfile,
  getMessagesForChat,
  sendMessage as sendMessageToSupabase,
  markMessagesAsRead,
  type Message,
  subscribeToInserts,
  subscribeToUpdates,
  hasUserConnectionsForChat,
  hasChatContextCache,
} from "@/services/supabase"
import { AgentSelector } from "@/components/AgentSelector"
import { MentionAutocomplete } from "@/components/MentionAutocomplete"
import { processMessageWithAlfred, initializeChatContext } from "@/services/api/neo4j"
import { DEFAULT_AGENT, type Agent, getAgentByUsername } from "@/config/agents"

interface ChatMessage {
  id: string
  sender_id: string
  sender_name?: string
  content: string
  content_type?: "text" | "image" | "video" | "audio" | "file" | "location" | "contact" | "poll"
  created_at: string
  status: "sending" | "sent" | "delivered" | "read" | "failed"
  sender_type: "user" | "alfred" | "system"
  isTyping?: boolean // For Alfred's typing indicator
}

interface ChatParticipant {
  id: string
  user_id: string
  name: string
  avatar?: string
  role: "creator" | "admin" | "member"
  isAlfred?: boolean
}

interface ChatDetail {
  id: string
  name: string
  type: "dm" | "group"
  participant_count: number
  alfred_enabled: boolean
  active_agent?: string
}

export default function ChatDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { themed, theme } = useAppTheme()
  const { user } = useAuth()

  const [chat, setChat] = useState<ChatDetail | null>(null)
  const [participants, setParticipants] = useState<ChatParticipant[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMessages, setIsLoadingMessages] = useState(true)
  const [messageText, setMessageText] = useState("")
  const [isSending, setIsSending] = useState(false)

  // Pagination states
  const [hasMoreMessages, setHasMoreMessages] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  // FlatList ref for scrolling
  const flatListRef = useRef<FlatList>(null)

  // Image upload states
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null)

  // Agent states
  const [selectedAgent, setSelectedAgent] = useState<Agent>(DEFAULT_AGENT)
  const [showMentionAutocomplete, setShowMentionAutocomplete] = useState(false)
  const [mentionQuery, setMentionQuery] = useState("")
  const [cursorPosition, setCursorPosition] = useState(0)
  const [optimizedImageUri, setOptimizedImageUri] = useState<string | null>(null)

  // Load chat details and participants
  useEffect(() => {
    const loadChat = async () => {
      try {
        if (!id || !user) return

        // Fetch chat
        const { data: chatData, error: chatError } = await fetchSingleFromTable("chats", "*", {
          id,
        })

        if (chatError) throw chatError

        const typedChatData = chatData as ChatDetail
        if (typedChatData) {
          setChat(typedChatData)

          // Set active agent from chat data
          if (typedChatData.active_agent) {
            const agent = getAgentByUsername(typedChatData.active_agent)
            if (agent) {
              setSelectedAgent(agent)
            }
          }

          // Fetch participants
          const { data: participantsData, error: participantsError } = await fetchFromTable(
            "chat_participants",
            "*",
            { chat_id: id },
          )

          if (participantsError) throw participantsError

          // Enrich participants with profile data
          if (participantsData) {
            let enrichedParticipants = await Promise.all(
              participantsData
                .filter((p: any) => p.user_id !== user?.id) // Exclude current user
                .map(async (p: any) => {
                  const { data: profile } = await fetchSingleFromTable("profiles", "*", {
                    id: p.user_id,
                  })
                  return {
                    id: p.id,
                    user_id: p.user_id,
                    name: profile?.name || "Unknown",
                    avatar: profile?.avatar_url,
                    role: p.role,
                    isAlfred: false,
                  }
                }),
            )

            // Add Alfred if enabled (check from fetched chat data)
            if (chatData?.alfred_enabled) {
              enrichedParticipants.unshift({
                id: "system-alfred",
                user_id: "system-alfred",
                name: "Alfred",
                avatar: "alfred", // Special flag for Alfred icon
                role: "member",
                isAlfred: true,
              })
            }

            setParticipants(enrichedParticipants)

            // Initialize context cache if needed
            await initializeChatContextIfNeeded(id, enrichedParticipants)
          }
        }
      } catch (error) {
        console.error("Error loading chat:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadChat()
  }, [id, user?.id])

  // Load messages
  useEffect(() => {
    const loadMessages = async () => {
      if (!id || !user?.id) return

      setIsLoadingMessages(true)
      try {
        // Fetch initial 50 messages (most recent)
        const { data: messagesData, error } = await getMessagesForChat(id, 50, 0)

        if (error) throw error

        if (messagesData) {
          // Transform messages to ChatMessage format
          const chatMessages: ChatMessage[] = messagesData.map((msg: Message) => ({
            id: msg.id,
            sender_id: msg.sender_id,
            content: msg.content,
            content_type: msg.content_type,
            created_at: msg.created_at,
            status: msg.status,
            sender_type: msg.sender_type,
          }))

          setMessages(chatMessages)

          // Check if there are more messages
          setHasMoreMessages(messagesData.length === 50)

          // Mark messages as read
          await markMessagesAsRead(id, user.id)
        }
      } catch (error) {
        console.error("Error loading messages:", error)
      } finally {
        setIsLoadingMessages(false)
      }
    }

    loadMessages()
  }, [id, user?.id])

  // Load more messages (pagination)
  const loadMoreMessages = async () => {
    if (!id || !user?.id || !hasMoreMessages || isLoadingMore) return

    console.log("[Pagination] Loading more messages, current count:", messages.length)
    setIsLoadingMore(true)

    try {
      // Fetch next batch, offset by current message count
      const { data: messagesData, error } = await getMessagesForChat(id, 50, messages.length)

      if (error) throw error

      if (messagesData && messagesData.length > 0) {
        const newMessages: ChatMessage[] = messagesData.map((msg: Message) => ({
          id: msg.id,
          sender_id: msg.sender_id,
          content: msg.content,
          content_type: msg.content_type,
          created_at: msg.created_at,
          status: msg.status,
          sender_type: msg.sender_type,
        }))

        // Append older messages to the end (since we're using descending order)
        setMessages((prev) => [...prev, ...newMessages])

        // Check if there are more messages
        setHasMoreMessages(messagesData.length === 50)

        console.log("[Pagination] Loaded", messagesData.length, "more messages")
      } else {
        setHasMoreMessages(false)
        console.log("[Pagination] No more messages to load")
      }
    } catch (error) {
      console.error("[Pagination] Error loading more messages:", error)
    } finally {
      setIsLoadingMore(false)
    }
  }

  // Note: With inverted FlatList, newest messages are at the bottom automatically
  // No need for scrollToEnd on initial load

  // Subscribe to realtime message updates
  useEffect(() => {
    if (!id || !user?.id) return

    console.log("[Realtime] Setting up message subscriptions for chat:", id)

    // Subscribe to new messages
    const insertSubscription = subscribeToInserts<Message>(
      "messages",
      async (payload) => {
        console.log("[Realtime] Message INSERT event received:", payload)
        const newMsg = payload.new as Message
        if (!newMsg) {
          console.log("[Realtime] No new message in payload")
          return
        }

        console.log("[Realtime] New message chat_id:", newMsg.chat_id, "Current chat_id:", id)
        if (newMsg.chat_id !== id) {
          console.log("[Realtime] Message not for this chat, ignoring")
          return
        }

        // Check if this is Alfred's typing indicator placeholder
        const isAlfredTyping =
          newMsg.sender_type === "alfred" && newMsg.status === "sending" && newMsg.content === ""

        const newMessage: ChatMessage = {
          id: newMsg.id,
          sender_id: newMsg.sender_id,
          content: newMsg.content,
          content_type: newMsg.content_type,
          created_at: newMsg.created_at,
          status: newMsg.status,
          sender_type: newMsg.sender_type,
          isTyping: isAlfredTyping, // Mark as typing indicator
        }

        console.log("[Realtime] Adding message to state:", {
          ...newMessage,
          isAlfredTyping,
        })

        setMessages((prev) => {
          // Check for duplicates
          const exists = prev.find((m) => m.id === newMessage.id)
          if (exists) {
            console.log("[Realtime] Message already exists, skipping duplicate")
            return prev
          }
          console.log("[Realtime] Previous messages count:", prev.length)
          return [newMessage, ...prev]
        })

        // Note: inverted FlatList automatically scrolls to show new messages

        // Mark as read if not sent by current user
        if (newMsg.sender_id !== user.id) {
          console.log("[Realtime] Marking message as read")
          await markMessagesAsRead(id, user.id, [newMsg.id])
        }
      },
      { column: "chat_id", value: id },
    )

    // Subscribe to message status updates
    const updateSubscription = subscribeToUpdates<Message>(
      "messages",
      (payload) => {
        const updatedMsg = payload.new as Message
        const oldMsg = payload.old as Message

        if (!updatedMsg || updatedMsg.chat_id !== id) return

        console.log("[Realtime] Message UPDATE event:", {
          id: updatedMsg.id,
          old_status: oldMsg?.status,
          new_status: updatedMsg.status,
          old_content_empty: oldMsg?.content === "",
          new_content_exists: updatedMsg.content !== "",
        })

        // Check if this is Alfred's typing indicator being replaced with actual response
        const wasTyping = oldMsg?.status === "sending" && oldMsg?.content === ""
        const nowComplete = updatedMsg.status === "sent" && updatedMsg.content !== ""

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === updatedMsg.id
              ? {
                  ...msg,
                  status: updatedMsg.status,
                  content: updatedMsg.content,
                  content_type: updatedMsg.content_type,
                  isTyping: false, // Remove typing indicator
                }
              : msg,
          ),
        )

        if (wasTyping && nowComplete) {
          console.log("[Realtime] Alfred finished typing, showing response")
        }
      },
      { column: "chat_id", value: id },
    )

    return () => {
      insertSubscription.unsubscribe()
      updateSubscription.unsubscribe()
    }
  }, [id, user?.id])

  const handleBack = () => {
    router.replace("/(tabs)/chats")
  }

  /**
   * Initialize chat context cache if:
   * 1. User connections exist between participants
   * 2. Alfred context cache doesn't exist for this chat
   */
  const initializeChatContextIfNeeded = async (
    chatId: string,
    chatParticipants: ChatParticipant[],
  ) => {
    try {
      // Get participant IDs including current user (exclude Alfred only)
      const participantIds = [
        ...(user?.id ? [user.id] : []),
        ...chatParticipants.filter((p) => !p.isAlfred).map((p) => p.user_id),
      ]

      if (participantIds.length < 2) {
        console.log("[ContextInit] Not enough participants for connections")
        return
      }

      console.log("[ContextInit] Checking if context initialization needed for chat:", chatId)

      // Check if user connections exist
      const { data: hasConnections, error: connectionsError } =
        await hasUserConnectionsForChat(participantIds)

      if (connectionsError) {
        console.error("[ContextInit] Error checking connections:", connectionsError)
        return
      }

      if (!hasConnections) {
        console.log("[ContextInit] No user connections found, skipping initialization")
        return
      }

      console.log("[ContextInit] User connections exist, checking context cache...")

      // Check if context cache exists
      const { data: hasCache, error: cacheError } = await hasChatContextCache(chatId)

      if (cacheError) {
        console.error("[ContextInit] Error checking cache:", cacheError)
        return
      }

      if (hasCache) {
        console.log("[ContextInit] Context cache already exists, skipping initialization")
        return
      }

      console.log("[ContextInit] Initializing context cache...")

      // Get current user profile to include in participants
      const currentUserProfile = user ? await getProfile(user.id) : null

      // Build full participants list including current user
      const allParticipants = [
        // Current user
        ...(user && currentUserProfile?.data
          ? [
              {
                id: user.id,
                name: currentUserProfile.data.name || "Unknown",
              },
            ]
          : []),
        // Other participants (excluding Alfred)
        ...chatParticipants
          .filter((p) => !p.isAlfred)
          .map((p) => ({
            id: p.user_id,
            name: p.name,
          })),
      ]

      // Initialize context cache
      const result = await initializeChatContext({
        chat_id: chatId,
        participants: allParticipants,
      })

      if (result.success) {
        console.log("[ContextInit] Context cache initialized successfully:", {
          cache_initialized: result.cache_initialized,
          has_relationship_summary: !!result.relationship_summary,
          has_topic_summary: !!result.topic_summary,
        })
      } else {
        console.error("[ContextInit] Failed to initialize context:", result.error)
      }
    } catch (error) {
      console.error("[ContextInit] Error during initialization:", error)
    }
  }

  const handleToggleAlfred = async () => {
    if (!chat || !user?.id) return

    const newAlfredEnabled = !chat.alfred_enabled

    try {
      const { error } = await executeQuery<any>((client) =>
        client.from("chats").update({ alfred_enabled: newAlfredEnabled }).eq("id", chat.id),
      )

      if (error) throw error

      // Update local state
      setChat({ ...chat, alfred_enabled: newAlfredEnabled })

      // Update participants list
      if (newAlfredEnabled) {
        // Add Alfred to participants
        setParticipants((prev) => [
          {
            id: "system-alfred",
            user_id: "system-alfred",
            name: "Alfred",
            avatar: "alfred",
            role: "member",
            isAlfred: true,
          },
          ...prev,
        ])
      } else {
        // Remove Alfred from participants
        setParticipants((prev) => prev.filter((p) => p.user_id !== "system-alfred"))
      }

      Alert.alert(
        "Success",
        newAlfredEnabled
          ? "Alfred has been added to the chat"
          : "Alfred has been removed from the chat",
      )
    } catch (error) {
      console.error("Error toggling Alfred:", error)
      Alert.alert("Error", "Failed to update Alfred status")
    }
  }

  const handleSelectAgent = async (agent: Agent) => {
    setSelectedAgent(agent)

    // Update active_agent in database
    if (chat) {
      try {
        const { error } = await executeQuery((client) =>
          client.from("chats").update({ active_agent: agent.username }).eq("id", chat.id),
        )

        if (error) {
          console.error("Error updating active agent:", error)
        }
      } catch (error) {
        console.error("Error updating active agent:", error)
      }
    }

    // Add mention to text input at cursor position
    const mention = `@${agent.username} `
    setMessageText((prev) => {
      const before = prev.slice(0, cursorPosition)
      const after = prev.slice(cursorPosition)
      return before + mention + after
    })
    setCursorPosition(cursorPosition + mention.length)
  }

  const handleTextChange = (text: string) => {
    setMessageText(text)

    // Check for @ mention trigger
    const cursorPos = text.length // Simple: assume cursor at end
    const textBeforeCursor = text.slice(0, cursorPos)
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/)

    if (mentionMatch) {
      setMentionQuery(mentionMatch[1])
      setShowMentionAutocomplete(true)
    } else {
      setShowMentionAutocomplete(false)
      setMentionQuery("")
    }
  }

  const handleSelectMention = (agent: Agent) => {
    const mention = `@${agent.username} `

    // Replace the incomplete mention with the complete one
    const textBeforeCursor = messageText.slice(0, cursorPosition)
    const textAfterCursor = messageText.slice(cursorPosition)
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/)

    if (mentionMatch) {
      const beforeMention = textBeforeCursor.slice(0, mentionMatch.index)
      const newText = beforeMention + mention + textAfterCursor
      setMessageText(newText)
      setCursorPosition(beforeMention.length + mention.length)
    }

    setShowMentionAutocomplete(false)
    setMentionQuery("")
  }

  const handlePickImage = async () => {
    try {
      // Pick image from library
      const imageAsset = await pickImage()
      if (!imageAsset) {
        console.log("No image selected")
        return
      }

      console.log("Image picked:", imageAsset.uri)

      // Show loading indicator
      setIsUploadingImage(true)

      // Optimize image (WhatsApp-style compression)
      console.log("Optimizing image...")
      const optimizedImage = await optimizeImage(imageAsset, {
        maxWidth: 1920,
        maxHeight: 1920,
        quality: 0.8,
        format: "jpeg",
      })

      console.log(
        `Image optimized: ${imageAsset.fileSize || "unknown"} -> ${optimizedImage.size} bytes`,
      )

      // Store optimized image URI for preview
      setSelectedImageUri(imageAsset.uri)
      setOptimizedImageUri(optimizedImage.uri)
    } catch (error) {
      console.error("Error picking/optimizing image:", error)
      Alert.alert("Error", "Failed to process image. Please try again.")
    } finally {
      setIsUploadingImage(false)
    }
  }

  const handleRemoveImage = () => {
    setSelectedImageUri(null)
    setOptimizedImageUri(null)
  }

  const handleSendWithImage = async () => {
    if (!optimizedImageUri || !user?.id || !chat?.id) return

    const caption = messageText.trim()
    setMessageText("") // Clear input immediately
    setIsSending(true)

    try {
      console.log("Uploading image to Supabase...")
      const uploadResult = await uploadChatImage(optimizedImageUri, user.id, chat.id)

      if (uploadResult.error) {
        throw uploadResult.error
      }

      console.log("Image uploaded successfully:", uploadResult.url)

      // Send message with image URL and optional caption
      const content = caption ? `${uploadResult.url}\n${caption}` : uploadResult.url

      const { data: newMessage, error } = await sendMessageToSupabase({
        chat_id: chat.id,
        sender_id: user.id,
        content,
        content_type: "image",
        sender_type: "user",
      })

      if (error) throw error

      console.log("Image message sent successfully")

      // Optimistic update
      if (newMessage) {
        const optimisticMessage: ChatMessage = {
          id: newMessage.id,
          sender_id: newMessage.sender_id,
          content: newMessage.content,
          content_type: "image",
          created_at: newMessage.created_at,
          status: newMessage.status,
          sender_type: newMessage.sender_type,
        }

        setMessages((prev) => {
          const exists = prev.find((m) => m.id === newMessage.id)
          if (!exists) {
            return [optimisticMessage, ...prev]
          }
          return prev
        })
      }

      // Clear image selection
      setSelectedImageUri(null)
      setOptimizedImageUri(null)
    } catch (error) {
      console.error("Error uploading image:", error)
      Alert.alert("Error", "Failed to upload image. Please try again.")
      setMessageText(caption) // Restore caption on error
    } finally {
      setIsSending(false)
    }
  }

  const handleSendMessage = async () => {
    // If image is selected, send with image
    if (optimizedImageUri) {
      await handleSendWithImage()
      return
    }

    if (!messageText.trim() || !chat || !user?.id) return

    const content = messageText.trim()
    setMessageText("") // Clear input immediately
    setIsSending(true)

    console.log("[SendMessage] Sending message:", { chat_id: chat.id, content })

    try {
      // Step 1: Send message to Supabase
      const { data: newMessage, error } = await sendMessageToSupabase({
        chat_id: chat.id,
        sender_id: user.id,
        content,
        content_type: "text",
        sender_type: "user",
      })

      if (error) throw error

      console.log("[SendMessage] Message sent successfully:", newMessage)

      // Step 2: Optimistic update - Add message to state immediately
      // (It will also come via realtime, but we'll handle duplicates)
      if (newMessage) {
        const optimisticMessage: ChatMessage = {
          id: newMessage.id,
          sender_id: newMessage.sender_id,
          content: newMessage.content,
          created_at: newMessage.created_at,
          status: newMessage.status,
          sender_type: newMessage.sender_type,
        }

        setMessages((prev) => {
          // Check if message already exists (from realtime)
          const exists = prev.find((m) => m.id === newMessage.id)
          if (exists) {
            console.log("[SendMessage] Message already in state (from realtime)")
            return prev
          }
          console.log("[SendMessage] Adding message to state (optimistic)")
          return [optimisticMessage, ...prev]
        })

        // Step 3: Process message with Alfred (memory extraction + response generation)
        // This runs in background - don't await

        // Get current user's profile for name
        const { data: currentUserProfile } = await getProfile(user.id)

        // Build participants list including current user
        const participantsForAlfred = [
          // Current user (sender)
          {
            id: user.id,
            name: currentUserProfile?.name || "Unknown",
          },
          // Other participants (exclude Alfred)
          ...participants
            .filter((p) => !p.isAlfred)
            .map((p) => ({
              id: p.user_id,
              name: p.name,
            })),
        ]

        // Get last 10 messages for context (most recent first, excluding typing indicators)
        const last10Messages = messages
          .filter((m) => !m.isTyping) // Exclude typing indicators
          .slice(-10) // Get last 10
          .map((m) => {
            // Find sender name from participants or current user
            let senderName = "Unknown"
            if (m.sender_id === user.id) {
              senderName = currentUserProfile?.name || "You"
            } else {
              const sender = participants.find((p) => p.user_id === m.sender_id)
              senderName = sender?.name || "Unknown"
            }

            return {
              sender_name: senderName,
              content: m.content,
              timestamp: m.created_at,
            }
          })

        console.log("[Alfred] Sending payload:", {
          chat_id: chat.id,
          sender_id: user.id,
          message_id: newMessage.id,
          participants_count: participantsForAlfred.length,
          last_messages_count: last10Messages.length,
          alfred_enabled: chat.alfred_enabled,
        })

        processMessageWithAlfred({
          message: content,
          chat_id: chat.id,
          sender_id: user.id,
          message_id: newMessage.id,
          participants: participantsForAlfred,
          last_10_messages: last10Messages,
          chat_settings: {
            alfred_enabled: chat.alfred_enabled,
            incognito: false, // TODO: Add incognito setting to chat
          },
        })
          .then((result) => {
            if (result.success) {
              console.log("[Alfred] Message processed:", {
                memories_extracted: result.memories_extracted,
                alfred_response: !!result.alfred_response,
              })

              // If Alfred generated a response, it will be saved to Supabase by backend
              // and will appear via realtime subscription automatically
            } else {
              console.error("[Alfred] Failed to process message:", result.error)
            }
          })
          .catch((err) => {
            console.error("[Alfred] Error processing message:", err)
          })
      }

      // Note: inverted FlatList automatically shows new messages at bottom
    } catch (error) {
      console.error("[SendMessage] Error sending message:", error)
      Alert.alert("Error", "Failed to send message. Please try again.")
      setMessageText(content) // Restore message on error
    } finally {
      setIsSending(false)
    }
  }

  // Typing Indicator Component
  const TypingIndicator = () => {
    const dot1 = useRef(new Animated.Value(0)).current
    const dot2 = useRef(new Animated.Value(0)).current
    const dot3 = useRef(new Animated.Value(0)).current

    useEffect(() => {
      const createAnimation = (animatedValue: Animated.Value, delay: number) => {
        return Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(animatedValue, {
              toValue: 1,
              duration: 400,
              easing: Easing.ease,
              useNativeDriver: true,
            }),
            Animated.timing(animatedValue, {
              toValue: 0,
              duration: 400,
              easing: Easing.ease,
              useNativeDriver: true,
            }),
          ]),
        )
      }

      const animation1 = createAnimation(dot1, 0)
      const animation2 = createAnimation(dot2, 150)
      const animation3 = createAnimation(dot3, 300)

      animation1.start()
      animation2.start()
      animation3.start()

      return () => {
        animation1.stop()
        animation2.stop()
        animation3.stop()
      }
    }, [])

    const dotOpacity = (animatedValue: Animated.Value) => ({
      opacity: animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: [0.3, 1],
      }),
      transform: [
        {
          translateY: animatedValue.interpolate({
            inputRange: [0, 1],
            outputRange: [0, -6],
          }),
        },
      ],
    })

    return (
      <View style={themed($typingIndicatorContainer)}>
        <Animated.View style={[themed($typingDot), dotOpacity(dot1)]} />
        <Animated.View style={[themed($typingDot), dotOpacity(dot2)]} />
        <Animated.View style={[themed($typingDot), dotOpacity(dot3)]} />
      </View>
    )
  }

  const renderMessageItem = ({ item }: { item: ChatMessage }) => {
    const isOwnMessage = item.sender_id === user?.id
    const showStatusIcon = isOwnMessage
    const isAlfred = item.sender_type === "alfred"
    const isGroupChat = chat?.type === "group"

    // Get sender name
    let senderName = ""
    if (!isOwnMessage) {
      if (isAlfred) {
        senderName = "Alfred"
      } else {
        const sender = participants.find((p) => p.user_id === item.sender_id)
        senderName = sender?.name || "Unknown"
      }
    }

    // Show sender name in group chats or when Alfred sends message in DM
    const showSenderName = !isOwnMessage && (isGroupChat || isAlfred)

    return (
      <View
        style={[
          themed($messageRow),
          {
            justifyContent: isOwnMessage ? "flex-end" : "flex-start",
          },
        ]}
      >
        <View
          style={[
            themed($messageBubble),
            {
              backgroundColor: isOwnMessage
                ? theme.colors.tint
                : isAlfred
                  ? theme.colors.palette.accent100
                  : theme.colors.palette.neutral300,
            },
          ]}
        >
          {/* Show sender name if needed */}
          {showSenderName && (
            <Text
              text={senderName}
              style={[
                themed($senderName),
                {
                  color: isAlfred ? theme.colors.tint : theme.colors.textDim,
                  fontWeight: "600",
                },
              ]}
            />
          )}

          {/* Show typing indicator for Alfred's placeholder messages */}
          {item.isTyping ? (
            <View style={themed($typingContent)}>
              <Text
                text="Alfred is thinking"
                style={[
                  themed($typingText),
                  {
                    color: theme.colors.textDim,
                  },
                ]}
              />
              <TypingIndicator />
            </View>
          ) : (
            <>
              <MessageContent
                content={item.content}
                contentType={item.content_type || "text"}
                isOwnMessage={isOwnMessage}
                isAlfred={isAlfred}
              />
              <Text
                text={new Date(item.created_at).toLocaleTimeString()}
                style={[
                  themed($messageTime),
                  {
                    color: isOwnMessage ? theme.colors.palette.neutral200 : theme.colors.textDim,
                  },
                ]}
              />
            </>
          )}
        </View>
        {showStatusIcon && (
          <View style={themed($statusIcon)}>
            <MaterialCommunityIcons
              name={
                item.status === "read"
                  ? "check-all"
                  : item.status === "delivered"
                    ? "check-all"
                    : item.status === "failed"
                      ? "alert-circle"
                      : "check"
              }
              size={14}
              color={
                item.status === "read"
                  ? theme.colors.palette.secondary500
                  : item.status === "failed"
                    ? theme.colors.error
                    : theme.colors.textDim
              }
            />
          </View>
        )}
      </View>
    )
  }

  return (
    <Screen
      preset="fixed"
      contentContainerStyle={themed($container)}
      safeAreaEdges={["top", "bottom"]}
    >
      {/* Chat Header - Single Row */}
      <View style={themed($header)}>
        {/* Back Button */}
        <Pressable onPress={handleBack} style={themed($backButton)}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.text} />
        </Pressable>

        {/* Chat Metadata - Participants */}
        <View style={themed($chatMetadata)}>
          {/* Horizontal Scrollable Participant Avatars */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={themed($participantAvatars)}
          >
            {participants
              .filter((p) => !p.isAlfred)
              .map((participant, index) => {
                // Get first name only
                const firstName = participant.name.split(" ")[0]

                return (
                  <View key={participant.id} style={themed($avatarContainer)}>
                    <View style={themed($avatarWrapper)}>
                      {participant.avatar && participant.avatar !== "alfred" ? (
                        <Image
                          source={
                            typeof participant.avatar === "string"
                              ? { uri: participant.avatar }
                              : participant.avatar
                          }
                          style={themed($participantAvatarSmall)}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={themed($participantAvatarSmallPlaceholder)}>
                          <Text
                            text={participant.name.charAt(0).toUpperCase()}
                            style={themed($avatarInitial)}
                          />
                        </View>
                      )}
                    </View>

                    {/* Show first name below avatar */}
                    <Text text={firstName} style={themed($participantNameText)} numberOfLines={1} />
                  </View>
                )
              })}
          </ScrollView>
        </View>

        {/* Settings Button */}
        <Pressable
          onPress={() => router.push(`/chats/${id}/settings`)}
          style={themed($settingsButton)}
        >
          <MaterialCommunityIcons name="cog" size={24} color={theme.colors.text} />
        </Pressable>
      </View>

      {/* Messages List */}
      {isLoading || isLoadingMessages ? (
        <View style={themed($loadingContainer)}>
          <Text text="Loading chat..." />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessageItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={themed($messagesList)}
          maintainVisibleContentPosition={{
            minIndexForVisible: 0,
            autoscrollToTopThreshold: 10,
          }}
          onEndReached={() => {
            // Load more messages when user scrolls to top
            if (hasMoreMessages && !isLoadingMore) {
              loadMoreMessages()
            }
          }}
          onEndReachedThreshold={0.5}
          inverted
          ListFooterComponent={
            isLoadingMore ? (
              <View style={themed($loadingMoreContainer)}>
                <ActivityIndicator size="small" color={theme.colors.tint} />
                <Text text="Loading more..." style={themed($loadingMoreText)} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={themed($emptyMessages)}>
              <Text text="No messages yet. Start the conversation!" style={themed($emptyText)} />
            </View>
          }
        />
      )}

      {/* Message Input */}
      <View style={themed($inputContainer)}>
        {/* Agent Selector - Above input container */}
        <View style={themed($agentSelectorWrapper)}>
          <AgentSelector selectedAgent={selectedAgent} onSelectAgent={handleSelectAgent} />
        </View>

        {/* Input Content Container */}
        <View style={themed($inputContentContainer)}>
          {/* Image Preview */}
          {selectedImageUri && (
            <View style={themed($imagePreviewContainer)}>
              <Image
                source={{ uri: selectedImageUri }}
                style={themed($imagePreview)}
                resizeMode="cover"
              />
              <Pressable onPress={handleRemoveImage} style={themed($removeImageButton)}>
                <MaterialCommunityIcons name="close-circle" size={24} color="white" />
              </Pressable>
            </View>
          )}

          <View style={themed($inputWrapper)}>
            {/* Mention Autocomplete */}
            {showMentionAutocomplete && (
              <View style={themed($mentionAutocompleteWrapper)}>
                <MentionAutocomplete query={mentionQuery} onSelectMention={handleSelectMention} />
              </View>
            )}

            <View style={themed($inputRow)}>
              <Pressable
                onPress={handlePickImage}
                disabled={isUploadingImage || isSending || !!selectedImageUri}
                style={({ pressed }) => [
                  themed($attachmentButton),
                  pressed && { opacity: 0.7 },
                  (isUploadingImage || isSending || !!selectedImageUri) && { opacity: 0.5 },
                ]}
              >
                {isUploadingImage ? (
                  <ActivityIndicator size="small" color={theme.colors.tint} />
                ) : (
                  <MaterialCommunityIcons name="image-plus" size={24} color={theme.colors.tint} />
                )}
              </Pressable>
              <TextInput
                style={themed($input)}
                placeholder={selectedImageUri ? "Add a caption..." : "Type a message..."}
                value={messageText}
                onChangeText={handleTextChange}
                onSelectionChange={(e) => setCursorPosition(e.nativeEvent.selection.end)}
                placeholderTextColor={theme.colors.textDim}
                editable={!isSending && !isUploadingImage}
                multiline
              />
              <Pressable
                onPress={handleSendMessage}
                disabled={
                  (!messageText.trim() && !selectedImageUri) || isSending || isUploadingImage
                }
                style={({ pressed }) => [
                  themed($sendButton),
                  pressed && { opacity: 0.7 },
                  ((!messageText.trim() && !selectedImageUri) || isSending || isUploadingImage) && {
                    opacity: 0.5,
                  },
                ]}
              >
                <MaterialCommunityIcons name="send" size={20} color={theme.colors.tint} />
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Screen>
  )
}

const $container: ThemedStyle<ViewStyle> = () => ({
  flex: 1,
})

const $header: ThemedStyle<ViewStyle> = ({ spacing, colors }) => ({
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.xs,
  borderBottomWidth: 1,
  borderBottomColor: colors.border,
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.sm,
})

const $backButton: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  padding: spacing.xs,
})

const $chatMetadata: ThemedStyle<ViewStyle> = () => ({
  flex: 1,
})

const $participantAvatars: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "flex-start",
  gap: spacing.xxs,
})

const $avatarContainer: ThemedStyle<ViewStyle> = () => ({
  alignItems: "center",
  width: 50,
})

const $avatarWrapper: ThemedStyle<ViewStyle> = ({ colors }) => ({
  borderWidth: 2,
  borderColor: colors.background,
  borderRadius: 18,
})

const $participantAvatarSmall: ThemedStyle<ImageStyle> = () => ({
  width: 40,
  height: 40,
  borderRadius: 20,
})

const $participantAvatarSmallPlaceholder: ThemedStyle<ViewStyle> = ({ colors }) => ({
  width: 40,
  height: 40,
  borderRadius: 20,
  backgroundColor: colors.palette.neutral300,
  justifyContent: "center",
  alignItems: "center",
})

const $avatarInitial: ThemedStyle<any> = () => ({
  fontSize: 14,
  fontWeight: "600",
})

const $participantNameText: ThemedStyle<any> = ({ colors }) => ({
  fontSize: 10,
  color: colors.textDim,
  textAlign: "center",
})

const $settingsButton: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  padding: spacing.xs,
})

const $loadingContainer: ThemedStyle<ViewStyle> = () => ({
  flex: 1,
  justifyContent: "center",
  alignItems: "center",
})

const $messagesList: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.md,
})

const $emptyMessages: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flex: 1,
  justifyContent: "center",
  alignItems: "center",
  paddingVertical: spacing.xxxl,
})

const $emptyText: ThemedStyle<any> = ({ colors }) => ({
  color: colors.textDim,
  textAlign: "center",
})

const $messageRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  marginVertical: spacing.xs,
  alignItems: "flex-end",
  gap: spacing.xs,
})

const $messageBubble: ThemedStyle<ViewStyle> = ({ spacing, colors }) => ({
  maxWidth: "80%",
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.xs,
  borderRadius: 12,
})

const $messageTime: ThemedStyle<any> = ({ spacing }) => ({
  fontSize: 11,
  marginTop: spacing.xxs,
})

const $statusIcon: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingHorizontal: spacing.xxs,
})

const $inputContainer: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingHorizontal: spacing.md,
  position: "relative",
})

const $agentSelectorWrapper: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  position: "absolute",
  top: -45,
  right: spacing.md,
  zIndex: 1000,
})

const $inputContentContainer: ThemedStyle<ViewStyle> = ({ spacing, colors }) => ({
  paddingVertical: spacing.sm,
  borderTopWidth: 1,
  borderTopColor: colors.border,
})

const $imagePreviewContainer: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginBottom: spacing.sm,
  position: "relative",
})

const $imagePreview: ThemedStyle<ImageStyle> = () => ({
  width: 100,
  height: 100,
  borderRadius: 8,
})

const $removeImageButton: ThemedStyle<ViewStyle> = () => ({
  position: "absolute",
  top: -8,
  right: -8,
  backgroundColor: "rgba(0,0,0,0.6)",
  borderRadius: 12,
})

const $inputWrapper: ThemedStyle<ViewStyle> = () => ({
  position: "relative",
})

const $mentionAutocompleteWrapper: ThemedStyle<ViewStyle> = () => ({
  position: "absolute",
  bottom: "100%",
  left: 0,
  right: 0,
  zIndex: 1000,
})

const $inputRow: ThemedStyle<ViewStyle> = ({ spacing, colors }) => ({
  flexDirection: "row",
  alignItems: "flex-end",
  backgroundColor: colors.palette.neutral200,
  borderRadius: 20,
  paddingHorizontal: spacing.sm,
  gap: spacing.xs,
})

const $attachmentButton: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingVertical: spacing.sm,
  justifyContent: "center",
  alignItems: "center",
})

const $input: ThemedStyle<any> = ({ spacing, colors, typography }) => ({
  flex: 1,
  paddingVertical: spacing.sm,
  paddingHorizontal: spacing.sm,
  color: colors.text,
  fontFamily: typography.primary.normal,
  maxHeight: 100,
})

const $sendButton: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.sm,
})

const $loadingMoreContainer: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  paddingVertical: spacing.md,
  gap: spacing.xs,
})

const $loadingMoreText: ThemedStyle<any> = ({ colors }) => ({
  fontSize: 14,
  color: colors.textDim,
})

const $senderName: ThemedStyle<any> = ({ spacing }) => ({
  fontSize: 12,
  marginBottom: spacing.xxs,
})

const $typingContent: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.sm,
  paddingVertical: spacing.xs,
})

const $typingText: ThemedStyle<any> = () => ({
  fontSize: 14,
  fontStyle: "italic",
})

const $typingIndicatorContainer: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.xxs,
  paddingHorizontal: spacing.xs,
})

const $typingDot: ThemedStyle<ViewStyle> = ({ colors }) => ({
  width: 8,
  height: 8,
  borderRadius: 4,
  backgroundColor: colors.textDim,
})
