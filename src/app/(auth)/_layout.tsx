import { Redirect, Stack } from "expo-router"

import { useAuth } from "@/hooks/useAuth"

export default function AuthLayout() {
  const { isAuthenticated, isLoading } = useAuth()

  // If user is authenticated, redirect to home
  if (!isLoading && isAuthenticated) {
    return <Redirect href="/" />
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
    </Stack>
  )
}
