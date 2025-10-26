import React, { createContext, useContext, useState, useCallback, useEffect } from "react"
import { useAuth } from "@/hooks/useAuth"
import {
  executeQuery,
  fetchSingleFromTable,
  subscribeToAllChanges,
} from "@/services/supabase"
import { formatDistanceToNow } from "date-fns"

export interface ChatItem {
  id: string
  name: string
  avatar?: string
  lastMessage: string
  lastMessageTime: string
  lastMessageTimestamp?: number
  unreadCount: number
  isOnline?: boolean
  participantCount?: number
  alfredEnabled?: boolean
}

interface ChatsContextType {
  chats: ChatItem[]
  isLoading: boolean
  isInitialized: boolean
  refreshChats: () => Promise<void>
  updateChat: (chatId: string) => Promise<void>
}

const ChatsContext = createContext<ChatsContextType | undefined>(undefined)

export function ChatsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [chats, setChats] = useState<ChatItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)

  // Load chats from database
  const loadChats = useCallback(async () => {
    if (!user?.id) return

    setIsLoading(true)
    try {
      // Fetch chats where user is a participant
      const { data: chatParticipants } = await executeQuery<any[]>((client) =>
        client
          .from("chat_participants")
          .select("chat_id, unread_count")
          .eq("user_id", user.id)
          .eq("is_active", true),
      )

      if (!chatParticipants || chatParticipants.length === 0) {
        setChats([])
        setIsInitialized(true)
        return
      }

      // Get all chat IDs
      const chatIds = chatParticipants.map((cp) => cp.chat_id)

      // Fetch chat details
      const { data: chatsData } = await executeQuery<any[]>((client) =>
        client
          .from("chats")
          .select("*")
          .in("id", chatIds)
          .eq("is_active", true)
          .order("last_message_at", { ascending: false }),
      )

      if (!chatsData) {
        setChats([])
        setIsInitialized(true)
        return
      }

      // Transform chats to ChatItem format
      const chatItems: ChatItem[] = await Promise.all(
        chatsData.map(async (chat) => {
          const participant = chatParticipants.find((cp) => cp.chat_id === chat.id)

          // For DM chats, get the other participant's name
          let chatName = chat.name || "Chat"
          let avatar = chat.avatar_url

          if (chat.type === "dm") {
            const { data: otherParticipants } = await executeQuery<any[]>((client) =>
              client
                .from("chat_participants")
                .select("user_id")
                .eq("chat_id", chat.id)
                .neq("user_id", user.id)
                .limit(1),
            )

            if (otherParticipants && otherParticipants.length > 0) {
              const { data: profile } = await fetchSingleFromTable<any>(
                "profiles",
                "name, avatar_url",
                { id: otherParticipants[0].user_id },
              )

              if (profile) {
                chatName = profile.name || "Unknown"
                avatar = profile.avatar_url
              }
            }
          }

          return {
            id: chat.id,
            name: chatName,
            avatar,
            lastMessage: chat.last_message_preview || "No messages yet",
            lastMessageTime: chat.last_message_at
              ? formatDistanceToNow(new Date(chat.last_message_at), { addSuffix: true })
              : "",
            lastMessageTimestamp: chat.last_message_at
              ? new Date(chat.last_message_at).getTime()
              : 0,
            unreadCount: participant?.unread_count || 0,
            participantCount: chat.participant_count,
            alfredEnabled: chat.alfred_enabled || false,
          }
        }),
      )

      // Sort by last message timestamp
      const sortedChats = chatItems.sort((a, b) => {
        const aTime = a.lastMessageTimestamp || 0
        const bTime = b.lastMessageTimestamp || 0
        return bTime - aTime
      })

      setChats(sortedChats)
      setIsInitialized(true)
    } catch (error) {
      console.error("[ChatsContext] Error loading chats:", error)
      setIsInitialized(true)
    } finally {
      setIsLoading(false)
    }
  }, [user?.id])

  // Update a single chat
  const updateChat = useCallback(
    async (chatId: string) => {
      if (!user?.id) return

      try {
        // Fetch updated chat
        const { data: chatData } = await fetchSingleFromTable<any>("chats", "*", { id: chatId })
        if (!chatData) return

        // Get participant info
        const { data: participant } = await fetchSingleFromTable<any>(
          "chat_participants",
          "unread_count",
          { chat_id: chatId, user_id: user.id },
        )

        // For DM chats, get the other participant's name
        let chatName = chatData.name || "Chat"
        let avatar = chatData.avatar_url

        if (chatData.type === "dm") {
          const { data: otherParticipants } = await executeQuery<any[]>((client) =>
            client
              .from("chat_participants")
              .select("user_id")
              .eq("chat_id", chatId)
              .neq("user_id", user.id)
              .limit(1),
          )

          if (otherParticipants && otherParticipants.length > 0) {
            const { data: profile } = await fetchSingleFromTable<any>(
              "profiles",
              "name, avatar_url",
              { id: otherParticipants[0].user_id },
            )

            if (profile) {
              chatName = profile.name || "Unknown"
              avatar = profile.avatar_url
            }
          }
        }

        const updatedChat: ChatItem = {
          id: chatData.id,
          name: chatName,
          avatar,
          lastMessage: chatData.last_message_preview || "No messages yet",
          lastMessageTime: chatData.last_message_at
            ? formatDistanceToNow(new Date(chatData.last_message_at), { addSuffix: true })
            : "",
          lastMessageTimestamp: chatData.last_message_at
            ? new Date(chatData.last_message_at).getTime()
            : 0,
          unreadCount: participant?.unread_count || 0,
          participantCount: chatData.participant_count,
          alfredEnabled: chatData.alfred_enabled || false,
        }

        // Update chats list
        setChats((prev) => {
          const exists = prev.find((c) => c.id === chatId)

          if (exists) {
            // Update existing chat and sort by timestamp
            const updated = prev.map((c) => (c.id === chatId ? updatedChat : c))
            return updated.sort((a, b) => {
              const aTime = a.lastMessageTimestamp || 0
              const bTime = b.lastMessageTimestamp || 0
              return bTime - aTime
            })
          } else {
            // Add new chat and re-sort
            const newList = [updatedChat, ...prev]
            return newList.sort((a, b) => {
              const aTime = a.lastMessageTimestamp || 0
              const bTime = b.lastMessageTimestamp || 0
              return bTime - aTime
            })
          }
        })
      } catch (error) {
        console.error("[ChatsContext] Error updating chat:", error)
      }
    },
    [user?.id],
  )

  // Initial load
  useEffect(() => {
    if (user?.id && !isInitialized) {
      loadChats()
    }
  }, [user?.id, isInitialized, loadChats])

  // Subscribe to realtime updates
  useEffect(() => {
    if (!user?.id || !isInitialized) return

    console.log("[ChatsContext] Setting up realtime subscriptions")

    // Subscribe to chat changes
    const chatSubscription = subscribeToAllChanges<any>("chats", (payload) => {
      console.log("[ChatsContext] Chat table event:", payload.eventType)
      if (payload.new) {
        console.log("[ChatsContext] - chat_id:", payload.new.id)
        console.log("[ChatsContext] - last_message_preview:", payload.new.last_message_preview)
        console.log("[ChatsContext] - last_message_at:", payload.new.last_message_at)
      }

      if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
        // For UPDATE events, update optimistically from the payload
        if (payload.eventType === "UPDATE" && payload.new) {
          setChats((prev) => {
            return prev.map((chat) => {
              if (chat.id === payload.new.id) {
                return {
                  ...chat,
                  lastMessage: payload.new.last_message_preview || chat.lastMessage,
                  lastMessageTime: payload.new.last_message_at
                    ? formatDistanceToNow(new Date(payload.new.last_message_at), { addSuffix: true })
                    : chat.lastMessageTime,
                  lastMessageTimestamp: payload.new.last_message_at
                    ? new Date(payload.new.last_message_at).getTime()
                    : chat.lastMessageTimestamp,
                }
              }
              return chat
            }).sort((a, b) => {
              const aTime = a.lastMessageTimestamp || 0
              const bTime = b.lastMessageTimestamp || 0
              return bTime - aTime
            })
          })
        }

        // Also fetch fresh data from database
        updateChat(payload.new.id)
      } else if (payload.eventType === "DELETE") {
        setChats((prev) => prev.filter((c) => c.id !== payload.old.id))
      }
    })

    // Subscribe to message changes
    const messageSubscription = subscribeToAllChanges<any>("messages", (payload) => {
      if (payload.eventType === "INSERT" && payload.new) {
        console.log("[ChatsContext] New message received:")
        console.log("[ChatsContext] - chat_id:", payload.new.chat_id)
        console.log("[ChatsContext] - content:", payload.new.content)
        console.log("[ChatsContext] - sender_id:", payload.new.sender_id)
        console.log("[ChatsContext] - created_at:", payload.new.created_at)

        // Update chat immediately with message info
        setChats((prev) => {
          return prev.map((chat) => {
            if (chat.id === payload.new.chat_id) {
              const updatedChat = {
                ...chat,
                lastMessage: payload.new.content,
                lastMessageTime: "just now",
                lastMessageTimestamp: new Date(payload.new.created_at).getTime(),
                // Increment unread count if message is not from current user
                unreadCount:
                  payload.new.sender_id !== user.id
                    ? chat.unreadCount + 1
                    : chat.unreadCount,
              }
              console.log("[ChatsContext] Updated chat optimistically:", updatedChat.name)
              return updatedChat
            }
            return chat
          }).sort((a, b) => {
            const aTime = a.lastMessageTimestamp || 0
            const bTime = b.lastMessageTimestamp || 0
            return bTime - aTime
          })
        })

        // Also update from database to get accurate data
        updateChat(payload.new.chat_id)
      }
    })

    return () => {
      console.log("[ChatsContext] Cleaning up subscriptions")
      chatSubscription.unsubscribe()
      messageSubscription.unsubscribe()
    }
  }, [user?.id, isInitialized, updateChat])

  const refreshChats = useCallback(async () => {
    await loadChats()
  }, [loadChats])

  return (
    <ChatsContext.Provider
      value={{
        chats,
        isLoading,
        isInitialized,
        refreshChats,
        updateChat,
      }}
    >
      {children}
    </ChatsContext.Provider>
  )
}

export function useChats() {
  const context = useContext(ChatsContext)
  if (context === undefined) {
    throw new Error("useChats must be used within a ChatsProvider")
  }
  return context
}
