import { useState, useEffect } from "react"
import { View, ViewStyle, Pressable, TextStyle } from "react-native"
import { useRouter } from "expo-router"
import { MaterialCommunityIcons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"

import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { ListItem } from "@/components/ListItem"
import { saveLanguagePreference } from "@/i18n"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

type Language = {
  code: string
  name: string
  nativeName: string
}

const AVAILABLE_LANGUAGES: Language[] = [
  { code: "en", name: "English", nativeName: "English" },
  { code: "es", name: "Spanish", nativeName: "Español" },
  { code: "fr", name: "French", nativeName: "Français" },
  { code: "ar", name: "Arabic", nativeName: "العربية" },
  { code: "ja", name: "Japanese", nativeName: "日本語" },
  { code: "ko", name: "Korean", nativeName: "한국어" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी" },
  { code: "tr", name: "Turkish", nativeName: "Türkçe" },
]

export default function LanguageSettingsScreen() {
  const router = useRouter()
  const { themed, theme } = useAppTheme()
  const { i18n } = useTranslation()

  const [selectedLanguage, setSelectedLanguage] = useState<string>(i18n.language)

  useEffect(() => {
    // Update selected language when i18n language changes
    setSelectedLanguage(i18n.language.split("-")[0]) // Get primary tag (e.g., "en" from "en-US")
  }, [i18n.language])

  const handleLanguageSelect = async (languageCode: string) => {
    try {
      await i18n.changeLanguage(languageCode)
      setSelectedLanguage(languageCode)
      // Save language preference to storage for persistence
      saveLanguagePreference(languageCode)
    } catch (error) {
      console.error("Failed to change language:", error)
    }
  }

  return (
    <Screen preset="scroll" safeAreaEdges={["top"]} contentContainerStyle={themed($container)}>
      {/* Header with back button */}
      <View style={themed($header)}>
        <Pressable onPress={() => router.back()} style={themed($backButton)}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.text} />
        </Pressable>
        <Text preset="heading" tx="settings:language.title" style={themed($headerTitle)} />
      </View>

      {/* Language Options */}
      <View style={themed($section)}>
        <Text
          preset="subheading"
          tx="settings:language.appLanguage"
          style={themed($sectionTitle)}
        />

        {AVAILABLE_LANGUAGES.map((language, index) => (
          <ListItem
            key={language.code}
            text={language.nativeName}
            topSeparator={index === 0}
            bottomSeparator={index === AVAILABLE_LANGUAGES.length - 1}
            onPress={() => handleLanguageSelect(language.code)}
            RightComponent={
              selectedLanguage === language.code ? (
                <MaterialCommunityIcons
                  style={{ alignSelf: "center" }}
                  name="check"
                  size={24}
                  color={theme.colors.tint}
                />
              ) : null
            }
          />
        ))}
      </View>

      {/* Alfred Language Section */}
      <View style={themed($section)}>
        <Text
          preset="subheading"
          tx="settings:language.alfredLanguage"
          style={themed($sectionTitle)}
        />

        <Text preset="default" tx="settings:language.alfredInfo" style={themed($helperText)} />

        <ListItem
          tx="settings:language.autoDetect"
          topSeparator
          bottomSeparator
          RightComponent={
            <MaterialCommunityIcons
              style={{ alignSelf: "center" }}
              name="check"
              size={24}
              color={theme.colors.tint}
            />
          }
        />
      </View>

      {/* Info Text */}
      <View style={themed($infoSection)}>
        <Text preset="formHelper" tx="settings:language.infoText" style={themed($infoText)} />
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

const $helperText: ThemedStyle<TextStyle> = ({ spacing, colors }) => ({
  paddingHorizontal: spacing.md,
  marginBottom: spacing.md,
  color: colors.textDim,
})

const $infoSection: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingHorizontal: spacing.md,
  marginTop: spacing.md,
})

const $infoText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  textAlign: "center",
})
