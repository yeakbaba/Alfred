/**
 * Neo4j Sync Service
 * Handles syncing user data to Neo4j graph database
 */

const NEO4J_API_BASE_URL = "https://alfred-agents-830452200897.us-central1.run.app"
// const NEO4J_API_BASE_URL = "192.168.3.255:8080"

export interface SyncPersonPayload {
  supabase_id: string
  username: string
  name: string
  display_name?: string
  date_of_birth: string // Format: YYYY-MM-DD
  gender?: string
  location?: string
  language?: string
}

export interface SyncPersonResponse {
  success: boolean
  message?: string
  node_id?: string
  error?: string
}

export interface CreateConnectionPayload {
  user_id_1: string // Supabase user ID
  user_id_2: string // Supabase user ID
  relationship_type: string // e.g., "SPOUSE_OF", "PARENT_OF", etc.
  relationship_metadata?: Record<string, any> // Optional metadata
  relationship_since?: string // Format: YYYY-MM-DD
}

export interface CreateConnectionResponse {
  success: boolean
  message?: string
  connection_id?: string
  error?: string
}

export interface SendMessagePayload {
  message: string
  chat_id: string
  sender_id: string
  message_id: string
  participants: Array<{
    id: string
    name: string
  }>
  last_10_messages: Array<{
    sender_name: string
    content: string
    timestamp: string
  }>
  chat_settings: {
    alfred_enabled: boolean
    incognito: boolean
  }
}

export interface SendMessageResponse {
  success: boolean
  message?: string
  alfred_message_id?: string // Placeholder message ID for typing indicator
  alfred_response?: string | null
  memories_extracted?: number
  memories_queued?: number
  context_used?: boolean
  error?: string
}

export interface InitializeChatContextPayload {
  chat_id: string
  participants: Array<{
    id: string
    name: string
  }>
}

export interface InitializeChatContextResponse {
  success: boolean
  message?: string
  cache_initialized?: boolean
  relationship_summary?: string
  topic_summary?: string
  error?: string
}

/**
 * Sync person to Neo4j database
 * Creates a Person node with the given data
 */
export async function syncPersonToNeo4j(payload: SyncPersonPayload): Promise<SyncPersonResponse> {
  try {
    console.log("[Neo4j] Syncing person to Neo4j:", payload.username)

    const response = await fetch(`${NEO4J_API_BASE_URL}/sync-person`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[Neo4j] Sync failed:", response.status, errorText)
      return {
        success: false,
        error: `Failed to sync to Neo4j: ${response.status} ${errorText}`,
      }
    }

    const data = await response.json()
    console.log("[Neo4j] Sync successful:", data)

    return {
      success: true,
      message: data.message,
      node_id: data.node_id,
    }
  } catch (error) {
    console.error("[Neo4j] Sync error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Create or update relationship connection in Neo4j
 * This will create the relationship in Neo4j and sync to Supabase
 */
export async function createConnectionInNeo4j(
  payload: CreateConnectionPayload,
): Promise<CreateConnectionResponse> {
  try {
    console.log("[Neo4j] Creating connection:", payload.relationship_type)
    console.log("[Neo4j] Between:", payload.user_id_1, "and", payload.user_id_2)

    const response = await fetch(`${NEO4J_API_BASE_URL}/create-connection`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[Neo4j] Connection creation failed:", response.status, errorText)
      return {
        success: false,
        error: `Failed to create connection: ${response.status} ${errorText}`,
      }
    }

    const data = await response.json()
    console.log("[Neo4j] Connection created successfully:", data)

    return {
      success: true,
      message: data.message,
      connection_id: data.connection_id,
    }
  } catch (error) {
    console.error("[Neo4j] Connection creation error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Process message through Alfred's memory system (V2 - OPTIMIZED)
 * Called AFTER message is saved to Supabase
 *
 * V2 Optimizations:
 * - Uses alfred_context_cache (no vector search needed)
 * - Single GPT-4o-mini call for response + memories + topic update
 * - Client sends last 10 messages (no DB query needed)
 * - Expected performance: ~1.5-2s (vs old: ~25s)
 */
export async function processMessageWithAlfred(
  payload: SendMessagePayload,
): Promise<SendMessageResponse> {
  try {
    console.log("[Alfred] Processing message (v2):", {
      chat_id: payload.chat_id,
      message_length: payload.message.length,
      last_messages_count: payload.last_10_messages.length,
      alfred_enabled: payload.chat_settings.alfred_enabled,
    })

    const response = await fetch(`${NEO4J_API_BASE_URL}/send-message-v2`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[Alfred] Message processing failed:", response.status, errorText)
      return {
        success: false,
        error: `Failed to process message: ${response.status} ${errorText}`,
      }
    }

    const data = await response.json()
    console.log("[Alfred] Message processed successfully:", {
      alfred_response: !!data.alfred_response,
      memories_extracted: data.memories_extracted,
      memories_queued: data.memories_queued,
    })

    return {
      success: true,
      message: data.message,
      alfred_response: data.alfred_response,
      memories_extracted: data.memories_extracted,
      memories_queued: data.memories_queued,
      context_used: data.context_used,
    }
  } catch (error) {
    console.error("[Alfred] Message processing error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Initialize chat context cache for a chat
 * Called when chat is opened and has user_connections but no alfred_context_cache
 * Populates cache with relationship summary and recent topic summary
 */
export async function initializeChatContext(
  payload: InitializeChatContextPayload,
): Promise<InitializeChatContextResponse> {
  try {
    console.log("[Alfred] Initializing chat context:", {
      chat_id: payload.chat_id,
      participants_count: payload.participants.length,
    })

    const response = await fetch(`${NEO4J_API_BASE_URL}/initialize-chat-context`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[Alfred] Context initialization failed:", response.status, errorText)
      return {
        success: false,
        error: `Failed to initialize context: ${response.status} ${errorText}`,
      }
    }

    const data = await response.json()
    console.log("[Alfred] Context initialized successfully:", {
      cache_initialized: data.cache_initialized,
      has_relationship_summary: !!data.relationship_summary,
      has_topic_summary: !!data.topic_summary,
    })

    return {
      success: true,
      message: data.message,
      cache_initialized: data.cache_initialized,
      relationship_summary: data.relationship_summary,
      topic_summary: data.topic_summary,
    }
  } catch (error) {
    console.error("[Alfred] Context initialization error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
