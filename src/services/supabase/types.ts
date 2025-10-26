import type { Session, User, AuthError } from "@supabase/supabase-js"

/**
 * Supabase service types
 */

export interface AuthSession {
  session: Session | null
  user: User | null
}

export interface AuthResponse {
  session: Session | null
  user: User | null
  error: AuthError | null
}

export interface DatabaseQuery<T> {
  data: T | null
  error: Error | null
}

export interface StorageUpload {
  path: string | null
  error: Error | null
}

export interface RealtimeSubscription {
  unsubscribe: () => void
}

export type OAuthProvider = "google" | "apple"

/**
 * Supabase table types
 * Define your database table types here
 */

// Example:
// export interface Profile {
//   id: string
//   username: string
//   avatar_url?: string
//   created_at: string
// }

export interface Database {
  // Define your database schema types here
  // Example:
  // public: {
  //   Tables: {
  //     profiles: {
  //       Row: Profile
  //       Insert: Omit<Profile, 'id' | 'created_at'>
  //       Update: Partial<Omit<Profile, 'id' | 'created_at'>>
  //     }
  //   }
  // }
}
