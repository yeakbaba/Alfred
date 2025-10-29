import { useState } from "react"
import { View, ViewStyle, Switch } from "react-native"
import { useRouter } from "expo-router"

import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { ListItem } from "@/components/ListItem"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

export default function NotificationsSettingsScreen() {
  const router = useRouter()
  const { themed, theme } = useAppTheme()

  // Notification preferences state
  const [pushEnabled, setPushEnabled] = useState(true)
  const [messageNotifications, setMessageNotifications] = useState(true)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [vibrationEnabled, setVibrationEnabled] = useState(true)
  const [showPreview, setShowPreview] = useState(true)

  return (
    <Screen preset="scroll" contentContainerStyle={themed($container)}>
      <Text preset="heading" text="Notifications" style={themed($title)} />

      {/* Push Notifications */}
      <View style={themed($section)}>
        <Text preset="subheading" text="Push Notifications" style={themed($sectionTitle)} />

        <ListItem
          text="Enable Push Notifications"
          topSeparator
          bottomSeparator
          RightComponent={
            <Switch
              value={pushEnabled}
              onValueChange={setPushEnabled}
              trackColor={{ false: theme.colors.separator, true: theme.colors.tint }}
              thumbColor={theme.colors.background}
            />
          }
        />
      </View>

      {/* Message Notifications */}
      <View style={themed($section)}>
        <Text preset="subheading" text="Message Notifications" style={themed($sectionTitle)} />

        <ListItem
          text="New Messages"
          topSeparator
          RightComponent={
            <Switch
              value={messageNotifications}
              onValueChange={setMessageNotifications}
              disabled={!pushEnabled}
              trackColor={{ false: theme.colors.separator, true: theme.colors.tint }}
              thumbColor={theme.colors.background}
            />
          }
        />

        <ListItem
          text="Sound"
          RightComponent={
            <Switch
              value={soundEnabled}
              onValueChange={setSoundEnabled}
              disabled={!pushEnabled || !messageNotifications}
              trackColor={{ false: theme.colors.separator, true: theme.colors.tint }}
              thumbColor={theme.colors.background}
            />
          }
        />

        <ListItem
          text="Vibration"
          RightComponent={
            <Switch
              value={vibrationEnabled}
              onValueChange={setVibrationEnabled}
              disabled={!pushEnabled || !messageNotifications}
              trackColor={{ false: theme.colors.separator, true: theme.colors.tint }}
              thumbColor={theme.colors.background}
            />
          }
        />

        <ListItem
          text="Show Preview"
          bottomSeparator
          RightComponent={
            <Switch
              value={showPreview}
              onValueChange={setShowPreview}
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
          text="Notification preferences will be saved automatically. Make sure notifications are enabled in your device settings."
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

const $title: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginBottom: spacing.lg,
})

const $section: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginBottom: spacing.lg,
})

const $sectionTitle: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginBottom: spacing.sm,
  paddingHorizontal: spacing.xs,
})

const $infoSection: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingHorizontal: spacing.md,
  marginTop: spacing.md,
})

const $infoText: ThemedStyle<ViewStyle> = ({ colors }) => ({
  color: colors.textDim,
  textAlign: "center",
})
