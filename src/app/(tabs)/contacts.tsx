import { useState, useEffect, useCallback } from "react"
import {
  FlatList,
  Image,
  ImageStyle,
  Pressable,
  TextStyle,
  View,
  ViewStyle,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
} from "react-native"
import { useRouter } from "expo-router"
import { MaterialCommunityIcons } from "@expo/vector-icons"

import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { TextField } from "@/components/TextField"
import { translate } from "@/i18n"
import { useAuth } from "@/hooks/useAuth"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"
import {
  getSentInvitations,
  getReceivedInvitations,
  acceptInvitation,
  rejectInvitation,
  sendConnectionInvitation,
  type Invitation,
} from "@/services/supabase/invitations"
import {
  getAllUserConnections,
  createUserConnection,
  type UserConnection,
} from "@/services/supabase/userConnections"
import { getProfile, type Profile } from "@/services/supabase/profiles"
import { fetchFromTable, supabase } from "@/services/supabase"
import { AGENTS_LIST, type Agent } from "@/config/agents"

interface ContactItem {
  id: string
  type: "agent" | "sent-invitation" | "received-invitation" | "connection" | "other-user"
  name: string
  username: string
  avatar?: string | any // Can be string URL or require() object for agents
  description?: string // For agents
  hasRelationship?: boolean
  data?: Invitation | UserConnection | Profile | Agent
  otherUserId?: string // For connections, the other user's ID
}

