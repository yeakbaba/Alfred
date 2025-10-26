// app/index.tsx - DÜZELT

import { useEffect, useState } from "react"
import { ActivityIndicator, View } from "react-native"
import { Redirect } from "expo-router"

import { useAuth } from "@/hooks/useAuth"
import { getProfile } from "@/services/supabase"

export default function Index() {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth()
  const [profileLoading, setProfileLoading] = useState(true)
  const [hasProfile, setHasProfile] = useState(false)

  useEffect(() => {
    let isMounted = true // memory leak fix

    const checkProfile = async () => {
      if (!user?.id || !isAuthenticated) {
        if (isMounted) setProfileLoading(false)
        return
      }

      try {
        const { data, error } = await getProfile(user.id)
        
        if (isMounted) {
          if (error) {
            console.error("Error checking profile:", error)
            setHasProfile(false)
          } else {
            setHasProfile(!!data && data.onboarding_completed === true)
          }
        }
      } finally {
        if (isMounted) setProfileLoading(false)
      }
    }

    if (isAuthenticated && !authLoading) {
      checkProfile()
    } else if (!authLoading) {
      setProfileLoading(false)
    }

    return () => {
      isMounted = false
    }
  }, [isAuthenticated, authLoading, user?.id])

  // Show loading while checking auth or profile
  if (authLoading || profileLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    )
  }

  // If not authenticated, redirect to login
  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />
  }

  // If authenticated but no profile, redirect to onboarding
  if (!hasProfile) {
    return <Redirect href="/onboarding" />
  }

  // If authenticated and has profile, redirect to chats
  return <Redirect href="/(tabs)/chats" />
}