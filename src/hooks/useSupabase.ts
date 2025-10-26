import { useState, useCallback } from "react"

import type { AuthResponse } from "@/services/supabase"
import * as supabaseService from "@/services/supabase"

/**
 * useSupabase Hook
 * Provides convenient access to Supabase operations with loading and error states
 */

export function useSupabase() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  /**
   * Execute an async Supabase operation with loading and error handling
   */
  const execute = useCallback(async <T,>(
    operation: () => Promise<T>,
    onSuccess?: (data: T) => void,
    onError?: (error: Error) => void,
  ): Promise<T | null> => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await operation()
      onSuccess?.(result)
      return result
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Unknown error")
      setError(error)
      onError?.(error)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * Sign in with Google
   */
  const signInWithGoogle = useCallback(
    async (
      onSuccess?: (data: AuthResponse) => void,
      onError?: (error: Error) => void,
    ): Promise<AuthResponse | null> => {
      return execute(
        () => supabaseService.signInWithGoogle(),
        onSuccess,
        onError,
      )
    },
    [execute],
  )

  /**
   * Sign in with Apple
   */
  const signInWithApple = useCallback(
    async (
      onSuccess?: (data: AuthResponse) => void,
      onError?: (error: Error) => void,
    ): Promise<AuthResponse | null> => {
      return execute(
        () => supabaseService.signInWithApple(),
        onSuccess,
        onError,
      )
    },
    [execute],
  )

  /**
   * Sign in with email
   */
  const signInWithEmail = useCallback(
    async (
      email: string,
      password: string,
      onSuccess?: (data: AuthResponse) => void,
      onError?: (error: Error) => void,
    ): Promise<AuthResponse | null> => {
      return execute(
        () => supabaseService.signInWithEmail(email, password),
        onSuccess,
        onError,
      )
    },
    [execute],
  )

  /**
   * Sign up with email
   */
  const signUpWithEmail = useCallback(
    async (
      email: string,
      password: string,
      onSuccess?: (data: AuthResponse) => void,
      onError?: (error: Error) => void,
    ): Promise<AuthResponse | null> => {
      return execute(
        () => supabaseService.signUpWithEmail(email, password),
        onSuccess,
        onError,
      )
    },
    [execute],
  )

  /**
   * Sign out
   */
  const signOut = useCallback(
    async (
      onSuccess?: () => void,
      onError?: (error: Error) => void,
    ): Promise<void> => {
      await execute(
        async () => {
          const result = await supabaseService.signOut()
          if (result.error) throw result.error
          return result
        },
        onSuccess,
        onError,
      )
    },
    [execute],
  )

  /**
   * Reset password
   */
  const resetPassword = useCallback(
    async (
      email: string,
      onSuccess?: () => void,
      onError?: (error: Error) => void,
    ): Promise<void> => {
      await execute(
        async () => {
          const result = await supabaseService.resetPassword(email)
          if (result.error) throw result.error
          return result
        },
        onSuccess,
        onError,
      )
    },
    [execute],
  )

  return {
    // State
    isLoading,
    error,

    // Auth methods
    signInWithGoogle,
    signInWithApple,
    signInWithEmail,
    signUpWithEmail,
    signOut,
    resetPassword,

    // Direct access to all Supabase services
    supabase: supabaseService,

    // Generic execute method for custom operations
    execute,
  }
}
