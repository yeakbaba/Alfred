import { useState, useRef, useEffect } from "react"
import { Alert, Image, ImageStyle, Platform, TextStyle, View, ViewStyle, ActivityIndicator } from "react-native"
import DateTimePicker from "@react-native-community/datetimepicker"
import { useRouter } from "expo-router"

import { Button } from "@/components/Button"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { TextField } from "@/components/TextField"
import { useAuth } from "@/hooks/useAuth"
import { translate } from "@/i18n/translate"
import { createProfile, isUsernameAvailable, signOut } from "@/services/supabase"
import { syncPersonToNeo4j } from "@/services/api/neo4j"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"
import { useSafeAreaInsetsStyle } from "@/utils/useSafeAreaInsetsStyle"

const logoImage = require("@assets/images/logo.png")

export default function OnboardingScreen() {
  const router = useRouter()
  const { themed } = useAppTheme()
  const { user } = useAuth()

  const handleLogout = async () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to logout?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Logout",
          style: "destructive",
          onPress: async () => {
            await signOut()
            router.replace("/(auth)/login")
          },
        },
      ]
    )
  }

  const [name, setName] = useState("")
  const [username, setUsername] = useState("")
  const [dateOfBirth, setDateOfBirth] = useState(new Date())
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [usernameStatus, setUsernameStatus] = useState<
    "idle" | "checking" | "available" | "taken" | "invalid" | "reserved"
  >("idle")

  const pendingRequestRef = useRef<string | null>(null)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  const [errors, setErrors] = useState({
    name: "",
    username: "",
    dateOfBirth: "",
  })

  const $bottomContainerInsets = useSafeAreaInsetsStyle(["bottom"])

  // Format date for display
  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  // Validate username in real-time
  const handleUsernameChange = async (text: string) => {
    const lowercaseUsername = text.toLowerCase()
    setUsername(lowercaseUsername)

    // Temizle önceki debounce timer'ı
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    if (!lowercaseUsername) {
      setUsernameStatus("idle")
      return
    }

    // Check regex first (client-side)
    const usernameRegex = /^[a-z][a-z0-9_]{2,29}$/
    if (!usernameRegex.test(lowercaseUsername)) {
      setUsernameStatus("invalid")
      return
    }

    // Set checking status immediately
    setUsernameStatus("checking")

    // Debounce: 500ms sonra server check et
    debounceTimerRef.current = setTimeout(async () => {
      // Eğer bu request artık güncel değilse, çıkış yap
      if (pendingRequestRef.current !== lowercaseUsername) {
        return
      }

      try {
        const { available, reason } = await isUsernameAvailable(lowercaseUsername)

        // Double check: hala bu username'i kontrol ediyorsak update et
        if (pendingRequestRef.current === lowercaseUsername) {
          if (available) {
            setUsernameStatus("available")
          } else if (reason === "reserved") {
            setUsernameStatus("reserved")
          } else {
            setUsernameStatus("taken")
          }
        }
      } catch (error) {
        console.error("Username check error:", error)
        if (pendingRequestRef.current === lowercaseUsername) {
          setUsernameStatus("invalid")
        }
      }
    }, 500)

    // Track bu request'in username'ini
    pendingRequestRef.current = lowercaseUsername
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  const getUsernameHelper = () => {
    switch (usernameStatus) {
      case "checking":
        return translate("onboarding:usernameChecking")
      case "available":
        return translate("onboarding:usernameAvailable")
      case "taken":
        return translate("onboarding:usernameTaken")
      case "invalid":
        return translate("onboarding:usernameInvalid")
      case "reserved":
        return translate("onboarding:usernameReserved")
      default:
        return ""
    }
  }

  const getUsernameStatus = (): "error" | undefined => {
    return usernameStatus === "taken" ||
      usernameStatus === "invalid" ||
      usernameStatus === "reserved"
      ? "error"
      : undefined
  }

  const handleComplete = async () => {
    // Validation
    const newErrors = { name: "", username: "", dateOfBirth: "" }
    let hasError = false

    if (!name.trim()) {
      newErrors.name = translate("onboarding:nameRequired")
      hasError = true
    }

    if (!username) {
      newErrors.username = translate("onboarding:usernameRequired")
      hasError = true
    } else if (usernameStatus !== "available") {
      // Map all invalid states to their translations
      if (usernameStatus === "taken") {
        newErrors.username = translate("onboarding:usernameTaken")
      } else if (usernameStatus === "reserved") {
        newErrors.username = translate("onboarding:usernameReserved")
      } else {
        newErrors.username = translate("onboarding:usernameInvalid")
      }
      hasError = true
    }

    // Check if user is at least 13 years old
    const today = new Date()
    const age = today.getFullYear() - dateOfBirth.getFullYear()
    if (age < 13) {
      newErrors.dateOfBirth = "You must be at least 13 years old"
      hasError = true
    }

    setErrors(newErrors)
    if (hasError) return

    if (!user?.id) {
      Alert.alert(translate("common:error"), "User not found. Please sign in again.")
      return
    }

    setIsLoading(true)

    try {
      // Step 1: Create profile in Supabase
      const { data: profileData, error: profileError } = await createProfile({
        id: user.id,
        username,
        name: name.trim(),
        date_of_birth: dateOfBirth.toISOString().split("T")[0],
        email: user.email,
      })

      if (profileError) {
        Alert.alert(translate("onboarding:profileError"), profileError.message)
        return
      }

      if (!profileData) {
        Alert.alert(translate("onboarding:profileError"), "Failed to create profile")
        return
      }

      // Step 2: Sync to Neo4j - CRITICAL STEP
      console.log("[Onboarding] Syncing user to Neo4j...")
      const neo4jResult = await syncPersonToNeo4j({
        supabase_id: user.id,
        username,
        name: name.trim(),
        display_name: name.trim(),
        date_of_birth: dateOfBirth.toISOString().split("T")[0],
        // Optional fields - can be added later
        gender: undefined,
        location: undefined,
        language: "en", // Default language
      })

      if (!neo4jResult.success) {
        console.error("[Onboarding] Neo4j sync failed:", neo4jResult.error)
        Alert.alert(
          "Setup Error",
          "Failed to complete account setup. Please try again or contact support.\n\n" +
            (neo4jResult.error || "Unknown error"),
        )
        return
      }

      console.log("[Onboarding] Neo4j sync successful!")

      // Step 3: Navigate to app
      router.replace("/(tabs)/chats")
    } catch (error) {
      console.error("[Onboarding] Error:", error)
      Alert.alert(
        translate("onboarding:profileError"),
        error instanceof Error ? error.message : "Unknown error",
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Screen
      preset="auto"
      contentContainerStyle={themed($container)}
      safeAreaEdges={["top", "bottom"]}
    >
      <View style={themed($topContainer)}>
        <Image style={themed($logo)} source={logoImage} resizeMode="contain" />

        <Text preset="heading" tx="onboarding:title" style={themed($title)} />
        <Text preset="subheading" tx="onboarding:subtitle" style={themed($subtitle)} />

        <TextField
          value={name}
          onChangeText={setName}
          containerStyle={themed($textField)}
          autoCapitalize="words"
          autoComplete="name"
          autoCorrect={false}
          labelTx="onboarding:nameLabel"
          placeholderTx="onboarding:namePlaceholder"
          helper={errors.name}
          status={errors.name ? "error" : undefined}
        />

        <TextField
          value={username}
          onChangeText={handleUsernameChange}
          containerStyle={themed($textField)}
          autoCapitalize="none"
          autoComplete="off"
          autoCorrect={false}
          labelTx="onboarding:usernameLabel"
          placeholderTx="onboarding:usernamePlaceholder"
          helper={getUsernameHelper() || errors.username}
          status={getUsernameStatus()}
        />

        <View style={themed($textField)}>
          <Text tx="onboarding:dateOfBirthLabel" preset="formLabel" style={themed($label)} />
          <Button
            text={formatDate(dateOfBirth)}
            preset="default"
            style={themed($dateButton)}
            onPress={() => setShowDatePicker(true)}
          />
          {errors.dateOfBirth ? (
            <Text text={errors.dateOfBirth} preset="formHelper" style={themed($errorText)} />
          ) : null}
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={dateOfBirth}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            maximumDate={new Date()}
            minimumDate={new Date(1900, 0, 1)}
            onChange={(event, selectedDate) => {
              if (selectedDate) {
                setDateOfBirth(selectedDate)
              }
              setShowDatePicker(false)
            }}
          />
        )}

        <Button
          text={isLoading ? "Setting up your account..." : undefined}
          tx={isLoading ? undefined : "onboarding:completeButton"}
          preset="filled"
          style={themed($button)}
          onPress={handleComplete}
          disabled={isLoading || usernameStatus === "checking"}
          RightAccessory={() =>
            isLoading ? (
              <ActivityIndicator
                size="small"
                color="#ffffff"
                style={{ marginLeft: 8 }}
              />
            ) : null
          }
        />

        <Button
          text="Logout"
          preset="default"
          style={themed($logoutButton)}
          onPress={handleLogout}
        />
      </View>

      <View style={themed([$bottomContainer, $bottomContainerInsets])} />
    </Screen>
  )
}

const $container: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flex: 1,
  paddingHorizontal: spacing.lg,
})

const $topContainer: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexGrow: 1,
  justifyContent: "center",
  paddingTop: spacing.xl,
})

const $bottomContainer: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingVertical: spacing.md,
})

const $logo: ThemedStyle<ImageStyle> = ({ spacing }) => ({
  height: 80,
  width: "100%",
  marginBottom: spacing.xxl,
})

const $title: ThemedStyle<TextStyle> = ({ spacing }) => ({
  marginBottom: spacing.xs,
  textAlign: "center",
})

const $subtitle: ThemedStyle<TextStyle> = ({ spacing, colors }) => ({
  marginBottom: spacing.xl,
  textAlign: "center",
  color: colors.textDim,
})

const $textField: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginBottom: spacing.md,
})

const $label: ThemedStyle<TextStyle> = ({ spacing }) => ({
  marginBottom: spacing.xs,
})

const $dateButton: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginTop: spacing.xxs,
})

const $errorText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.error,
})

const $button: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginTop: spacing.lg,
})

const $logoutButton: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginTop: spacing.sm,
})
