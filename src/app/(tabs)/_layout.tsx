import { Redirect, Tabs } from "expo-router"
import { MaterialCommunityIcons } from "@expo/vector-icons"

import { useAuth } from "@/hooks/useAuth"
import { translate } from "@/i18n"
import { useAppTheme } from "@/theme/context"

export default function TabsLayout() {
  const { isAuthenticated, isLoading } = useAuth()
  const { theme } = useAppTheme()

  // If user is not authenticated, redirect to login
  if (!isLoading && !isAuthenticated) {
    return <Redirect href="/(auth)/login" />
  }

  const chatsTitle = translate("chats:title")
  const contactsTitle = translate("contacts:title")
  const settingsTitle = translate("settings:title")

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: theme.colors.tint,
        tabBarInactiveTintColor: theme.colors.textDim,
        tabBarStyle: {
          backgroundColor: theme.colors.background,
          borderTopColor: theme.colors.border,
          borderTopWidth: 1,
        },
        headerStyle: {
          backgroundColor: theme.colors.background,
          borderBottomColor: theme.colors.border,
          borderBottomWidth: 1,
        },
        headerTintColor: theme.colors.text,
        headerTitleStyle: {
          fontWeight: "600",
        },
      }}
    >
      {/* Chats Tab */}
      <Tabs.Screen
        name="chats"
        options={{
          title: chatsTitle,
          tabBarLabel: chatsTitle,
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="chat" size={size} color={color} />
          ),
          headerTitle: chatsTitle,
        }}
      />

      {/* Contacts Tab */}
      <Tabs.Screen
        name="contacts"
        options={{
          title: contactsTitle,
          tabBarLabel: contactsTitle,
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="contacts" size={size} color={color} />
          ),
          headerTitle: contactsTitle,
        }}
      />

      {/* Settings Tab */}
      <Tabs.Screen
        name="settings"
        options={{
          title: settingsTitle,
          tabBarLabel: settingsTitle,
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="cog" size={size} color={color} />
          ),
          headerTitle: settingsTitle,
        }}
      />
    </Tabs>
  )
}