import { useState } from "react"
import { View, ViewStyle } from "react-native"
import { useRouter } from "expo-router"
import { MaterialCommunityIcons } from "@expo/vector-icons"

import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { ListItem } from "@/components/ListItem"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

type Language = {
  code: string
  name: string
  nativeName: string
}

const AVAILABLE_LANGUAGES: Language[] = [
  { code: "en", name: "English", nativeName: "English" },
  { code: "tr", name: "Turkish", nativeName: "Türkçe" },
  { code: "es", name: "Spanish", nativeName: "Español" },
  { code: "fr", name: "French", nativeName: "Français" },
  { code: "de", name: "German", nativeName: "Deutsch" },
  { code: "it", name: "Italian", nativeName: "Italiano" },
  { code: "pt", name: "Portuguese", nativeName: "Português" },
  { code: "ja", name: "Japanese", nativeName: "日本語" },
  { code: "ko", name: "Korean", nativeName: "한국어" },
  { code: "zh", name: "Chinese", nativeName: "中文" },
]

export default function LanguageSettingsScreen() {
  const router = useRouter()
  const { themed, theme } = useAppTheme()

  const [selectedLanguage, setSelectedLanguage] = useState<string>("en")

  const handleLanguageSelect = (languageCode: string) => {
    setSelectedLanguage(languageCode)
    // TODO: Implement language switching logic
    // This will need to update i18n and restart the app or refresh UI
  }

  return (
    <Screen preset="scroll" contentContainerStyle={themed($container)}>
      <Text preset="heading" text="Language" style={themed($title)} />

      {/* Language Options */}
      <View style={themed($section)}>
        <Text preset="subheading" text="App Language" style={themed($sectionTitle)} />

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
        <Text preset="subheading" text="Alfred's Language" style={themed($sectionTitle)} />

        <Text
          preset="default"
          text="Alfred will respond in the same language as your app settings."
          style={themed($helperText)}
        />

        <ListItem
          text="Auto-detect language from messages"
          topSeparator
          bottomSeparator
          RightComponent={
            <MaterialCommunityIcons
              name="check"
              size={24}
              color={theme.colors.tint}
            />
          }
        />
      </View>

      {/* Info Text */}
      <View style={themed($infoSection)}>
        <Text
          preset="formHelper"
          text="Changing the app language will update all menus and interface text. Alfred can also respond in multiple languages based on your conversation."
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

const $helperText: ThemedStyle<ViewStyle> = ({ spacing, colors }) => ({
  paddingHorizontal: spacing.md,
  marginBottom: spacing.md,
  color: colors.textDim,
})

const $infoSection: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingHorizontal: spacing.md,
  marginTop: spacing.md,
})

const $infoText: ThemedStyle<ViewStyle> = ({ colors }) => ({
  color: colors.textDim,
  textAlign: "center",
})
