import type { PostgrestError } from "@supabase/supabase-js"
import { supabase } from "./supabaseClient"

export interface Message {
  id: string
  chat_id: string
  sender_id: string
  sender_type: "user" | "alfred" | "system"
  content: string
  content_type: "text" | "image" | "video" | "audio" | "file" | "location" | "contact" | "poll"
  status: "sending" | "sent" | "delivered" | "read" | "failed"
  reply_to_message_id?: string
  edited_at?: string
  deleted_at?: string
  created_at: string
  updated_at?: string
  metadata?: any
}

export interface DatabaseResponse<T> {
  data: T | null
  error: PostgrestError | null
}

/**
 * Fetch messages for a chat
 * @param chatId - Chat ID
 * @param limit - Number of messages to fetch (default: 50)
 * @param offset - Offset for pagination (default: 0)
 */
export async function getMessagesForChat(
  chatId: string,
  limit = 50,
  offset = 0,
): Promise<DatabaseResponse<Message[]>> {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("chat_id", chatId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)

  return { data: data as Message[], error }
}

/**
 * Send a message
 * @param messageData - Message data
 */
export async function sendMessage(messageData: {
  chat_id: string
  sender_id: string
  content: string
  content_type?: "text" | "image" | "video" | "audio" | "file" | "location" | "contact" | "poll"
  sender_type?: "user" | "alfred" | "system"
}): Promise<DatabaseResponse<Message>> {
  const { data, error } = await supabase
    .from("messages")
    .insert({
      chat_id: messageData.chat_id,
      sender_id: messageData.sender_id,
      content: messageData.content,
      content_type: messageData.content_type || "text",
      sender_type: messageData.sender_type || "user",
      status: "sent",
    })
    .select()
    .single()

  // Update chat's last_message_at and last_message_preview
  if (data) {
    // Note: message_count should be updated via database trigger for accuracy
    await supabase
      .from("chats")
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: messageData.content,
        last_message_sender_id: messageData.sender_id,
      })
      .eq("id", messageData.chat_id)
  }

  return { data: data as Message, error }
}

/**
 * Mark messages as read
 * @param chatId - Chat ID
 * @param userId - User ID who is reading
 * @param messageIds - Optional array of specific message IDs to mark as read
 */
export async function markMessagesAsRead(
  chatId: string,
  userId: string,
  messageIds?: string[],
): Promise<{ error: PostgrestError | null }> {
  // Update message status to 'read' for messages not sent by this user
  let query = supabase
    .from("messages")
    .update({ status: "read" })
    .eq("chat_id", chatId)
    .neq("sender_id", userId)
    .in("status", ["sent", "delivered"])

  if (messageIds && messageIds.length > 0) {
    query = query.in("id", messageIds)
  }

  const { error: messageError } = await query

  // Update chat_participants unread_count to 0
  const { error: participantError } = await supabase
    .from("chat_participants")
    .update({
      unread_count: 0,
      last_read_at: new Date().toISOString(),
    })
    .eq("chat_id", chatId)
    .eq("user_id", userId)

  return { error: messageError || participantError }
}

/**
 * Get unread message count for a chat
 * @param chatId - Chat ID
 * @param userId - User ID
 */
export async function getUnreadCount(
  chatId: string,
  userId: string,
): Promise<{ count: number; error: PostgrestError | null }> {
  const { data, error } = await supabase
    .from("chat_participants")
    .select("unread_count")
    .eq("chat_id", chatId)
    .eq("user_id", userId)
    .single()

  return { count: data?.unread_count || 0, error }
}

/**
 * Increment unread count for other participants
 * @param chatId - Chat ID
 * @param senderId - Sender user ID (to exclude from increment)
 */
export async function incrementUnreadCountForOthers(
  chatId: string,
  senderId: string,
): Promise<{ error: PostgrestError | null }> {
  const { error } = await supabase.rpc("increment_unread_count", {
    p_chat_id: chatId,
    p_sender_id: senderId,
  })

  // Fallback if RPC doesn't exist - manual update
  if (error?.code === "42883") {
    // Fetch all participants except sender
    const { data: participants, error: fetchError } = await supabase
      .from("chat_participants")
      .select("id, unread_count")
      .eq("chat_id", chatId)
      .neq("user_id", senderId)

    if (fetchError) return { error: fetchError }

    // Update each participant's unread count
    if (participants && participants.length > 0) {
      const updates = participants.map((p) =>
        supabase
          .from("chat_participants")
          .update({ unread_count: (p.unread_count || 0) + 1 })
          .eq("id", p.id),
      )

      const results = await Promise.all(updates)
      const firstError = results.find((r) => r.error)?.error

      return { error: firstError || null }
    }

    return { error: null }
  }

  return { error }
}

/**
 * Update message status (e.g., delivered, read)
 * @param messageId - Message ID
 * @param status - New status
 */
export async function updateMessageStatus(
  messageId: string,
  status: "sent" | "delivered" | "read" | "failed",
): Promise<{ error: PostgrestError | null }> {
  const { error } = await supabase.from("messages").update({ status }).eq("id", messageId)

  return { error }
}

/**
 * Delete a message (soft delete)
 * @param messageId - Message ID
 * @param userId - User ID who is deleting
 */
export async function deleteMessage(
  messageId: string,
  userId: string,
): Promise<{ error: PostgrestError | null }> {
  const { error } = await supabase
    .from("messages")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: userId,
      delete_type: "soft",
    })
    .eq("id", messageId)

  return { error }
}
