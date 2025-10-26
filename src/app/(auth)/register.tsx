import { useState } from "react"
import { Alert, Image, ImageStyle, TextStyle, View, ViewStyle } from "react-native"
import { useRouter } from "expo-router"

import { Button } from "@/components/Button"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { TextField } from "@/components/TextField"
import { useSupabase } from "@/hooks/useSupabase"
import { translate } from "@/i18n"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"
import { useSafeAreaInsetsStyle } from "@/utils/useSafeAreaInsetsStyle"

const logoImage = require("@assets/images/logo.png")

export default function RegisterScreen() {
  const router = useRouter()
  const { themed } = useAppTheme()
  const { signUpWithEmail, signInWithGoogle, isLoading } = useSupabase()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [errors, setErrors] = useState({ email: "", password: "", confirmPassword: "" })

  const $bottomContainerInsets = useSafeAreaInsetsStyle(["bottom"])

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const handleEmailRegister = async () => {
    // Validation
    const newErrors = { email: "", password: "", confirmPassword: "" }
    let hasError = false

    if (!email) {
      newErrors.email = translate("auth:login.emailRequired")
      hasError = true
    } else if (!validateEmail(email)) {
      newErrors.email = translate("auth:login.emailInvalid")
      hasError = true
    }

    if (!password) {
      newErrors.password = translate("auth:login.passwordRequired")
      hasError = true
    } else if (password.length < 6) {
      newErrors.password = translate("auth:login.passwordTooShort")
      hasError = true
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = translate("auth:register.confirmPasswordRequired")
      hasError = true
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = translate("auth:register.passwordMismatch")
      hasError = true
    }

    setErrors(newErrors)
    if (hasError) return

    // Sign up
    const response = await signUpWithEmail(email, password)

    if (response?.error) {
      Alert.alert(translate("auth:register.registrationFailed"), response.error.message)
    } else if (response?.user) {
      Alert.alert(
        translate("auth:register.registrationSuccess"),
        translate("auth:register.verifyEmailMessage"),
        [
          {
            text: translate("common:ok"),
            onPress: () => router.replace("/(auth)/login"),
          },
        ],
      )
    }
  }

  const handleGoogleRegister = async () => {
    const response = await signInWithGoogle()

    if (response?.error) {
      Alert.alert(translate("auth:register.registrationFailed"), response.error.message)
    }
  }

  const navigateToLogin = () => {
    router.push("/(auth)/login")
  }

  return (
    <Screen
      preset="auto"
      contentContainerStyle={themed($container)}
      safeAreaEdges={["top", "bottom"]}
    >
      <View style={themed($topContainer)}>
        <Image style={themed($logo)} source={logoImage} resizeMode="contain" />

        <Text preset="heading" tx="auth:register.title" style={themed($title)} />
        <Text preset="subheading" tx="auth:register.subtitle" style={themed($subtitle)} />

        <TextField
          value={email}
          onChangeText={setEmail}
          containerStyle={themed($textField)}
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          keyboardType="email-address"
          labelTx="auth:register.emailLabel"
          placeholderTx="auth:register.emailPlaceholder"
          helper={errors.email}
          status={errors.email ? "error" : undefined}
        />

        <TextField
          value={password}
          onChangeText={setPassword}
          containerStyle={themed($textField)}
          autoCapitalize="none"
          autoComplete="password"
          autoCorrect={false}
          secureTextEntry
          labelTx="auth:register.passwordLabel"
          placeholderTx="auth:register.passwordPlaceholder"
          helper={errors.password}
          status={errors.password ? "error" : undefined}
        />

        <TextField
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          containerStyle={themed($textField)}
          autoCapitalize="none"
          autoComplete="password"
          autoCorrect={false}
          secureTextEntry
          labelTx="auth:register.confirmPasswordLabel"
          placeholderTx="auth:register.confirmPasswordPlaceholder"
          helper={errors.confirmPassword}
          status={errors.confirmPassword ? "error" : undefined}
          onSubmitEditing={handleEmailRegister}
        />

        <Button
          tx="auth:register.createAccountButton"
          preset="filled"
          style={themed($button)}
          onPress={handleEmailRegister}
          disabled={isLoading}
        />

        <View style={themed($dividerContainer)}>
          <View style={themed($divider)} />
          <Text tx="auth:register.orDivider" style={themed($dividerText)} />
          <View style={themed($divider)} />
        </View>

        <Button
          tx="auth:register.continueWithGoogle"
          preset="default"
          style={themed($socialButton)}
          onPress={handleGoogleRegister}
          disabled={isLoading}
        />
      </View>

      <View style={themed([$bottomContainer, $bottomContainerInsets])}>
        <Text style={themed($footerText)}>
          <Text tx="auth:register.haveAccount" />
          {" "}
          <Text
            tx="auth:register.signInLink"
            style={themed($link)}
            onPress={navigateToLogin}
          />
        </Text>
      </View>
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
  alignItems: "center",
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

const $button: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginTop: spacing.sm,
})

const $dividerContainer: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  marginVertical: spacing.lg,
})

const $divider: ThemedStyle<ViewStyle> = ({ colors }) => ({
  flex: 1,
  height: 1,
  backgroundColor: colors.border,
})

const $dividerText: ThemedStyle<TextStyle> = ({ spacing, colors }) => ({
  marginHorizontal: spacing.md,
  color: colors.textDim,
})

const $socialButton: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginBottom: spacing.xs,
})

const $footerText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  textAlign: "center",
})

const $link: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.tint,
  fontWeight: "600",
})
