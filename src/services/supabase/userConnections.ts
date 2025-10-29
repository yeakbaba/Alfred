import type { PostgrestError } from "@supabase/supabase-js"
import { supabase } from "./supabaseClient"

export interface UserConnection {
  id: string
  user_id: string
  connected_user_id: string
  connection_type?: string
  relationship_label?: string
  relationship_metadata?: {
    since?: string
    subtype?: string
    anniversary?: string
    [key: string]: any // Allow other metadata fields
  }
  relationship_context?: Record<string, any>
  neo4j_relationship_id?: string
  interaction_strength?: number
  last_interaction_at?: string
  shared_chat_count?: number
  message_exchange_count?: number
  neo4j_synced_at?: string
  created_at?: string
  updated_at?: string
}

export interface UpdateUserConnectionData {
  relationship_type_id?: string
  relationship_subtype?: string
  relationship_since?: string
}

export interface DatabaseResponse<T> {
  data: T | null
  error: PostgrestError | null
}

export async function getUserConnection(
  userId: string,
  connectedUserId: string,
): Promise<DatabaseResponse<UserConnection>> {
  const { data, error } = await supabase
    .from("user_connections")
    .select("*")
    .eq("user_id", userId)
    .eq("connected_user_id", connectedUserId)
    .maybeSingle()

  return { data: data as UserConnection, error }
}

export async function updateUserConnection(
  userId: string,
  connectedUserId: string,
  updates: UpdateUserConnectionData,
): Promise<DatabaseResponse<UserConnection>> {
  const { data, error } = await supabase
    .from("user_connections")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("connected_user_id", connectedUserId)
    .select()
    .single()

  return { data: data as UserConnection, error }
}

export async function createUserConnection(connectionData: {
  user_id: string
  connected_user_id: string
  relationship_type_id?: string | null
  relationship_subtype?: string
  relationship_since?: string
}): Promise<DatabaseResponse<UserConnection>> {
  const { data, error } = await supabase
    .from("user_connections")
    .insert({
      user_id: connectionData.user_id,
      connected_user_id: connectionData.connected_user_id,
      relationship_type_id: connectionData.relationship_type_id || null,
      relationship_subtype: connectionData.relationship_subtype,
      relationship_since: connectionData.relationship_since,
      connection_type: connectionData.relationship_type_id || null,
      last_interaction_at: new Date().toISOString(),
    })
    .select()
    .single()

  return { data: data as UserConnection, error }
}

/**
 * Check if user_connections exist between participants in a chat
 * Returns true if ANY connection exists
 */
export async function hasUserConnectionsForChat(
  participantIds: string[],
): Promise<DatabaseResponse<boolean>> {
  if (participantIds.length < 2) {
    return { data: false, error: null }
  }

  // Check if any connections exist between participants
  const { data, error } = await supabase
    .from("user_connections")
    .select("id")
    .or(
      participantIds
        .flatMap((id1) =>
          participantIds
            .filter((id2) => id2 !== id1)
            .map(
              (id2) =>
                `and(user_id.eq.${id1},connected_user_id.eq.${id2}),and(user_id.eq.${id2},connected_user_id.eq.${id1})`,
            ),
        )
        .join(","),
    )
    .limit(1)
    .maybeSingle()

  return { data: !!data, error }
}

/**
 * Check if alfred_context_cache exists for a chat
 */
export async function hasChatContextCache(
  chatId: string,
): Promise<DatabaseResponse<boolean>> {
  const { data, error } = await supabase
    .from("alfred_context_cache")
    .select("id")
    .eq("chat_id", chatId)
    .limit(1)
    .maybeSingle()

  return { data: !!data, error }
}

/**
 * Get all user connections for a user
 * Only returns connections where user_id matches (not duplicates from both directions)
 * @param userId - User ID
 * @returns Array of user connections ordered by last_interaction_at
 */
export async function getAllUserConnections(
  userId: string,
): Promise<DatabaseResponse<UserConnection[]>> {
  const { data, error } = await supabase
    .from("user_connections")
    .select("*")
    .eq("user_id", userId)
    .order("last_interaction_at", { ascending: false, nullsFirst: false })

  return { data: data as UserConnection[], error }
}
