import { useState, useEffect } from "react"
import { useAuth } from "@/hooks/useAuth"
import {
  getSentInvitations,
  getReceivedInvitations,
} from "@/services/supabase/invitations"
import { getAllUserConnections } from "@/services/supabase/userConnections"
import { getProfile } from "@/services/supabase/profiles"
import { supabase } from "@/services/supabase"

/**
 * Hook to calculate the badge count for Contacts tab
 * Badge shows: received invitations + connections without relationship type
 */
export function useContactsBadge() {
  const { user } = useAuth()
  const [badgeCount, setBadgeCount] = useState(0)
  const [loading, setLoading] = useState(true)

  async function calculateBadgeCount() {
    if (!user) {
      setBadgeCount(0)
      setLoading(false)
      return
    }

    try {
      // Get user profile for username
      const { data: profile } = await getProfile(user.id)
      if (!profile) {
        setBadgeCount(0)
        setLoading(false)
        return
      }

      // Get received invitations count
      const { data: receivedInvitations } = await getReceivedInvitations(profile.username)
      const receivedCount = receivedInvitations?.length || 0

      // Get connections without relationship type
      const { data: connections } = await getAllUserConnections(user.id)
      const undefinedRelationshipsCount =
        connections?.filter((conn) => !conn.connection_type).length || 0

      const total = receivedCount + undefinedRelationshipsCount
      setBadgeCount(total)
    } catch (error) {
      console.error("Error calculating contacts badge count:", error)
      setBadgeCount(0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    calculateBadgeCount()

    // Setup realtime subscription for invitations
    if (!user) return

    const channel = supabase
      .channel("contacts-badge-invitations")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "invitations",
        },
        () => {
          calculateBadgeCount()
        },
      )
      .subscribe()

    const connectionsChannel = supabase
      .channel("contacts-badge-connections")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_connections",
        },
        () => {
          calculateBadgeCount()
        },
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
      connectionsChannel.unsubscribe()
    }
  }, [user?.id])

  return { badgeCount, loading }
}
