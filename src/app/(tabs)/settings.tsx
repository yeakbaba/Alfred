import { useState } from "react"
import { Alert, View, ViewStyle } from "react-native"
import { useRouter } from "expo-router"

import { Button } from "@/components/Button"
import { ListItem } from "@/components/ListItem"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { useAuth } from "@/hooks/useAuth"
import { useSupabase } from "@/hooks/useSupabase"
import { translate } from "@/i18n"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

export default function SettingsScreen() {
  const router = useRouter()
  const { themed } = useAppTheme()
  const { user } = useAuth()
  const { signOut } = useSupabase()
  const [isSigningOut, setIsSigningOut] = useState(false)

  const handleSignOut = async () => {
    Alert.alert(translate("settings:signOutConfirm"), translate("settings:signOutMessage"), [
      {
        text: translate("common:cancel"),
        style: "cancel",
      },
      {
        text: translate("settings:signOutButton"),
        style: "destructive",
        onPress: async () => {
          setIsSigningOut(true)
          try {
            await signOut()
            router.replace("/(auth)/login")
          } catch (error) {
            Alert.alert(translate("common:error"), "Failed to sign out")
            setIsSigningOut(false)
          }
        },
      },
    ])
  }

  return (
    <Screen preset="scroll" contentContainerStyle={themed($container)}>
      {/* Profile Section */}
      <View style={themed($section)}>
        <Text preset="subheading" text="Account" style={themed($sectionTitle)} />
        <ListItem
          text={user?.email || "User"}
          leftIcon="settings"
          topSeparator
          bottomSeparator
          style={themed($listItem)}
        />
      </View>

      {/* App Settings Section */}
      <View style={themed($section)}>
        <Text preset="subheading" text="App Settings" style={themed($sectionTitle)} />
        <ListItem text="Notifications" leftIcon="bell" topSeparator style={themed($listItem)} />
        <ListItem text="Privacy" leftIcon="lock" bottomSeparator style={themed($listItem)} />
      </View>

      {/* About Section */}
      <View style={themed($section)}>
        <Text preset="subheading" text="About" style={themed($sectionTitle)} />
        <ListItem
          text="Version 1.0.0"
          leftIcon="information"
          topSeparator
          bottomSeparator
          style={themed($listItem)}
        />
      </View>

      {/* Sign Out Section */}
      <View style={themed($signOutSection)}>
        <Button
          tx="settings:signOutButton"
          preset="reversed"
          style={themed($signOutButton)}
          onPress={handleSignOut}
          disabled={isSigningOut}
        />
      </View>
    </Screen>
  )
}

const $container: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.md,
})

const $section: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginBottom: spacing.lg,
})

const $sectionTitle: ThemedStyle<any> = ({ spacing }) => ({
  marginBottom: spacing.sm,
})

const $listItem: ThemedStyle<ViewStyle> = () => ({})

const $signOutSection: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginTop: spacing.xl,
})

const $signOutButton: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginVertical: spacing.md,
})
