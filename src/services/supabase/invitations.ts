import type { PostgrestError } from "@supabase/supabase-js"
import { supabase } from "./supabaseClient"

export interface Invitation {
  id: string
  invited_by: string
  invite_type: "username" | "email" | "phone" | "link"
  invite_value?: string
  invitation_context: "chat" | "relationship" | "family" | "general"
  related_chat_id?: string
  proposed_relationship_type?: string
  personal_message?: string
  invite_code?: string
  invite_link?: string
  max_uses: number
  use_count: number
  status: "pending" | "accepted" | "rejected" | "expired" | "cancelled"
  accepted_by?: string
  accepted_at?: string
  expires_at?: string
  created_at: string
}

export interface DatabaseResponse<T> {
  data: T | null
  error: PostgrestError | null
}

/**
 * Get invitation for a chat sent to a specific user
 * Returns pending or recently accepted invitations
 * @param chatId - Chat ID
 * @param username - Username of the invited user
 */
export async function getInvitationForChat(
  chatId: string,
  username: string,
): Promise<DatabaseResponse<Invitation>> {
  const { data, error } = await supabase
    .from("invitations")
    .select("*")
    .eq("related_chat_id", chatId)
    .eq("invite_type", "username")
    .eq("invite_value", username)
    .in("status", ["pending", "accepted"]) // Include accepted invitations too
    .eq("invitation_context", "chat")
    .order("created_at", { ascending: false }) // Get most recent
    .limit(1)
    .maybeSingle()

  return { data: data as Invitation, error }
}

/**
 * Accept an invitation
 * @param invitationId - Invitation ID
 * @param userId - User ID who is accepting
 */
export async function acceptInvitation(
  invitationId: string,
  userId: string,
): Promise<DatabaseResponse<Invitation>> {
  const { data, error } = await supabase
    .from("invitations")
    .update({
      status: "accepted",
      accepted_by: userId,
      accepted_at: new Date().toISOString(),
    })
    .eq("id", invitationId)
    .select()
    .single()

  return { data: data as Invitation, error }
}

/**
 * Reject an invitation
 * @param invitationId - Invitation ID
 */
export async function rejectInvitation(
  invitationId: string,
): Promise<DatabaseResponse<Invitation>> {
  const { data, error } = await supabase
    .from("invitations")
    .update({
      status: "rejected",
    })
    .eq("id", invitationId)
    .select()
    .single()

  return { data: data as Invitation, error }
}

/**
 * Remove a participant from a chat
 * @param chatId - Chat ID
 * @param userId - User ID to remove
 */
export async function removeParticipantFromChat(
  chatId: string,
  userId: string,
): Promise<{ error: PostgrestError | null }> {
  const { error } = await supabase
    .from("chat_participants")
    .delete()
    .eq("chat_id", chatId)
    .eq("user_id", userId)

  return { error }
}