export default function ContactsScreen() {
  const router = useRouter()
  const { themed, theme } = useAppTheme()
  const { user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [allUsers, setAllUsers] = useState<Profile[]>([])
  const [sentInvitations, setSentInvitations] = useState<
    Array<Invitation & { invitedProfile?: Profile | null }>
  >([])
  const [receivedInvitations, setReceivedInvitations] = useState<
    Array<Invitation & { inviterProfile?: Profile | null }>
  >([])
  const [connections, setConnections] = useState<
    Array<UserConnection & { otherProfile?: Profile | null }>
  >([])
  const [sendingInvitation, setSendingInvitation] = useState(false)

  useEffect(() => {
    loadProfile()
    loadAllUsers()
  }, [])

  // Setup realtime subscription for invitations
  useEffect(() => {
    if (!user || !profile) return

    console.log(
      "Setting up realtime subscription for user:",
      user.id,
      "username:",
      profile.username,
    )

    // Create two separate channels for sent and received invitations
    const sentChannel = supabase
      .channel(`invitations-sent-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "invitations",
          filter: `invited_by=eq.${user.id}`,
        },
        (payload) => {
          console.log("Sent invitation change detected:", payload)
          loadContacts(profile.username)
        },
      )
      .subscribe((status) => {
        console.log("Sent invitations realtime subscription status:", status)
      })

    const receivedChannel = supabase
      .channel(`invitations-received-${profile.username}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "invitations",
          filter: `invite_value=eq.${profile.username}`,
        },
        (payload) => {
          console.log("Received invitation change detected:", payload)
          loadContacts(profile.username)
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "invitations",
          filter: `invite_value=eq.${profile.username}`,
        },
        (payload) => {
          console.log("Invitation status updated:", payload)
          loadContacts(profile.username)
        },
      )
      .subscribe((status) => {
        console.log("Received invitations realtime subscription status:", status)
      })

    return () => {
      console.log("Unsubscribing from invitations realtime")
      sentChannel.unsubscribe()
      receivedChannel.unsubscribe()
    }
  }, [user?.id, profile?.username])

  async function loadAllUsers() {
    try {
      const { data: profiles, error } = await fetchFromTable("profiles", "*")

      if (error) {
        console.error("Error loading all users:", error)
        return
      }

      if (profiles) {
        setAllUsers(profiles as Profile[])
      }
    } catch (error) {
      console.error("Error loading all users:", error)
    }
  }

  async function loadProfile() {
    if (!user) return

    try {
      const { data, error } = await getProfile(user.id)
      if (error) {
        console.error("Error loading profile:", error)
        return
      }

      if (data) {
        setProfile(data)
        loadContacts(data.username)
      }
    } catch (error) {
      console.error("Error loading profile:", error)
    }
  }

  async function loadContacts(username: string) {
    if (!user) return

    try {
      setLoading(true)

      // Load sent invitations
      const { data: sentData, error: sentError } = await getSentInvitations(user.id)
      if (sentError) {
        console.error("Error loading sent invitations:", sentError)
      } else {
        // Fetch invited user profiles
        const enrichedSentInvitations = await Promise.all(
          (sentData || []).map(async (invitation) => {
            if (!invitation.invite_value) return invitation

            const { data: invitedProfile } = await supabase
              .from("profiles")
              .select("*")
              .eq("username", invitation.invite_value)
              .maybeSingle()

            return {
              ...invitation,
              invitedProfile,
            }
          }),
        )
        setSentInvitations(enrichedSentInvitations)
      }

      // Load received invitations using username
      const { data: receivedData, error: receivedError } = await getReceivedInvitations(username)
      if (receivedError) {
        console.error("Error loading received invitations:", receivedError)
      } else {
        // Fetch inviter profiles
        const enrichedReceivedInvitations = await Promise.all(
          (receivedData || []).map(async (invitation) => {
            const { data: inviterProfile } = await getProfile(invitation.invited_by)

            return {
              ...invitation,
              inviterProfile,
            }
          }),
        )
        setReceivedInvitations(enrichedReceivedInvitations)
      }

      // Load connections
      const { data: connectionsData, error: connectionsError } = await getAllUserConnections(
        user.id,
      )
      if (connectionsError) {
        console.error("Error loading connections:", connectionsError)
      } else {
        // Fetch profiles for each connection
        // Note: user_id is always the current user, so other user is always connected_user_id
        const enrichedConnections = await Promise.all(
          (connectionsData || []).map(async (connection) => {
            const { data: otherProfile } = await getProfile(connection.connected_user_id)

            return {
              ...connection,
              otherProfile,
            }
          }),
        )

        setConnections(enrichedConnections)
      }
    } catch (error) {
      console.error("Error loading contacts:", error)
    } finally {
      setLoading(false)
    }
  }

  async function handleAcceptInvitation(invitation: Invitation) {
    if (!user) return

    try {
      // Accept the invitation
      const { error: acceptError } = await acceptInvitation(invitation.id, user.id)

      if (acceptError) {
        console.error("Error accepting invitation:", acceptError)
        Alert.alert("Error", "Failed to accept invitation")
        return
      }

      // Create user connection with null connection_type
      // Note: We need to create TWO connections (duplex relationship)
      // 1. invited_by -> current user
      // 2. current user -> invited_by
      const { error: connectionError1 } = await createUserConnection({
        user_id: invitation.invited_by,
        connected_user_id: user.id,
        relationship_type_id: null,
      })

      if (connectionError1) {
        console.error("Error creating connection 1:", connectionError1)
        Alert.alert("Error", "Failed to create connection")
        return
      }

      const { error: connectionError2 } = await createUserConnection({
        user_id: user.id,
        connected_user_id: invitation.invited_by,
        relationship_type_id: null,
      })

      if (connectionError2) {
        console.error("Error creating connection 2:", connectionError2)
        Alert.alert("Error", "Failed to create connection")
        return
      }

      Alert.alert("Success", "Invitation accepted!")
      if (profile) {
        loadContacts(profile.username) // Reload to refresh the list
      }
    } catch (error) {
      console.error("Error accepting invitation:", error)
      Alert.alert("Error", "Failed to accept invitation")
    }
  }

  async function handleRejectInvitation(invitation: Invitation) {
    try {
      const { error } = await rejectInvitation(invitation.id)

      if (error) {
        console.error("Error rejecting invitation:", error)
        Alert.alert("Error", "Failed to reject invitation")
        return
      }

      if (profile) {
        loadContacts(profile.username) // Reload to refresh the list
      }
    } catch (error) {
      console.error("Error rejecting invitation:", error)
      Alert.alert("Error", "Failed to reject invitation")
    }
  }

  async function handleSendInvitation(otherUser: Profile) {
    if (!user || !profile || sendingInvitation) return

    // Check if invitation already sent
    const alreadySent = sentInvitations.some((inv) => inv.invite_value === otherUser.username)

    if (alreadySent) {
      Alert.alert("Already Sent", "You have already sent an invitation to this user")
      return
    }

    try {
      setSendingInvitation(true)
      const { error } = await sendConnectionInvitation(user.id, otherUser.username)

      if (error) {
        console.error("Error sending invitation:", error)
        Alert.alert("Error", "Failed to send invitation")
        return
      }

      Alert.alert("Success", `Invitation sent to ${otherUser.name}`)
      loadContacts(profile.username) // Reload to show the new invitation
    } catch (error) {
      console.error("Error sending invitation:", error)
      Alert.alert("Error", "Failed to send invitation")
    } finally {
      setSendingInvitation(false)
    }
  }

  async function handleContactPress(item: ContactItem) {
    if (item.type === "agent") {
      // Create or find existing chat with this agent
      await handleAgentChatPress(item)
    } else if (item.type === "connection") {
      const connection = item.data as UserConnection
      if (!connection.connection_type) {
        // No relationship defined, go to relationship update
        router.push(`/contacts/${connection.id}/relationship`)
      } else {
        // Has relationship, find or create DM chat
        await handleConnectionChatPress(item.otherUserId!)
      }
    } else if (item.type === "other-user") {
      // Non-connection user, send invitation
      handleSendInvitation(item.data as Profile)
    }
  }

  async function handleAgentChatPress(item: ContactItem) {
    if (!user) return

    try {
      // Always create a new chat with the agent
      const { data: newChat, error: chatError } = await supabase
        .from("chats")
        .insert({
          type: "dm",
          created_by: user.id,
          participant_count: 1,
          name: item.name,
          alfred_enabled: true,
          active_agent: item.username,
          message_count: 0,
        })
        .select()
        .single()

      if (chatError) throw chatError

      // Add user as participant
      const { error: participantError } = await supabase.from("chat_participants").insert({
        chat_id: newChat.id,
        user_id: user.id,
        role: "creator",
      })

      if (participantError) throw participantError

      // Navigate to new chat
      router.push(`/chats/${newChat.id}`)
    } catch (error) {
      console.error("Error creating agent chat:", error)
      Alert.alert(translate("common:error"), "Failed to create chat with agent")
    }
  }

  async function handleConnectionChatPress(otherUserId: string) {
    if (!user) return

    try {
      // Always create a new chat with this connection
      const { data: otherUserProfile } = await getProfile(otherUserId)

      const { data: newChat, error: chatError } = await supabase
        .from("chats")
        .insert({
          type: "dm",
          created_by: user.id,
          participant_count: 2,
          name: otherUserProfile?.name || "Chat",
          alfred_enabled: false,
          message_count: 0,
        })
        .select()
        .single()

      if (chatError) throw chatError

      // Add both users as participants
      const { error: participantError } = await supabase.from("chat_participants").insert([
        { chat_id: newChat.id, user_id: user.id, role: "creator" },
        { chat_id: newChat.id, user_id: otherUserId, role: "member" },
      ])

      if (participantError) throw participantError

      // Navigate to new chat
      router.push(`/chats/${newChat.id}`)
    } catch (error) {
      console.error("Error creating DM chat:", error)
      Alert.alert(translate("common:error"), "Failed to create chat")
    }
  }

  function handleSettingsPress(connection: UserConnection) {
    router.push(`/contacts/${connection.id}/relationship`)
  }

  // Filter and search contacts - same logic as new.tsx
  const getFilteredData = useCallback(() => {
    const query = searchQuery.toLowerCase().trim()

    // Helper to filter by search query
    const filterByQuery = <T extends { name: string; username: string }>(items: T[]) => {
      if (!query) return items
      return items.filter(
        (item) =>
          item.name.toLowerCase().includes(query) || item.username.toLowerCase().includes(query),
      )
    }

    // Get excluded user IDs (already in connections or invitations)
    const connectedUserIds = connections.map((c) => c.connected_user_id)
    const sentInvitationUsernames = sentInvitations.map((inv) => inv.invite_value)
    const receivedInvitationUsernames = receivedInvitations.map((inv) => inv.invite_value)

    // Filter other users (not connected, not invited)
    const otherUsers = allUsers.filter((u) => {
      if (u.id === user?.id) return false // Exclude self
      if (connectedUserIds.includes(u.id)) return false // Exclude connections
      if (sentInvitationUsernames.includes(u.username)) return false // Exclude sent invitations
      if (receivedInvitationUsernames.includes(u.username)) return false // Exclude received invitations
      return true
    })

    if (!query) {
      // No search: show sent invitations, received invitations, and connections (no filtering)
      // Don't show other users unless searching
      return {
        sentInvitations: sentInvitations,
        receivedInvitations: receivedInvitations,
        connections: connections,
        otherUsers: [],
      }
    }

    // With search: filter all sections including other users
    return {
      sentInvitations: filterByQuery(
        sentInvitations.map((inv) => ({
          ...inv,
          name: inv.invite_value || "User",
          username: inv.invite_value || "unknown",
        })),
      ).map((_, idx) => sentInvitations[idx]),
      receivedInvitations: filterByQuery(
        receivedInvitations.map((inv) => ({
          ...inv,
          name: inv.invite_value || "User",
          username: inv.invite_value || "unknown",
        })),
      ).map((_, idx) => receivedInvitations[idx]),
      connections: filterByQuery(
        connections.map((c) => ({
          ...c,
          name: c.otherProfile?.name || "User",
          username: c.otherProfile?.username || "unknown",
        })),
      ).map((_, idx) => connections[idx]),
      otherUsers: filterByQuery(otherUsers),
    }
  }, [searchQuery, allUsers, connections, sentInvitations, receivedInvitations, user])

  const filteredData = getFilteredData()

  // Build contact items array using filtered data
  const contactItems: ContactItem[] = [
    // Always show all AI agents first
    ...AGENTS_LIST.map(
      (agent): ContactItem => ({
        id: `agent-${agent.username}`,
        type: "agent",
        name: translate(agent.name),
        username: agent.username,
        avatar: agent.avatar,
        description: translate(agent.description),
        data: agent,
      }),
    ),
    // Sent invitations (filtered) - show invited user's profile
    ...filteredData.sentInvitations.map(
      (inv): ContactItem => ({
        id: inv.id,
        type: "sent-invitation",
        name: inv.invitedProfile?.name || inv.invite_value || "User",
        username: inv.invitedProfile?.username || inv.invite_value || "unknown",
        avatar: inv.invitedProfile?.avatar_url,
        data: inv,
      }),
    ),
    // Received invitations (filtered) - show inviter's profile
    ...filteredData.receivedInvitations.map(
      (inv): ContactItem => ({
        id: inv.id,
        type: "received-invitation",
        name: inv.inviterProfile?.name || "User",
        username: inv.inviterProfile?.username || "unknown",
        avatar: inv.inviterProfile?.avatar_url,
        data: inv,
      }),
    ),
    // Connections (filtered)
    ...filteredData.connections.map(
      (conn): ContactItem => ({
        id: conn.id,
        type: "connection",
        name: conn.otherProfile?.name || "User",
        username: conn.otherProfile?.username || "unknown",
        avatar: conn.otherProfile?.avatar_url,
        hasRelationship: !!conn.connection_type,
        data: conn,
        otherUserId: conn.connected_user_id, // Always the connected_user_id since user_id is current user
      }),
    ),
    // Other users (only show when searching)
    ...filteredData.otherUsers.map(
      (u): ContactItem => ({
        id: u.id,
        type: "other-user",
        name: u.name,
        username: u.username,
        avatar: u.avatar_url,
        data: u,
      }),
    ),
  ]

  const renderSectionHeader = (title: string) => (
    <View style={themed($sectionHeader)}>
      <Text preset="subheading" text={title} style={themed($sectionTitle)} />
    </View>
  )

  const renderContactItem = ({ item, index }: { item: ContactItem; index: number }) => {
    // Show section headers
    const agentsCount = AGENTS_LIST.length
    let sectionHeader = null

    if (index === 0) {
      // AI Agents section header (before first agent)
      sectionHeader = renderSectionHeader("AI Agents")
    } else if (index === agentsCount && filteredData.sentInvitations.length > 0) {
      sectionHeader = renderSectionHeader(translate("contacts:sections.sentInvitations"))
    } else if (
      index === agentsCount + filteredData.sentInvitations.length &&
      filteredData.receivedInvitations.length > 0
    ) {
      sectionHeader = renderSectionHeader(translate("contacts:sections.invitations"))
    } else if (
      index ===
        agentsCount +
          filteredData.sentInvitations.length +
          filteredData.receivedInvitations.length &&
      filteredData.connections.length > 0
    ) {
      sectionHeader = renderSectionHeader(translate("contacts:sections.connections"))
    } else if (
      index ===
        agentsCount +
          filteredData.sentInvitations.length +
          filteredData.receivedInvitations.length +
          filteredData.connections.length &&
      filteredData.otherUsers.length > 0
    ) {
      sectionHeader = renderSectionHeader(translate("contacts:sections.otherUsers"))
    }

    return (
      <>
        {sectionHeader}
        <Pressable
          style={({ pressed }) => [themed($contactItem), pressed && themed($contactItemPressed)]}
          onPress={() => handleContactPress(item)}
        >
          <View style={themed($avatarContainer)}>
            {item.avatar ? (
              item.type === "agent" ? (
                // Agent avatars are require() objects
                <Image source={item.avatar} style={themed($avatar)} resizeMode="cover" />
              ) : (
                // User avatars are URL strings
                <Image source={{ uri: item.avatar }} style={themed($avatar)} resizeMode="cover" />
              )
            ) : (
              <View style={themed($avatarPlaceholder)}>
                <MaterialCommunityIcons
                  name={item.type === "agent" ? "robot" : "account"}
                  size={32}
                  color={theme.colors.palette.neutral100}
                />
              </View>
            )}
          </View>
          {item.type === "agent" ? (
            <View style={themed($contactContent)}>
              <View style={themed($nameRow)}>
                <Text text={item.name} style={themed($contactName)} numberOfLines={1} />
                <Text
                  text={`@${item.username}`}
                  style={themed($contactUsername)}
                  numberOfLines={1}
                />
              </View>
              {item.description && <Text text={item.description} style={themed($statusText)} />}
            </View>
          ) : (
            <View style={themed($contactContent)}>
              <View style={themed($nameRow)}>
                <Text text={item.name} style={themed($contactName)} numberOfLines={1} />
              </View>
              <Text text={`@${item.username}`} style={themed($contactUsername)} numberOfLines={1} />
              {item.type === "sent-invitation" && (
                <Text tx="contacts:status.pending" style={themed($statusText)} />
              )}
            </View>
          )}

          {item.type === "connection" && !item.hasRelationship && (
            <MaterialCommunityIcons
              name="alert-circle"
              size={20}
              color={theme.colors.palette.angry500}
            />
          )}
          {item.type === "received-invitation" && (
            <View style={themed($invitationActions)}>
              <TouchableOpacity
                style={themed($actionButton)}
                onPress={(e) => {
                  e.stopPropagation()
                  handleAcceptInvitation(item.data as Invitation)
                }}
              >
                <MaterialCommunityIcons
                  name="check"
                  size={24}
                  color={theme.colors.palette.success}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={themed($actionButton)}
                onPress={(e) => {
                  e.stopPropagation()
                  handleRejectInvitation(item.data as Invitation)
                }}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={24}
                  color={theme.colors.palette.angry500}
                />
              </TouchableOpacity>
            </View>
          )}

          {item.type === "connection" && (
            <TouchableOpacity
              style={themed($settingsButton)}
              onPress={(e) => {
                e.stopPropagation()
                handleSettingsPress(item.data as UserConnection)
              }}
            >
              <MaterialCommunityIcons name="cog" size={24} color={theme.colors.textDim} />
            </TouchableOpacity>
          )}

          {item.type === "other-user" && (
            <TouchableOpacity style={themed($sendInviteButton)} disabled={sendingInvitation}>
              {sendingInvitation ? (
                <ActivityIndicator size="small" color={theme.colors.tint} />
              ) : (
                <MaterialCommunityIcons name="account-plus" size={24} color={theme.colors.tint} />
              )}
            </TouchableOpacity>
          )}
        </Pressable>
      </>
    )
  }

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
    <Screen preset="fixed" contentContainerStyle={themed($container)}>
      <View style={themed($header)}>
        <Text tx="contacts:title" preset="heading" />
      </View>
      <View style={themed($searchContainer)}>
        <TextField
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={translate("contacts:search")}
          containerStyle={themed($searchField)}
          LeftAccessory={() => (
            <MaterialCommunityIcons
              name="magnify"
              size={20}
              color={theme.colors.textDim}
              style={themed($searchFieldLeft)}
            />
          )}
        />
      </View>

      <FlatList
        data={contactItems}
        renderItem={renderContactItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={themed($listContent)}
      />
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

const $header: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingVertical: spacing.md,
  marginTop: spacing.xl,
  marginHorizontal: spacing.sm,
})

