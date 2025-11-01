import * as Notifications from "expo-notifications"
import * as Device from "expo-device"
import { Platform } from "react-native"
import { supabase } from "@/services/supabase"

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

/**
 * Request notification permissions from the user
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  let token: string | null = null

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF231F7C",
    })
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync()
    let finalStatus = existingStatus

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync()
      finalStatus = status
    }

    if (finalStatus !== "granted") {
      console.log("Failed to get push token for push notification!")
      return null
    }

    try {
      // Get the Expo push token
      // Note: projectId is optional when using Expo Go
      // For production builds, get projectId from app.json extra.eas.projectId
      const tokenData = await Notifications.getExpoPushTokenAsync()
      token = tokenData.data
      console.log("✅ Push token retrieved:", token)
    } catch (error) {
      // Check if this is Android Firebase error first
      if (error instanceof Error && Platform.OS === "android" && error.message.includes("FirebaseApp")) {
        console.warn("⚠️  Android push notifications require Firebase setup.")
        console.warn("⚠️  See: https://docs.expo.dev/push-notifications/fcm-credentials/")
        console.warn("⚠️  For now, using mock token for development.")

        // Use mock token for Android development without Firebase
        if (__DEV__) {
          token = `ExponentPushToken[ANDROID-MOCK-${Date.now()}]`
          console.log("🧪 Development mode: Using mock Android push token:", token)
        }
      } else {
        // Log other errors normally
        console.error("❌ Error getting push token:", error)
        if (error instanceof Error) {
          console.error("Error message:", error.message)
          console.error("Error stack:", error.stack)
        }
      }
    }
  } else {
    console.log("⚠️  Running on simulator/emulator - Push notifications require physical device")

    // DEVELOPMENT ONLY: Use mock token for testing database integration
    if (__DEV__) {
      token = `ExponentPushToken[SIMULATOR-MOCK-${Date.now()}]`
      console.log("🧪 Development mode: Using mock push token:", token)
      console.log("⚠️  This token won't receive actual notifications. Use physical device for real testing.")
    }
  }

  return token
}

/**
 * Save push token to user profile in Supabase
 */
export async function savePushToken(userId: string, token: string): Promise<void> {
  console.log("💾 Attempting to save push token for user:", userId)
  console.log("💾 Token to save:", token)

  try {
    const { data, error } = await supabase
      .from("profiles")
      .update({ push_token: token })
      .eq("id", userId)
      .select()

    if (error) {
      console.error("❌ Supabase error saving push token:", error)
      throw error
    }

    console.log("✅ Push token saved successfully!", data)
  } catch (error) {
    console.error("❌ Error saving push token:", error)
    if (error instanceof Error) {
      console.error("Error details:", error.message)
    }
  }
}

/**
 * Remove push token from user profile (on logout)
 */
export async function removePushToken(userId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from("profiles")
      .update({ push_token: null })
      .eq("id", userId)

    if (error) throw error
    console.log("Push token removed successfully")
  } catch (error) {
    console.error("Error removing push token:", error)
  }
}

/**
 * Add notification listener for when notifications are received
 */
export function addNotificationReceivedListener(
  callback: (notification: Notifications.Notification) => void,
) {
  return Notifications.addNotificationReceivedListener(callback)
}

/**
 * Add notification listener for when user taps on notification
 */
export function addNotificationResponseReceivedListener(
  callback: (response: Notifications.NotificationResponse) => void,
) {
  return Notifications.addNotificationResponseReceivedListener(callback)
}

/**
 * Schedule a local notification (for testing)
 */
export async function scheduleLocalNotification(title: string, body: string, data?: any) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: true,
    },
    trigger: { seconds: 1 },
  })
}

/**
 * Cancel all scheduled notifications
 */
export async function cancelAllNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync()
}

/**
 * Get notification permissions status
 */
export async function getNotificationPermissions() {
  return await Notifications.getPermissionsAsync()
}

/**
 * Check if notifications are enabled
 */
export async function areNotificationsEnabled(): Promise<boolean> {
  const { status } = await getNotificationPermissions()
  return status === "granted"
}
