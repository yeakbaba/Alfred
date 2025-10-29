import type { PostgrestError } from "@supabase/supabase-js"
import { supabase } from "./supabaseClient"

/**
 * User Connections Service
 * Operations for managing user connections and invitations
 */

export interface UserConnection {
  id: string
  user_id_1: string
  user_id_2: string
  connection_type?: string | null
  relationship_details?: any
  last_interaction_at?: string
  created_at: string
  updated_at: string
  // Joined profile data
  profile?: {
    id: string
    username: string
    name: string
    avatar_url?: string
  }
}

export interface Invitation {
  id: string
  sender_id: string
  receiver_id: string
  status: "pending" | "accepted" | "rejected"
  message?: string
  created_at: string
  updated_at: string
  // Joined profile data
  sender_profile?: {
    id: string
    username: string
    name: string
    avatar_url?: string
  }
  receiver_profile?: {
    id: string
    username: string
    name: string
    avatar_url?: string
  }
}

/**
 * Get all user connections for a user
 */
export async function getUserConnections(
  userId: string,
): Promise<{ data: UserConnection[] | null; error: PostgrestError | null }> {
  // First get the connections
  const { data: connections, error: connectionsError } = await supabase
    .from("user_connections")
    .select("*")
    .or(`user_id_1.eq.${userId},user_id_2.eq.${userId}`)
    .order("last_interaction_at", { ascending: false, nullsFirst: false })

  if (connectionsError || !connections) {
    return { data: null, error: connectionsError }
  }

  // Now fetch profiles for each connection
  const enrichedConnections = await Promise.all(
    connections.map(async (connection) => {
      // Determine which user is the "other" user
      const otherUserId = connection.user_id_1 === userId ? connection.user_id_2 : connection.user_id_1

      // Fetch the other user's profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, username, name, avatar_url")
        .eq("id", otherUserId)
        .single()

      return {
        ...connection,
        profile,
      } as UserConnection
    }),
  )

  return { data: enrichedConnections, error: null }
}

/**
 * Get sent invitations (user is sender)
 */
export async function getSentInvitations(
  userId: string,
): Promise<{ data: Invitation[] | null; error: PostgrestError | null }> {
  // First get the invitations
  const { data: invitations, error: invitationsError } = await supabase
    .from("user_invitations")
    .select("*")
    .eq("sender_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })

  if (invitationsError || !invitations) {
    return { data: null, error: invitationsError }
  }

  // Now fetch receiver profiles
  const enrichedInvitations = await Promise.all(
    invitations.map(async (invitation) => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, username, name, avatar_url")
        .eq("id", invitation.receiver_id)
        .single()

      return {
        ...invitation,
        receiver_profile: profile,
      } as Invitation
    }),
  )

  return { data: enrichedInvitations, error: null }
}

/**
 * Get received invitations (user is receiver)
 */
export async function getReceivedInvitations(
  userId: string,
): Promise<{ data: Invitation[] | null; error: PostgrestError | null }> {
  // First get the invitations
  const { data: invitations, error: invitationsError } = await supabase
    .from("user_invitations")
    .select("*")
    .eq("receiver_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })

  if (invitationsError || !invitations) {
    return { data: null, error: invitationsError }
  }

  // Now fetch sender profiles
  const enrichedInvitations = await Promise.all(
    invitations.map(async (invitation) => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, username, name, avatar_url")
        .eq("id", invitation.sender_id)
        .single()

      return {
        ...invitation,
        sender_profile: profile,
      } as Invitation
    }),
  )

  return { data: enrichedInvitations, error: null }
}

/**
 * Accept an invitation
 */
export async function acceptInvitation(
  invitationId: string,
  senderId: string,
  receiverId: string,
): Promise<{ data: UserConnection | null; error: PostgrestError | null }> {
  // Start a transaction-like operation
  // 1. Update invitation status
  const { error: updateError } = await supabase
    .from("user_invitations")
    .update({ status: "accepted", updated_at: new Date().toISOString() })
    .eq("id", invitationId)

  if (updateError) {
    return { data: null, error: updateError }
  }

  // 2. Create user connection
  const { data, error } = await supabase
    .from("user_connections")
    .insert({
      user_id_1: senderId,
      user_id_2: receiverId,
      last_interaction_at: new Date().toISOString(),
    })
    .select()
    .single()

  return { data: data as UserConnection, error }
}

/**
 * Reject an invitation
 */
export async function rejectInvitation(
  invitationId: string,
): Promise<{ error: PostgrestError | null }> {
  const { error } = await supabase
    .from("user_invitations")
    .update({ status: "rejected", updated_at: new Date().toISOString() })
    .eq("id", invitationId)

  return { error }
}

/**
 * Send an invitation
 */
export async function sendInvitation(
  senderId: string,
  receiverId: string,
  message?: string,
): Promise<{ data: Invitation | null; error: PostgrestError | null }> {
  const { data, error } = await supabase
    .from("user_invitations")
    .insert({
      sender_id: senderId,
      receiver_id: receiverId,
      message,
      status: "pending",
    })
    .select()
    .single()

  return { data: data as Invitation, error }
}

/**
 * Update connection relationship
 */
export async function updateConnectionRelationship(
  connectionId: string,
  connectionType: string,
  relationshipDetails?: any,
): Promise<{ data: UserConnection | null; error: PostgrestError | null }> {
  const { data, error } = await supabase
    .from("user_connections")
    .update({
      connection_type: connectionType,
      relationship_details: relationshipDetails,
      updated_at: new Date().toISOString(),
    })
    .eq("id", connectionId)
    .select()
    .single()

  return { data: data as UserConnection, error }
}

/**
 * Get a specific connection between two users
 */
export async function getConnection(
  userId1: string,
  userId2: string,
): Promise<{ data: UserConnection | null; error: PostgrestError | null }> {
  const { data, error } = await supabase
    .from("user_connections")
    .select("*")
    .or(
      `and(user_id_1.eq.${userId1},user_id_2.eq.${userId2}),and(user_id_1.eq.${userId2},user_id_2.eq.${userId1})`,
    )
    .maybeSingle()

  return { data: data as UserConnection, error }
}