const $searchContainer: ThemedStyle<ViewStyle> = ({ spacing, colors }) => ({
  paddingHorizontal: spacing.md,
  paddingTop: spacing.sm,
  paddingBottom: spacing.xs,
  backgroundColor: colors.background,
  borderBottomWidth: 1,
  borderBottomColor: colors.border,
})

const $searchField: ThemedStyle<ViewStyle> = () => ({
  marginBottom: 0,
})

const $searchFieldLeft: ThemedStyle<TextStyle> = ({ spacing }) => ({
  alignSelf: "center",
  marginLeft: spacing.xs,
})

const $listContent: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexGrow: 1,
  paddingTop: spacing.sm,
})

const $sectionHeader: ThemedStyle<ViewStyle> = ({ spacing, colors }) => ({
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.xs,
  backgroundColor: colors.separator,
})

const $sectionTitle: ThemedStyle<TextStyle> = () => ({
  fontSize: 14,
  fontWeight: "600",
})

const $contactItem: ThemedStyle<ViewStyle> = ({ spacing, colors }) => ({
  flexDirection: "row",
  padding: spacing.md,
  alignItems: "center",
  backgroundColor: colors.background,
  borderBottomWidth: 1,
  borderBottomColor: colors.border,
  gap: spacing.sm,
})

