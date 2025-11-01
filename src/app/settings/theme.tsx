import { useEffect, useState } from "react"
import { View, ViewStyle, Pressable, TextStyle } from "react-native"
import { useRouter } from "expo-router"
import { MaterialCommunityIcons } from "@expo/vector-icons"

import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { ListItem } from "@/components/ListItem"
import { translate } from "@/i18n"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

type ThemeMode = "system" | "light" | "dark"

export default function ThemeSettingsScreen() {
  const router = useRouter()
  const { themed, theme, themeContext, setThemeContextOverride } = useAppTheme()

  // Initialize with current theme context
  const [selectedTheme, setSelectedTheme] = useState<ThemeMode>("system")

  // Update selected theme when context changes
  useEffect(() => {
    // Determine current theme mode by checking saved preference
    // If no override is set, it will be "system"
    setSelectedTheme(themeContext === "light" ? "light" : "dark")
  }, [themeContext])

  const handleThemeSelect = (themeMode: ThemeMode) => {
    setSelectedTheme(themeMode)

    // Apply theme change
    if (themeMode === "system") {
      setThemeContextOverride(undefined) // Follow system
    } else {
      setThemeContextOverride(themeMode) // Set specific theme
    }
  }

  return (
    <Screen preset="fixed" safeAreaEdges={["top"]} contentContainerStyle={themed($container)}>
      {/* Header with back button */}
      <View style={themed($header)}>
        <Pressable onPress={() => router.back()} style={themed($backButton)}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.text} />
        </Pressable>
        <Text preset="heading" tx="settings:theme.title" style={themed($headerTitle)} />
      </View>

      {/* Theme Options */}
      <View style={themed($section)}>
        <Text preset="subheading" tx="settings:theme.appearance" style={themed($sectionTitle)} />

        <ListItem
          tx="settings:theme.systemDefault"
          topSeparator
          onPress={() => handleThemeSelect("system")}
          RightComponent={
            selectedTheme === "system" ? (
              <MaterialCommunityIcons
                style={{ alignSelf: "center" }}
                name="check"
                size={24}
                color={theme.colors.tint}
              />
            ) : null
          }
        />

        <ListItem
          tx="settings:theme.light"
          onPress={() => handleThemeSelect("light")}
          RightComponent={
            selectedTheme === "light" ? (
              <MaterialCommunityIcons
                style={{ alignSelf: "center" }}
                name="check"
                size={24}
                color={theme.colors.tint}
              />
            ) : null
          }
        />

        <ListItem
          tx="settings:theme.dark"
          bottomSeparator
          onPress={() => handleThemeSelect("dark")}
          RightComponent={
            selectedTheme === "dark" ? (
              <MaterialCommunityIcons
                style={{ alignSelf: "center" }}
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
          tx="settings:theme.infoText"
          style={themed($infoText)}
        />
      </View>

      {/* Preview Section */}
      <View style={themed($section)}>
        <Text preset="subheading" tx="settings:theme.preview" style={themed($sectionTitle)} />

        <View style={themed($previewContainer)}>
          <View style={themed($previewCard)}>
            <Text preset="default" tx="settings:theme.previewMessage" />
            <View style={themed($previewBubble)}>
              <Text preset="default" tx="settings:theme.previewBubble" style={themed($previewText)} />
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

const $title: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginBottom: spacing.lg,
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

const $previewText: ThemedStyle<TextStyle> = () => ({
  color: "white",
})
