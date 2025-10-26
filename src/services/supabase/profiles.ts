import type { PostgrestError } from "@supabase/supabase-js"

import { supabase } from "./supabaseClient"
import { getCurrentUser } from "./auth"

/**
 * Profile Service
 * Operations for user profiles
 */

export interface Profile {
  id: string
  username: string
  name: string
  display_name?: string
  avatar_url?: string
  bio?: string
  phone?: string
  email?: string
  date_of_birth?: string
  gender?: string
  location?: string
  timezone?: string
  language?: string
  account_type?: string
  onboarding_completed?: boolean
  onboarding_step?: string
  created_at?: string
  updated_at?: string
}

export interface CreateProfileData {
  id: string // User ID from auth
  username: string
  name: string
  date_of_birth: string
  email?: string
}

export interface UpdateProfileData {
  username?: string
  name?: string
  display_name?: string
  avatar_url?: string
  bio?: string
  date_of_birth?: string
  gender?: string
  location?: string
  timezone?: string
  language?: string
  onboarding_completed?: boolean
  onboarding_step?: string
}

/**
 * Check if a username is available
 * @param username - Username to check
 * @returns True if available, false if taken or reserved
 */
export async function isUsernameAvailable(
  username: string,
): Promise<{ available: boolean; reason?: string; error?: PostgrestError }> {
  try {
    // Check if username meets regex requirements
    const usernameRegex = /^[a-z][a-z0-9_]{2,29}$/
    if (!usernameRegex.test(username)) {
      return {
        available: false,
        reason: "invalid",
      }
    }

    // Check if username is reserved
    const { data: reserved, error: reservedError } = await supabase
      .from("reserved_usernames")
      .select("username")
      .eq("username", username)
      .maybeSingle()

    if (reservedError) {
      return { available: false, error: reservedError }
    }

    if (reserved) {
      return { available: false, reason: "reserved" }
    }

    // Check if username is already taken
    const { data: existing, error: existingError } = await supabase
      .from("profiles")
      .select("username")
      .eq("username", username)
      .maybeSingle()

    if (existingError) {
      return { available: false, error: existingError }
    }

    if (existing) {
      return { available: false, reason: "taken" }
    }

    return { available: true }
  } catch (error) {
    return {
      available: false,
      error: error as PostgrestError,
    }
  }
}

/**
 * Create a new profile
 * @param profileData - Profile data
 */
export async function createProfile(
  profileData: CreateProfileData,
): Promise<{ data: Profile | null; error: PostgrestError | null }> {
  // Check username availability first
  const { available, reason } = await isUsernameAvailable(profileData.username)

  if (!available) {
    return {
      data: null,
      error: {
        message: reason === "reserved" ? "Username is reserved" : "Username is already taken",
        code: "USERNAME_UNAVAILABLE",
        details: reason,
        hint: null,
      } as PostgrestError,
    }
  }

  // Get current user's auth provider info
  const { user, error: userError } = await getCurrentUser()
  if (userError || !user) {
    return {
      data: null,
      error:
        userError ||
        ({
          message: "User not found",
          code: "USER_NOT_FOUND",
        } as PostgrestError),
    }
  }

  // Determine auth provider from user identities
  let authProvider = "email" // default
  const userIdentities = user.identities || []

  if (userIdentities.length > 0) {
    const provider = userIdentities[0].provider
    if (provider === "google" || provider === "apple") {
      authProvider = provider
    }
  }

  // Create profile
  const { data, error } = await supabase
    .from("profiles")
    .insert({
      id: profileData.id,
      username: profileData.username,
      name: profileData.name,
      date_of_birth: profileData.date_of_birth,
      email: profileData.email,
      auth_provider: authProvider, // ✅ Auth provider ekle
      onboarding_completed: true,
      is_active: true,
      account_status: "active",
    })
    .select()
    .single()

  return { data: data as Profile, error }
}

/**
 * Get profile by user ID
 * @param userId - User ID
 */
export async function getProfile(
  userId: string,
): Promise<{ data: Profile | null; error: PostgrestError | null }> {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle()

  return { data: data as Profile, error }
}

/**
 * Get profile by username
 * @param username - Username
 */
export async function getProfileByUsername(
  username: string,
): Promise<{ data: Profile | null; error: PostgrestError | null }> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username)
    .maybeSingle()

  return { data: data as Profile, error }
}

/**
 * Update profile
 * @param userId - User ID
 * @param updates - Profile updates
 */
export async function updateProfile(
  userId: string,
  updates: UpdateProfileData,
): Promise<{ data: Profile | null; error: PostgrestError | null }> {
  // If updating username, check availability
  if (updates.username) {
    const { available, reason } = await isUsernameAvailable(updates.username)

    if (!available) {
      return {
        data: null,
        error: {
          message: reason === "reserved" ? "Username is reserved" : "Username is already taken",
          code: "USERNAME_UNAVAILABLE",
          details: reason,
          hint: null,
        } as PostgrestError,
      }
    }
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)
    .select()
    .single()

  return { data: data as Profile, error }
}

/**
 * Check if user has completed onboarding
 * @param userId - User ID
 */
export async function hasCompletedOnboarding(
  userId: string,
): Promise<{ completed: boolean; error?: PostgrestError }> {
  const { data, error } = await supabase
    .from("profiles")
    .select("onboarding_completed")
    .eq("id", userId)
    .maybeSingle()

  if (error) {
    return { completed: false, error }
  }

  return { completed: data?.onboarding_completed ?? false }
}

/**
 * Mark onboarding as completed
 * @param userId - User ID
 */
export async function completeOnboarding(
  userId: string,
): Promise<{ error: PostgrestError | null }> {
  const { error } = await supabase
    .from("profiles")
    .update({
      onboarding_completed: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)

  return { error }
}
