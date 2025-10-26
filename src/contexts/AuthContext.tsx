import React, { createContext, useContext, useEffect, useState } from "react"
import type { Session, User } from "@supabase/supabase-js"

import { getCurrentSession, onAuthStateChange } from "@/services/supabase"

/**
 * Auth Context
 * Provides global authentication state management
 */

interface AuthContextType {
  session: Session | null
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: React.ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Load initial session
    const loadSession = async () => {
      try {
        const { session: initialSession } = await getCurrentSession()
        setSession(initialSession)
        setUser(initialSession?.user ?? null)
      } catch (error) {
        console.error("Error loading session:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadSession()

    // Listen for auth changes
    const unsubscribe = onAuthStateChange((newSession, newUser) => {
      setSession(newSession)
      setUser(newUser)
      setIsLoading(false)
    })

    return () => {
      unsubscribe()
    }
  }, [])

  const value: AuthContextType = {
    session,
    user,
    isLoading,
    isAuthenticated: !!session && !!user,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/**
 * Hook to access auth context
 * @throws Error if used outside of AuthProvider
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)

  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }

  return context
}
