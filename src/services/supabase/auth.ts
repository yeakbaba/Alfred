import { makeRedirectUri } from "expo-auth-session"
import * as WebBrowser from "expo-web-browser"
import type { AuthError, Session, User } from "@supabase/supabase-js"

import { supabase } from "./supabaseClient"
import type { AuthResponse, OAuthProvider } from "./types"

/**
 * Warm up the browser on iOS for better OAuth experience
 */
WebBrowser.maybeCompleteAuthSession()

/**
 * Authentication Service
 * Handles all authentication operations with Supabase
 */

/**
 * Get the current user session
 */
export async function getCurrentSession(): Promise<{
  session: Session | null
  error: AuthError | null
}> {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession()
  return { session, error }
}

/**
 * Get the current user
 */
export async function getCurrentUser(): Promise<{
  user: User | null
  error: AuthError | null
}> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  return { user, error }
}

/**
 * Sign in with OAuth (Google or Apple)
 * @param provider - OAuth provider to use
 */
export async function signInWithOAuth(provider: OAuthProvider): Promise<AuthResponse> {
  try {
    const redirectTo = makeRedirectUri()

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        skipBrowserRedirect: true,
      },
    })

    if (error) {
      return { session: null, user: null, error }
    }

    if (!data.url) {
      return {
        session: null,
        user: null,
        error: {
          message: "No OAuth URL returned",
          name: "OAuthError",
          status: 400,
        } as AuthError,
      }
    }

    // Open the OAuth URL in the browser
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo)

    if (result.type === "success") {
      const url = result.url
      const params = new URL(url).searchParams

      // Check for error in the callback URL
      const error_description = params.get("error_description")
      if (error_description) {
        return {
          session: null,
          user: null,
          error: {
            message: error_description,
            name: "OAuthError",
            status: 400,
          } as AuthError,
        }
      }

      // Exchange the code for a session
      const code = params.get("code")
      if (code) {
        const { data: sessionData, error: sessionError } =
          await supabase.auth.exchangeCodeForSession(code)

        if (sessionError) {
          return { session: null, user: null, error: sessionError }
        }

        return {
          session: sessionData.session,
          user: sessionData.user,
          error: null,
        }
      }
    }

    return {
      session: null,
      user: null,
      error: {
        message: "OAuth flow was cancelled or failed",
        name: "OAuthError",
        status: 400,
      } as AuthError,
    }
  } catch (error) {
    return {
      session: null,
      user: null,
      error: {
        message: error instanceof Error ? error.message : "Unknown error",
        name: "OAuthError",
        status: 500,
      } as AuthError,
    }
  }
}

/**
 * Sign in with Google
 */
export async function signInWithGoogle(): Promise<AuthResponse> {
  return signInWithOAuth("google")
}

/**
 * Sign in with Apple
 */
export async function signInWithApple(): Promise<AuthResponse> {
  return signInWithOAuth("apple")
}

/**
 * Sign in with email and password
 * @param email - User email
 * @param password - User password
 */
export async function signInWithEmail(
  email: string,
  password: string,
): Promise<AuthResponse> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  return {
    session: data.session,
    user: data.user,
    error,
  }
}

/**
 * Sign up with email and password
 * @param email - User email
 * @param password - User password
 */
export async function signUpWithEmail(
  email: string,
  password: string,
): Promise<AuthResponse> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  })

  return {
    session: data.session,
    user: data.user,
    error,
  }
}

/**
 * Sign out the current user
 */
export async function signOut(): Promise<{ error: AuthError | null }> {
  const { error } = await supabase.auth.signOut()
  return { error }
}

/**
 * Send a password reset email
 * @param email - User email
 */
export async function resetPassword(
  email: string,
): Promise<{ error: AuthError | null }> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: makeRedirectUri(),
  })
  return { error }
}

/**
 * Update user password
 * @param newPassword - New password
 */
export async function updatePassword(
  newPassword: string,
): Promise<{ error: AuthError | null }> {
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  })
  return { error }
}

/**
 * Update user metadata
 * @param metadata - User metadata to update
 */
export async function updateUserMetadata(metadata: {
  [key: string]: any
}): Promise<AuthResponse> {
  const { data, error } = await supabase.auth.updateUser({
    data: metadata,
  })

  return {
    session: data.session,
    user: data.user,
    error,
  }
}

/**
 * Listen to auth state changes
 * @param callback - Function to call when auth state changes
 * @returns Unsubscribe function
 */
export function onAuthStateChange(
  callback: (session: Session | null, user: User | null) => void,
): () => void {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session, session?.user ?? null)
  })

  return () => {
    subscription.unsubscribe()
  }
}