const $contactItemPressed: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.palette.neutral200,
})

const $avatarContainer: ThemedStyle<ViewStyle> = () => ({
  position: "relative",
})

const $avatar: ThemedStyle<ImageStyle> = () => ({
  width: 56,
  height: 56,
  borderRadius: 28,
})

const $avatarPlaceholder: ThemedStyle<ViewStyle> = ({ colors }) => ({
  width: 56,
  height: 56,
  borderRadius: 28,
  backgroundColor: colors.palette.neutral400,
  justifyContent: "center",
  alignItems: "center",
})

const $contactContent: ThemedStyle<ViewStyle> = () => ({
  flex: 1,
})

const $nameRow: ThemedStyle<ViewStyle> = () => ({
  flexDirection: "row",
  alignItems: "center",
})

const $contactName: ThemedStyle<TextStyle> = () => ({
  fontSize: 16,
  fontWeight: "600",
  marginBottom: 2,
  flex: 1,
})

const $contactUsername: ThemedStyle<TextStyle> = ({ colors }) => ({
  fontSize: 14,
  color: colors.textDim,
  marginBottom: 2,
})

const $statusText: ThemedStyle<TextStyle> = ({ colors }) => ({
  fontSize: 12,
  color: colors.textDim,
  fontStyle: "italic",
})

const $invitationActions: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  gap: spacing.xs,
})

const $actionButton: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  padding: spacing.xs,
})

const $settingsButton: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  padding: spacing.xs,
})

const $sendInviteButton: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  padding: spacing.xs,
})
