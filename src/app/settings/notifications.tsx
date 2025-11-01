import { useState, useEffect } from "react"
import { View, ViewStyle, Switch, Pressable, TextStyle, Alert } from "react-native"
import { useRouter } from "expo-router"
import { MaterialCommunityIcons } from "@expo/vector-icons"

import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { ListItem } from "@/components/ListItem"
import { translate } from "@/i18n"
import { useAuth } from "@/hooks/useAuth"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"
import { supabase } from "@/services/supabase"

export default function NotificationsSettingsScreen() {
  const router = useRouter()
  const { themed, theme } = useAppTheme()
  const { user } = useAuth()

  // Notification preferences state
  const [pushEnabled, setPushEnabled] = useState(true)
  const [messageNotifications, setMessageNotifications] = useState(true)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [vibrationEnabled, setVibrationEnabled] = useState(true)
  const [showPreview, setShowPreview] = useState(true)
  const [loading, setLoading] = useState(true)

  // Load preferences from database
  useEffect(() => {
    loadPreferences()
  }, [user])

  async function loadPreferences() {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("notifications_enabled, message_notifications, sound_enabled, vibration_enabled, show_preview")
        .eq("id", user.id)
        .single()

      if (error) throw error

      if (data) {
        setPushEnabled(data.notifications_enabled ?? true)
        setMessageNotifications(data.message_notifications ?? true)
        setSoundEnabled(data.sound_enabled ?? true)
        setVibrationEnabled(data.vibration_enabled ?? true)
        setShowPreview(data.show_preview ?? true)
      }
    } catch (error) {
      console.error("Error loading notification preferences:", error)
    } finally {
      setLoading(false)
    }
  }

  async function savePreference(field: string, value: boolean) {
    if (!user) return

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ [field]: value })
        .eq("id", user.id)

      if (error) throw error
    } catch (error) {
      console.error("Error saving preference:", error)
      Alert.alert(translate("common:error"), "Failed to save notification preference")
    }
  }

  function handlePushEnabledChange(value: boolean) {
    setPushEnabled(value)
    savePreference("notifications_enabled", value)
  }

  function handleMessageNotificationsChange(value: boolean) {
    setMessageNotifications(value)
    savePreference("message_notifications", value)
  }

  function handleSoundEnabledChange(value: boolean) {
    setSoundEnabled(value)
    savePreference("sound_enabled", value)
  }

  function handleVibrationEnabledChange(value: boolean) {
    setVibrationEnabled(value)
    savePreference("vibration_enabled", value)
  }

  function handleShowPreviewChange(value: boolean) {
    setShowPreview(value)
    savePreference("show_preview", value)
  }

  return (
    <Screen preset="scroll" safeAreaEdges={["top"]} contentContainerStyle={themed($container)}>
      {/* Header with back button */}
      <View style={themed($header)}>
        <Pressable onPress={() => router.back()} style={themed($backButton)}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.text} />
        </Pressable>
        <Text preset="heading" tx="settings:notifications.title" style={themed($headerTitle)} />
      </View>

      {/* Push Notifications */}
      <View style={themed($section)}>
        <Text
          preset="subheading"
          tx="settings:notifications.pushNotifications"
          style={themed($sectionTitle)}
        />

        <ListItem
          tx="settings:notifications.enablePush"
          topSeparator
          bottomSeparator
          RightComponent={
            <Switch
              value={pushEnabled}
              onValueChange={handlePushEnabledChange}
              trackColor={{ false: theme.colors.separator, true: theme.colors.tint }}
              thumbColor={theme.colors.background}
            />
          }
        />
      </View>

      {/* Message Notifications */}
      <View style={themed($section)}>
        <Text
          preset="subheading"
          tx="settings:notifications.messageNotifications"
          style={themed($sectionTitle)}
        />

        <ListItem
          tx="settings:notifications.newMessages"
          topSeparator
          RightComponent={
            <Switch
              value={messageNotifications}
              onValueChange={handleMessageNotificationsChange}
              disabled={!pushEnabled}
              trackColor={{ false: theme.colors.separator, true: theme.colors.tint }}
              thumbColor={theme.colors.background}
            />
          }
        />

        <ListItem
          tx="settings:notifications.sound"
          RightComponent={
            <Switch
              value={soundEnabled}
              onValueChange={handleSoundEnabledChange}
              disabled={!pushEnabled || !messageNotifications}
              trackColor={{ false: theme.colors.separator, true: theme.colors.tint }}
              thumbColor={theme.colors.background}
            />
          }
        />

        <ListItem
          tx="settings:notifications.vibration"
          RightComponent={
            <Switch
              value={vibrationEnabled}
              onValueChange={handleVibrationEnabledChange}
              disabled={!pushEnabled || !messageNotifications}
              trackColor={{ false: theme.colors.separator, true: theme.colors.tint }}
              thumbColor={theme.colors.background}
            />
          }
        />

        <ListItem
          tx="settings:notifications.showPreview"
          bottomSeparator
          RightComponent={
            <Switch
              value={showPreview}
              onValueChange={handleShowPreviewChange}
              disabled={!pushEnabled || !messageNotifications}
              trackColor={{ false: theme.colors.separator, true: theme.colors.tint }}
              thumbColor={theme.colors.background}
            />
          }
        />
      </View>

      {/* Info Text */}
      <View style={themed($infoSection)}>
        <Text
          preset="formHelper"
          tx="settings:notifications.infoText"
          style={themed($infoText)}
        />
      </View>
    </Screen>
  )
}

const $container: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.lg,
})

const $header: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.md,
  marginBottom: spacing.lg,
  gap: spacing.sm,
})

const $backButton: ThemedStyle<ViewStyle> = () => ({
  padding: 8,
})

const $headerTitle: ThemedStyle<TextStyle> = () => ({
  flex: 1,
})

const $section: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginBottom: spacing.lg,
})

const $sectionTitle: ThemedStyle<TextStyle> = ({ spacing }) => ({
  marginBottom: spacing.sm,
  paddingHorizontal: spacing.xs,
})

const $infoSection: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingHorizontal: spacing.md,
  marginTop: spacing.md,
})

const $infoText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  textAlign: "center",
})
