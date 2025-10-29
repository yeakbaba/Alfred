import { useState, useEffect } from "react"
import {
  View,
  ViewStyle,
  Alert,
  ActivityIndicator,
  Image,
  ImageStyle,
  Pressable,
  TextStyle,
  ScrollView,
} from "react-native"
import { useRouter, useLocalSearchParams } from "expo-router"
import { MaterialCommunityIcons } from "@expo/vector-icons"

import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { Button } from "@/components/Button"
import { ListItem } from "@/components/ListItem"
import { TextField } from "@/components/TextField"
import { useAuth } from "@/hooks/useAuth"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"
import { supabase } from "@/services/supabase"
import type { Chat } from "@/services/supabase/chats"
import type { Profile } from "@/services/supabase/profiles"
import { getAllUserConnections } from "@/services/supabase/userConnections"

interface Participant {
  id: string
  user_id: string
  name: string
  username: string
  avatar?: string
  isAlfred?: boolean
}

export default function ChatSettingsScreen() {
  const router = useRouter()
  const { themed, theme } = useAppTheme()
  const { user } = useAuth()
  const { id } = useLocalSearchParams<{ id: string }>()

  const [loading, setLoading] = useState(true)
  const [chat, setChat] = useState<Chat | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [showAddParticipant, setShowAddParticipant] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [connections, setConnections] = useState<any[]>([])
  const [addingParticipant, setAddingParticipant] = useState(false)

  useEffect(() => {
    loadChatSettings()
  }, [])

  async function loadChatSettings() {
    if (!user || !id) return

    try {
      setLoading(true)

      // Load chat
      const { data: chatData, error: chatError } = await supabase
        .from("chats")
        .select("*")
        .eq("id", id)
        .single()

      if (chatError) throw chatError

      setChat(chatData)

      // Load participants
      const { data: participantsData, error: participantsError } = await supabase
        .from("chat_participants")
        .select("*")
        .eq("chat_id", id)
        .eq("is_active", true)

      if (participantsError) throw participantsError

      // Get profiles for all participants
      const profilePromises = participantsData.map(async (participant) => {
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", participant.user_id)
          .single()

        return {
          id: participant.id,
          user_id: participant.user_id,
          name: profile?.name || "Unknown",
          username: profile?.username || "unknown",
          avatar: profile?.avatar_url,
          isAlfred: false,
        }
      })

      const profiles = await Promise.all(profilePromises)
      setParticipants(profiles)

      // Load ALL user connections (for both adding participants and navigating to relationship pages)
      const { data: connectionsData } = await getAllUserConnections(user.id)
      if (connectionsData) {
        // Get profiles for all connections
        const allConnectionProfiles = await Promise.all(
          connectionsData.map(async (conn) => {
            const { data: profile } = await supabase
              .from("profiles")
              .select("*")
              .eq("id", conn.connected_user_id)
              .single()

            return {
              ...conn,
              profile,
            }
          }),
        )

        // Store all connections (for relationship navigation)
        setConnections(allConnectionProfiles.filter((c) => c.profile))
      }
    } catch (error) {
      console.error("Error loading chat settings:", error)
      Alert.alert("Error", "Failed to load chat settings")
    } finally {
      setLoading(false)
    }
  }

  async function handleAddParticipant(connectionId: string) {
    if (!id || !user) return

    try {
      setAddingParticipant(true)

      const { error } = await supabase.from("chat_participants").insert({
        chat_id: id,
        user_id: connectionId,
        role: "member",
      })

      if (error) throw error

      Alert.alert("Success", "Participant added successfully")
      setShowAddParticipant(false)
      setSearchQuery("")
      loadChatSettings()
    } catch (error) {
      console.error("Error adding participant:", error)
      Alert.alert("Error", "Failed to add participant")
    } finally {
      setAddingParticipant(false)
    }
  }

  function handleLeaveChat() {
    Alert.alert(
      "Leave Chat",
      "Are you sure you want to leave this chat? You won't be able to send or receive messages.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Leave",
          style: "destructive",
          onPress: async () => {
            try {
              // Update participant to inactive (set left_at to mark as inactive)
              const { error } = await supabase
                .from("chat_participants")
                .update({ left_at: new Date().toISOString() })
                .eq("chat_id", id)
                .eq("user_id", user?.id)

              if (error) throw error

              router.replace("/(tabs)/chats")
            } catch (error) {
              console.error("Error leaving chat:", error)
              Alert.alert("Error", "Failed to leave chat")
            }
          },
        },
      ],
    )
  }

  // Filter connections: exclude those already in chat and apply search query
  const participantUserIds = participants.map((p) => p.user_id)
  const filteredConnections = connections
    .filter((conn) => !participantUserIds.includes(conn.connected_user_id))
    .filter(
      (conn) =>
        conn.profile.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        conn.profile.username.toLowerCase().includes(searchQuery.toLowerCase()),
    )

  if (loading) {
    return (
      <Screen preset="fixed" contentContainerStyle={themed($container)}>
        <View style={themed($loadingContainer)}>
          <ActivityIndicator size="large" color={theme.colors.tint} />
        </View>
      </Screen>
    )
  }

  return (
    <Screen preset="fixed" safeAreaEdges={["top"]} contentContainerStyle={themed($container)}>
      {/* Header */}
      <View style={themed($header)}>
        <Pressable onPress={() => router.back()} style={themed($backButton)}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.text} />
        </Pressable>
        <Text preset="heading" text="Chat Settings" />
      </View>

      {/* Scrollable Content */}
      <ScrollView
        style={themed($scrollContent)}
        contentContainerStyle={themed($scrollContentContainer)}
      >
        {/* Participants */}
        <View style={themed($section)}>
          <Text preset="subheading" text="Participants" style={themed($sectionTitle)} />
          {participants.map((participant, index) => (
            <ListItem
              key={participant.id}
              text={participant.name}
              topSeparator={index === 0}
              bottomSeparator
              onPress={() => {
                // Navigate to relationship page if not current user
                if (participant.user_id !== user?.id) {
                  // Find connection ID for this user
                  const connection = connections.find(
                    (c) => c.connected_user_id === participant.user_id,
                  )
                  if (connection) {
                    router.push(`/contacts/${connection.id}/relationship`)
                  }
                }
              }}
              LeftComponent={
                participant.avatar ? (
                  <Image
                    source={{ uri: participant.avatar }}
                    style={themed($participantAvatar)}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={themed($participantAvatarPlaceholder)}>
                    <Text text={participant.name.charAt(0).toUpperCase()} />
                  </View>
                )
              }
              RightComponent={
                <Text text={`@${participant.username}`} style={themed($usernameText)} />
              }
            />
          ))}
        </View>

        {/* Add Participant */}
        <View style={themed($section)}>
          <Button
            text="Add Participant"
            preset="default"
            onPress={() => setShowAddParticipant(!showAddParticipant)}
            LeftAccessory={(props) => (
              <MaterialCommunityIcons
                name="account-plus"
                size={20}
                color={props.pressableState.pressed ? theme.colors.textDim : theme.colors.tint}
              />
            )}
          />

          {showAddParticipant && (
            <View style={themed($addParticipantContainer)}>
              <TextField
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search connections..."
                LeftAccessory={(props) => (
                  <MaterialCommunityIcons
                    name="magnify"
                    size={20}
                    color={theme.colors.textDim}
                    style={props.style}
                  />
                )}
                containerStyle={themed($searchField)}
              />

              {filteredConnections.length === 0 ? (
                <Text
                  text="No available connections"
                  preset="formHelper"
                  style={themed($noResultsText)}
                />
              ) : (
                filteredConnections.map((conn, index) => (
                  <ListItem
                    key={conn.id}
                    text={conn.profile.name}
                    topSeparator={index === 0}
                    bottomSeparator
                    onPress={() => handleAddParticipant(conn.connected_user_id)}
                    disabled={addingParticipant}
                    LeftComponent={
                      conn.profile.avatar_url ? (
                        <Image
                          source={{ uri: conn.profile.avatar_url }}
                          style={themed($participantAvatar)}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={themed($participantAvatarPlaceholder)}>
                          <Text text={conn.profile.name.charAt(0).toUpperCase()} />
                        </View>
                      )
                    }
                    RightComponent={
                      <MaterialCommunityIcons name="plus" size={20} color={theme.colors.tint} />
                    }
                  />
                ))
              )}
            </View>
          )}
        </View>

        {/* Leave Chat */}
        <View style={themed($section)}>
          <Button
            text="Leave Chat"
            preset="default"
            onPress={handleLeaveChat}
            style={themed($leaveChatButton)}
            textStyle={themed($leaveChatButtonText)}
            LeftAccessory={(props) => (
              <MaterialCommunityIcons name="exit-to-app" size={20} color={theme.colors.error} />
            )}
          />
        </View>
      </ScrollView>
    </Screen>
  )
}

