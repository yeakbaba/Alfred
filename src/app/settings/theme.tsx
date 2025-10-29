import { useState } from "react"
import { View, ViewStyle } from "react-native"
import { useRouter } from "expo-router"
import { MaterialCommunityIcons } from "@expo/vector-icons"

import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { ListItem } from "@/components/ListItem"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

type ThemeMode = "system" | "light" | "dark"

export default function ThemeSettingsScreen() {
  const router = useRouter()
  const { themed, theme } = useAppTheme()

  const [selectedTheme, setSelectedTheme] = useState<ThemeMode>("system")

  const handleThemeSelect = (themeMode: ThemeMode) => {
    setSelectedTheme(themeMode)
    // TODO: Implement theme switching logic
  }

  return (
    <Screen preset="scroll" contentContainerStyle={themed($container)}>
      <Text preset="heading" text="Theme" style={themed($title)} />

      {/* Theme Options */}
      <View style={themed($section)}>
        <Text preset="subheading" text="Appearance" style={themed($sectionTitle)} />

        <ListItem
          text="System Default"
          topSeparator
          onPress={() => handleThemeSelect("system")}
          RightComponent={
            selectedTheme === "system" ? (
              <MaterialCommunityIcons
                name="check"
                size={24}
                color={theme.colors.tint}
              />
            ) : null
          }
        />

        <ListItem
          text="Light"
          onPress={() => handleThemeSelect("light")}
          RightComponent={
            selectedTheme === "light" ? (
              <MaterialCommunityIcons
                name="check"
                size={24}
                color={theme.colors.tint}
              />
            ) : null
          }
        />

        <ListItem
          text="Dark"
          bottomSeparator
          onPress={() => handleThemeSelect("dark")}
          RightComponent={
            selectedTheme === "dark" ? (
              <MaterialCommunityIcons
                name="check"
                size={24}
                color={theme.colors.tint}
              />
            ) : null
          }
        />
      </View>

      {/* Info Text */}
      <View style={themed($infoSection)}>
        <Text
          preset="formHelper"
          text="System Default will automatically switch between light and dark themes based on your device settings."
          style={themed($infoText)}
        />
      </View>

      {/* Preview Section */}
      <View style={themed($section)}>
        <Text preset="subheading" text="Preview" style={themed($sectionTitle)} />

        <View style={themed($previewContainer)}>
          <View style={themed($previewCard)}>
            <Text preset="default" text="This is how messages will look" />
            <View style={themed($previewBubble)}>
              <Text preset="default" text="Hello!" style={themed($previewText)} />
            </View>
          </View>
        </View>
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

const $previewContainer: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.lg,
})

const $previewCard: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  backgroundColor: colors.background,
  borderRadius: 12,
  padding: spacing.md,
  borderWidth: 1,
  borderColor: colors.border,
})

const $previewBubble: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  backgroundColor: colors.tint,
  borderRadius: 16,
  padding: spacing.sm,
  marginTop: spacing.sm,
  alignSelf: "flex-start",
})

const $previewText: ThemedStyle<ViewStyle> = () => ({
  color: "white",
})
