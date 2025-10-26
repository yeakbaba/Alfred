import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
  RealtimePresenceState,
} from "@supabase/supabase-js"

import { supabase } from "./supabaseClient"

/**
 * Realtime Service
 * Helper functions for Realtime subscriptions
 */

export type DatabaseChangeEvent = "INSERT" | "UPDATE" | "DELETE" | "*"

export interface RealtimeSubscription {
  channel: RealtimeChannel
  unsubscribe: () => void
}

/**
 * Subscribe to database changes on a table
 * @param table - Table name to subscribe to
 * @param event - Event type to listen for (INSERT, UPDATE, DELETE, or *)
 * @param callback - Function to call when changes occur
 * @param filter - Optional filter (e.g., { column: 'id', value: '123' })
 * @returns Subscription object with unsubscribe method
 */
export function subscribeToTable<T>(
  table: string,
  event: DatabaseChangeEvent,
  callback: (payload: RealtimePostgresChangesPayload<T>) => void,
  filter?: { column: string; value: string },
): RealtimeSubscription {
  const channelName = `table-${table}-${Date.now()}`
  console.log(`[Realtime] Creating subscription: ${channelName}`, { event, table, filter })

  let channel = supabase
    .channel(channelName)
    .on(
      "postgres_changes",
      {
        event,
        schema: "public",
        table,
        filter: filter ? `${filter.column}=eq.${filter.value}` : undefined,
      },
      callback,
    )
    .subscribe((status, err) => {
      console.log(`[Realtime] Subscription ${channelName} status:`, status)
      if (err) {
        console.error(`[Realtime] Subscription ${channelName} error:`, err)
      }
    })

  return {
    channel,
    unsubscribe: () => {
      console.log(`[Realtime] Unsubscribing from ${channelName}`)
      supabase.removeChannel(channel)
    },
  }
}

/**
 * Subscribe to INSERT events on a table
 * @param table - Table name
 * @param callback - Callback function
 * @param filter - Optional filter
 */
export function subscribeToInserts<T>(
  table: string,
  callback: (payload: RealtimePostgresChangesPayload<T>) => void,
  filter?: { column: string; value: string },
): RealtimeSubscription {
  return subscribeToTable(table, "INSERT", callback, filter)
}

/**
 * Subscribe to UPDATE events on a table
 * @param table - Table name
 * @param callback - Callback function
 * @param filter - Optional filter
 */
export function subscribeToUpdates<T>(
  table: string,
  callback: (payload: RealtimePostgresChangesPayload<T>) => void,
  filter?: { column: string; value: string },
): RealtimeSubscription {
  return subscribeToTable(table, "UPDATE", callback, filter)
}

/**
 * Subscribe to DELETE events on a table
 * @param table - Table name
 * @param callback - Callback function
 * @param filter - Optional filter
 */
export function subscribeToDeletes<T>(
  table: string,
  callback: (payload: RealtimePostgresChangesPayload<T>) => void,
  filter?: { column: string; value: string },
): RealtimeSubscription {
  return subscribeToTable(table, "DELETE", callback, filter)
}

/**
 * Subscribe to all changes on a table
 * @param table - Table name
 * @param callback - Callback function
 * @param filter - Optional filter
 */
export function subscribeToAllChanges<T>(
  table: string,
  callback: (payload: RealtimePostgresChangesPayload<T>) => void,
  filter?: { column: string; value: string },
): RealtimeSubscription {
  return subscribeToTable(table, "*", callback, filter)
}

/**
 * Subscribe to a broadcast channel
 * @param channelName - Channel name
 * @param event - Event name to listen for
 * @param callback - Function to call when broadcast is received
 * @returns Subscription object with unsubscribe method
 */
export function subscribeToBroadcast<T = any>(
  channelName: string,
  event: string,
  callback: (payload: T) => void,
): RealtimeSubscription {
  const channel = supabase
    .channel(channelName)
    .on("broadcast", { event }, ({ payload }) => callback(payload as T))
    .subscribe()

  return {
    channel,
    unsubscribe: () => {
      supabase.removeChannel(channel)
    },
  }
}

/**
 * Send a broadcast message to a channel
 * @param channelName - Channel name
 * @param event - Event name
 * @param payload - Data to broadcast
 */
export async function sendBroadcast<T = any>(
  channelName: string,
  event: string,
  payload: T,
): Promise<"ok" | "timed out" | "rate limited"> {
  const channel = supabase.channel(channelName)
  await channel.subscribe()
  return channel.send({
    type: "broadcast",
    event,
    payload,
  })
}

/**
 * Subscribe to presence (user online/offline tracking)
 * @param channelName - Channel name
 * @param userId - User ID to track
 * @param userMetadata - Additional user metadata
 * @param onSync - Callback when presence state syncs
 * @param onJoin - Callback when user joins
 * @param onLeave - Callback when user leaves
 * @returns Subscription object with unsubscribe method
 */
export function subscribeToPresence(
  channelName: string,
  userId: string,
  userMetadata?: Record<string, any>,
  callbacks?: {
    onSync?: (state: RealtimePresenceState) => void
    onJoin?: (key: string, current: any, previous: any) => void
    onLeave?: (key: string, current: any, previous: any) => void
  },
): RealtimeSubscription {
  let channel = supabase.channel(channelName)

  // Set up presence tracking
  if (callbacks?.onSync) {
    channel = channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState()
      callbacks.onSync?.(state)
    })
  }

  if (callbacks?.onJoin) {
    channel = channel.on("presence", { event: "join" }, ({ key, newPresences }) => {
      callbacks.onJoin?.(key, newPresences, null)
    })
  }

  if (callbacks?.onLeave) {
    channel = channel.on("presence", { event: "leave" }, ({ key, leftPresences }) => {
      callbacks.onLeave?.(key, null, leftPresences)
    })
  }

  // Subscribe and track this user
  channel.subscribe(async (status) => {
    if (status === "SUBSCRIBED") {
      await channel.track({
        user_id: userId,
        online_at: new Date().toISOString(),
        ...userMetadata,
      })
    }
  })

  return {
    channel,
    unsubscribe: () => {
      channel.untrack()
      supabase.removeChannel(channel)
    },
  }
}

/**
 * Get current presence state for a channel
 * @param channelName - Channel name
 * @returns Promise that resolves to presence state
 */
export async function getPresenceState(
  channelName: string,
): Promise<RealtimePresenceState | null> {
  const channel = supabase.channel(channelName)

  return new Promise((resolve) => {
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        const state = channel.presenceState()
        resolve(state)
        supabase.removeChannel(channel)
      }
    })
  })
}

/**
 * Unsubscribe from all channels
 */
export async function unsubscribeAll(): Promise<void> {
  await supabase.removeAllChannels()
}