const $container: ThemedStyle<ViewStyle> = () => ({
  flex: 1,
})

const $loadingContainer: ThemedStyle<ViewStyle> = () => ({
  flex: 1,
  justifyContent: "center",
  alignItems: "center",
})

const $header: ThemedStyle<ViewStyle> = ({ spacing, colors }) => ({
  flexDirection: "row",
  alignItems: "center",
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.md,
  borderBottomWidth: 1,
  borderBottomColor: colors.border,
  gap: spacing.sm,
})

const $scrollContent: ThemedStyle<ViewStyle> = () => ({
  flex: 1,
})

const $scrollContentContainer: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.lg,
})

const $backButton: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  padding: spacing.xs,
})

const $section: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginBottom: spacing.xl,
})

const $sectionTitle: ThemedStyle<TextStyle> = ({ spacing }) => ({
  marginBottom: spacing.sm,
})

const $participantAvatar: ThemedStyle<ImageStyle> = ({ spacing }) => ({
  width: 40,
  height: 40,
  borderRadius: 20,
  alignSelf: "center",
  marginRight: spacing.sm,
})

const $participantAvatarPlaceholder: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  width: 40,
  height: 40,
  borderRadius: 20,
  backgroundColor: colors.palette.neutral300,
  justifyContent: "center",
  alignItems: "center",
  alignSelf: "center",
  marginRight: spacing.sm,
})

const $usernameText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  fontSize: 14,
  alignSelf: "center",
})

const $addParticipantContainer: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginTop: spacing.md,
})

const $searchField: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginBottom: spacing.sm,
})

const $noResultsText: ThemedStyle<TextStyle> = ({ spacing, colors }) => ({
  textAlign: "center",
  color: colors.textDim,
  paddingVertical: spacing.lg,
})

const $leaveChatButton: ThemedStyle<ViewStyle> = ({ colors }) => ({
  borderColor: colors.error,
})

const $leaveChatButtonText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.error,
})
