import { Redirect, Tabs } from "expo-router"
import { MaterialCommunityIcons } from "@expo/vector-icons"
import { View, Text, StyleSheet } from "react-native"

import { useAuth } from "@/hooks/useAuth"
import { useContactsBadge } from "@/hooks/useContactsBadge"
import { translate } from "@/i18n"
import { useAppTheme } from "@/theme/context"

export default function TabsLayout() {
  const { isAuthenticated, isLoading } = useAuth()
  const { theme } = useAppTheme()
  const { badgeCount } = useContactsBadge()

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
          headerShown: false,
          tabBarLabel: contactsTitle,
          tabBarIcon: ({ color, size }) => (
            <View style={{ position: "relative" }}>
              <MaterialCommunityIcons name="contacts" size={size} color={color} />
              {badgeCount > 0 && (
                <View style={[styles.badge, { backgroundColor: theme.colors.palette.angry500 }]}>
                  <Text style={styles.badgeText}>{badgeCount > 99 ? "99+" : badgeCount}</Text>
                </View>
              )}
            </View>
          ),
          headerTitle: contactsTitle,
        }}
      />

      {/* Settings Tab */}
      <Tabs.Screen
        name="settings"
        options={{
          title: settingsTitle,
          headerShown: false,
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

const styles = StyleSheet.create({
  badge: {
    position: "absolute",
    top: -4,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    color: "white",
    fontSize: 10,
    fontWeight: "bold",
  },
})
