import { useEffect, useRef } from "react"
import { useRouter } from "expo-router"
import * as Notifications from "expo-notifications"
import {
  registerForPushNotificationsAsync,
  savePushToken,
  addNotificationReceivedListener,
  addNotificationResponseReceivedListener,
} from "@/services/notifications"
import { useAuth } from "./useAuth"

/**
 * Hook to handle push notifications
 * - Registers for push notifications
 * - Saves push token to user profile
 * - Handles notification received/tapped events
 */
export function useNotifications() {
  const { user } = useAuth()
  const router = useRouter()
  const notificationListener = useRef<Notifications.Subscription>()
  const responseListener = useRef<Notifications.Subscription>()

  useEffect(() => {
    if (!user) {
      console.log("⚠️  useNotifications: No user, skipping notification registration")
      return
    }

    console.log("🔔 useNotifications: Registering for push notifications for user:", user.id)

    // Register for push notifications and save token
    registerForPushNotificationsAsync()
      .then((token) => {
        if (token && user.id) {
          console.log("✅ Token received, saving to database:", token)
          savePushToken(user.id, token)
        } else {
          console.log("⚠️  No token received or no user ID")
        }
      })
      .catch((error) => {
        console.error("❌ Error in registerForPushNotificationsAsync:", error)
      })

    // Listener for notifications received while app is foregrounded
    notificationListener.current = addNotificationReceivedListener((notification) => {
      console.log("Notification received:", notification)
      // You can show a custom in-app notification here if desired
    })

    // Listener for when user taps on a notification
    responseListener.current = addNotificationResponseReceivedListener((response) => {
      console.log("Notification tapped:", response)

      // Navigate to the relevant chat if chat_id is provided
      const data = response.notification.request.content.data
      if (data?.chatId) {
        router.push(`/chats/${data.chatId}`)
      }
    })

    // Cleanup listeners on unmount
    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove()
      }
      if (responseListener.current) {
        responseListener.current.remove()
      }
    }
  }, [user])

  return {
    // You can expose additional notification functions here if needed
  }
}
