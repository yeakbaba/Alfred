import { createClient } from "@supabase/supabase-js"
import * as SecureStore from "expo-secure-store"
import { Platform } from "react-native"

import Config from "@/config"

import type { Database } from "./types"

/**
 * Custom storage implementation for Supabase Auth
 * Uses expo-secure-store for secure token storage on native platforms
 * Falls back to memory storage for web
 */
class SupabaseStorage {
  private memoryStorage: Map<string, string> = new Map()

  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === "web") {
      return this.memoryStorage.get(key) ?? null
    }
    return await SecureStore.getItemAsync(key)
  }

  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === "web") {
      this.memoryStorage.set(key, value)
      return
    }
    await SecureStore.setItemAsync(key, value)
  }

  async removeItem(key: string): Promise<void> {
    if (Platform.OS === "web") {
      this.memoryStorage.delete(key)
      return
    }
    await SecureStore.deleteItemAsync(key)
  }
}

const supabaseStorage = new SupabaseStorage()

/**
 * Supabase client instance
 * Configured with secure storage for auth tokens
 */
export const supabase = createClient<Database>(Config.supabaseUrl, Config.supabaseAnonKey, {
  auth: {
    storage: supabaseStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // Important for mobile apps
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
    log_level: __DEV__ ? "info" : "error", // Enable debug logs in development
  },
})

/**
 * Helper function to check if Supabase is configured
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(Config.supabaseUrl && Config.supabaseAnonKey)
}
