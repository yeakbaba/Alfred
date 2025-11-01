import { useEffect, useState, useCallback } from "react"
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
} from "react-native"
import { useRouter } from "expo-router"
import { MaterialCommunityIcons } from "@expo/vector-icons"

import { Button } from "@/components/Button"
import { EmptyState } from "@/components/EmptyState"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { TextField } from "@/components/TextField"
import { useAuth } from "@/hooks/useAuth"
import { translate } from "@/i18n"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"
import { fetchFromTable, insertIntoTable, insertMultipleIntoTable, executeQuery } from "@/services/supabase"
import { AGENTS_LIST, type Agent } from "@/config/agents"

// AI Agents are special system contacts
const AI_AGENTS: Contact[] = AGENTS_LIST.map((agent) => ({
  id: `system-${agent.username}`,
  name: agent.username.charAt(0).toUpperCase() + agent.username.slice(1),
  username: agent.username,
  avatar: agent.avatar,
  description: agent.description, // e.g., "Home & Family Planner"
  isOnline: true,
  isSystem: true,
  type: "butler" as const,
}))

interface Contact {
  id: string
  name: string
  username: string
  avatar?: string | any // Can be URL string or require() object for agents
  description?: string // For AI agents: their role/task
  email?: string
  phone?: string
  isOnline?: boolean
  isSystem?: boolean
  type?: "user" | "butler"
  isConnection?: boolean
  lastInteractionAt?: string
}

interface GroupedContacts {
  butler: Contact[]
  connections: Contact[]
  others: Contact[]
}

export default function NewChatScreen() {
  const router = useRouter()
  const { themed, theme } = useAppTheme()
  const { user } = useAuth()

  const [searchQuery, setSearchQuery] = useState("")
  const [allContacts, setAllContacts] = useState<Contact[]>([])
  const [selectedContacts, setSelectedContacts] = useState<Contact[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreatingChat, setIsCreatingChat] = useState(false)
  const [groupedContacts, setGroupedContacts] = useState<GroupedContacts>({
    butler: AI_AGENTS,
    connections: [],
    others: [],
  })

  // Load contacts and connections
  useEffect(() => {
    const loadContacts = async () => {
      try {
        if (!user?.id) return

        // Fetch user's connections with last_interaction_at, sorted descending
        const { data: connections, error: connError } = await executeQuery<any[]>((client) =>
          client
            .from("user_connections")
            .select("*")
            .eq("user_id", user.id)
            .order("last_interaction_at", { ascending: false })
        )

        if (connError) throw connError

        // Get connected user IDs
        const connectedUserIds = connections?.map((c: any) => c.connected_user_id) || []

        if (connectedUserIds.length === 0) {
          setAllContacts([])
          setGroupedContacts({
            butler: AI_AGENTS,
            connections: [],
            others: [],
          })
          return
        }

        // Fetch profiles for connected users
        const { data: profiles, error: profileError } = await executeQuery<any[]>((client) =>
          client
            .from("profiles")
            .select("*")
            .in("id", connectedUserIds)
        )

        if (profileError) throw profileError

        // Map connections to contacts with profile data
        const connectionContacts: Contact[] = (connections || [])
          .map((c: any) => {
            const profile = profiles?.find((p: any) => p.id === c.connected_user_id)
            if (!profile) return null

            return {
              id: c.connected_user_id,
              name: profile.name,
              username: profile.username,
              avatar: profile.avatar_url,
              email: profile.email,
              phone: profile.phone,
              isConnection: true,
              type: "user" as const,
              lastInteractionAt: c.last_interaction_at,
            }
          })
          .filter((c): c is Contact => c !== null) // Remove nulls

        setAllContacts(connectionContacts)

        setGroupedContacts({
          butler: AI_AGENTS,
          connections: connectionContacts,
          others: [], // No longer showing other users
        })
      } catch (error) {
        console.error("Error loading contacts:", error)
        Alert.alert(translate("common:error"), "Failed to load contacts")
      } finally {
        setIsLoading(false)
      }
    }

    loadContacts()
  }, [user?.id])

  // Filter contacts based on search - only AI agents and connections
  const getFilteredContacts = useCallback(() => {
    if (!searchQuery.trim()) {
      // No search: show AI agents + connections
      return {
        butler: groupedContacts.butler,
        connections: groupedContacts.connections,
        others: [], // Never show others
      }
    }

    // With search: only filter AI agents and connections (no others)
    const query = searchQuery.toLowerCase()
    const filterContacts = (contacts: Contact[]) =>
      contacts.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          c.username.toLowerCase().includes(query) ||
          c.phone?.includes(query) ||
          false,
      )

    return {
      butler: filterContacts(groupedContacts.butler),
      connections: filterContacts(groupedContacts.connections),
      others: [], // Never show others
    }
  }, [searchQuery, groupedContacts])

  const filteredGroups = getFilteredContacts()

  const handleContactSelect = (contact: Contact) => {
    const isAlreadySelected = selectedContacts.some((c) => c.id === contact.id)
    const hasNonConnection = selectedContacts.some((c) => c.type === "user" && !c.isConnection)
    const isSelectingNonConnection = contact.type === "user" && !contact.isConnection

    // Deselecting is always allowed
    if (isAlreadySelected) {
      setSelectedContacts((prev) => prev.filter((c) => c.id !== contact.id))
      return
    }

    // If non-connection already selected, cannot select anything
    if (hasNonConnection) {
      Alert.alert(
        translate("chats:new.errors.nonConnectionSelected"),
        translate("chats:new.errors.nonConnectionSelectedMessage"),
      )
      return
    }

    // If trying to select a non-connection user, cannot have other users already selected
    if (isSelectingNonConnection && selectedContacts.length > 0) {
      Alert.alert(
        translate("chats:new.errors.cannotAddToGroup"),
        translate("chats:new.errors.cannotAddToGroupMessage"),
      )
      return
    }

    // All checks passed, add contact
    setSelectedContacts((prev) => [...prev, contact])
  }

  const handleCreateChat = async () => {
    if (selectedContacts.length === 0) return

    setIsCreatingChat(true)
    try {
      if (!user?.id) throw new Error("User not found")

      // Determine if this is a group chat or DM
      const userContacts = selectedContacts.filter((c) => c.type === "user")
      const agentContacts = selectedContacts.filter((c) => c.type === "butler")
      const hasAgents = agentContacts.length > 0
      const isGroupChat = userContacts.length > 1 || (userContacts.length === 1 && hasAgents)

      // Determine active agent: first selected agent's username, or null if none
      const activeAgent = agentContacts.length > 0 ? agentContacts[0].username : null

      // Check for non-connection user
      const nonConnectionUser = userContacts.find((c) => !c.isConnection)

      // If non-connection user exists, check for pending invitation
      if (nonConnectionUser) {
        const { data: pendingInvitations, error: invError } = await fetchFromTable(
          "invitations",
          "*",
        )

        if (invError) throw invError

        const existingPendingInv = pendingInvitations?.find(
          (inv: any) =>
            inv.invited_by === user.id &&
            inv.invite_type === "username" &&
            inv.invite_value === nonConnectionUser.username &&
            inv.status === "pending",
        )

        // If pending invitation exists, navigate to existing chat
        if (existingPendingInv && existingPendingInv.related_chat_id) {
          router.replace(`/chats/${existingPendingInv.related_chat_id}`)
          return
        }
      }

      // Create chat
      const chatData = {
        type: isGroupChat ? "group" : "dm",
        created_by: user.id,
        participant_count: userContacts.length + (hasAgents ? 1 : 0) + 1, // +1 for current user
        name: isGroupChat ? userContacts.map((c) => c.name).join(", ") : userContacts[0]?.name,
        alfred_enabled: hasAgents, // Keep for backwards compatibility
        active_agent: activeAgent, // Set first selected agent as active
        message_count: 0,
      }

      const { data: chat, error: chatError } = await insertIntoTable("chats", chatData)

      if (chatError) throw chatError
      if (!chat) throw new Error("Failed to create chat")

      // Add participants (current user + selected contacts)
      // Note: is_active is generated from (left_at IS NULL), don't include it
      const participants = [
        {
          chat_id: chat.id,
          user_id: user.id,
          role: "creator",
          joined_at: new Date().toISOString(),
        },
        ...userContacts.map((c) => ({
          chat_id: chat.id,
          user_id: c.id,
          role: "member",
          joined_at: new Date().toISOString(),
        })),
      ]

      // If non-connection user, create invitation
      const nonConnectionUsers = userContacts.filter((c) => !c.isConnection)
      const invitations = nonConnectionUsers.map((c) => ({
        invited_by: user.id,
        invite_type: "username",
        invite_value: c.username,
        invitation_context: "chat",
        related_chat_id: chat.id,
        status: "pending",
        proposed_relationship_type: null,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      }))

      // Insert participants
      const { error: participantError } = await insertMultipleIntoTable(
        "chat_participants",
        participants,
      )

      if (participantError) throw participantError

      // Insert invitations if any
      if (invitations.length > 0) {
        const { error: invitationError } = await insertMultipleIntoTable("invitations", invitations)

        if (invitationError) throw invitationError

        // Create notifications for invitations
        const notifications = invitations.map((inv) => ({
          user_id: nonConnectionUsers.find((c) => c.username === inv.invite_value)?.id,
          type: "chat_invite",
          title: `${user.email} invited you to a chat`,
          body: `Join the conversation`,
          related_chat_id: chat.id,
          related_invitation_id: inv.id || null,
          action_type: "open_chat",
          action_data: { chat_id: chat.id },
          is_read: false,
        }))

        const { error: notificationError } = await insertMultipleIntoTable(
          "notifications",
          notifications,
        )

        if (notificationError) throw notificationError
      }

      // Navigate to chat
      router.replace(`/chats/${chat.id}`)
    } catch (error) {
      console.error("Error creating chat:", error)
      Alert.alert(
        translate("common:error"),
        error instanceof Error ? error.message : "Failed to create chat",
      )
    } finally {
      setIsCreatingChat(false)
    }
  }

  const renderContactItem = ({ item }: { item: Contact }) => {
    const isSelected = selectedContacts.some((c) => c.id === item.id)

    return (
      <Pressable
        style={({ pressed }) => [themed($contactItem), pressed && themed($contactItemPressed)]}
        onPress={() => handleContactSelect(item)}
      >
        <View style={themed($checkboxContainer)}>
          <View style={[themed($checkbox), isSelected && { backgroundColor: theme.colors.tint }]}>
            {isSelected && <Text text="✓" style={themed($checkboxText)} />}
          </View>
        </View>

        <View style={themed($avatarContainer)}>
          {item.avatar ? (
            <Image
              source={typeof item.avatar === 'string' ? { uri: item.avatar } : item.avatar}
              style={themed($avatar)}
            />
          ) : (
            <View style={themed($avatarPlaceholder)}>
              <Text text={item.name.charAt(0).toUpperCase()} style={themed($avatarText)} />
            </View>
          )}
          {item.isOnline && <View style={themed($onlineIndicator)} />}
        </View>

        <View style={themed($contactContent)}>
          <Text text={item.name} style={themed($contactName)} numberOfLines={1} />
          <Text
            text={item.isSystem && item.description ? translate(item.description) : item.isSystem ? "AI Agent" : `@${item.username}`}
            style={themed($contactUsername)}
            numberOfLines={1}
          />
        </View>
      </Pressable>
    )
  }

  const renderSection = (title: string, data: Contact[]) => {
    if (data.length === 0) return null

    return (
      <>
        <View style={themed($sectionHeader)}>
          <Text text={title} style={themed($sectionTitle)} />
        </View>
        <FlatList
          data={data}
          renderItem={renderContactItem}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
        />
      </>
    )
  }

  if (isLoading) {
    return (
      <Screen preset="fixed" contentContainerStyle={themed($container)}>
        <View style={themed($loadingContainer)}>
          <ActivityIndicator size="large" color={theme.colors.tint} />
        </View>
      </Screen>
    )
  }

  return (
    <Screen
      preset="fixed"
      contentContainerStyle={themed($container)}
      safeAreaEdges={["top", "bottom"]}
    >
      <View style={themed($header)}>
        <Text preset="heading" text="New Chat" style={themed($title)} />
        <Text
          preset="subheading"
          text={`${selectedContacts.length} selected`}
          style={themed($subtitle)}
        />
      </View>

      {selectedContacts.length > 0 && (
        <View style={themed($selectedContainer)}>
          <FlatList
            data={selectedContacts}
            renderItem={({ item }) => (
              <Pressable style={themed($selectedTag)} onPress={() => handleContactSelect(item)}>
                <Text text={item.name} style={themed($selectedTagText)} numberOfLines={1} />
                <MaterialCommunityIcons
                  name="close"
                  size={14}
                  color={theme.colors.palette.neutral100}
                />
              </Pressable>
            )}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={themed($selectedListContent)}
          />
        </View>
      )}

      <View style={themed($searchContainer)}>
        <TextField
          value={searchQuery}
          onChangeText={setSearchQuery}
          containerStyle={themed($searchField)}
          placeholderTx="chats:new.searchPlaceholder"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <FlatList
        data={[
          {
            type: "butler",
            title: translate("chats:new.sections.aiButler"),
            data: filteredGroups.butler,
          },
          {
            type: "connections",
            title: translate("chats:new.sections.yourConnections"),
            data: filteredGroups.connections,
          },
          {
            type: "others",
            title: translate("chats:new.sections.otherUsers"),
            data: filteredGroups.others,
          },
        ]}
        renderItem={({ item }) => renderSection(item.title, item.data)}
        keyExtractor={(item) => item.type}
        contentContainerStyle={themed($listContent)}
        ListEmptyComponent={
          <EmptyState
            preset="generic"
            heading={translate("chats:new.emptyState")}
            content={translate("chats:new.emptyStateSubtitle")}
            style={themed($emptyState)}
          />
        }
      />

      <View style={themed($footer)}>
        <Button
          tx="chats:new.buttons.cancel"
          preset="default"
          style={themed($cancelButton)}
          onPress={() => router.back()}
          disabled={isCreatingChat}
        />
        <Button
          tx="chats:new.buttons.createChat"
          preset="filled"
          style={themed($createButton)}
          onPress={handleCreateChat}
          disabled={selectedContacts.length === 0 || isCreatingChat}
        />
      </View>
    </Screen>
  )
}

const $container: ThemedStyle<ViewStyle> = () => ({
  flex: 1,
})

const $header: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingHorizontal: spacing.md,
  paddingTop: spacing.md,
  paddingBottom: spacing.sm,
})

const $title: ThemedStyle<TextStyle> = ({ spacing }) => ({
  marginBottom: spacing.xs,
})

const $subtitle: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
})

const $selectedContainer: ThemedStyle<ViewStyle> = ({ spacing, colors }) => ({
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.sm,
  borderBottomWidth: 1,
  borderBottomColor: colors.border,
})

const $selectedListContent: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.xs,
})

const $selectedTag: ThemedStyle<ViewStyle> = ({ spacing, colors }) => ({
  backgroundColor: colors.tint,
  borderRadius: 16,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.xxs,
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.xxs,
})

const $selectedTagText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.palette.neutral100,
  fontSize: 12,
  fontWeight: "600",
})

const $searchContainer: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.sm,
})

const $searchField: ThemedStyle<ViewStyle> = () => ({
  marginBottom: 0,
})

const $listContent: ThemedStyle<ViewStyle> = () => ({
  flexGrow: 1,
})

const $loadingContainer: ThemedStyle<ViewStyle> = () => ({
  flex: 1,
  justifyContent: "center",
  alignItems: "center",
})

const $emptyState: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingTop: spacing.xxxl,
})

const $sectionHeader: ThemedStyle<ViewStyle> = ({ spacing, colors }) => ({
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.sm,
  backgroundColor: colors.palette.neutral300,
})

const $sectionTitle: ThemedStyle<TextStyle> = ({ spacing }) => ({
  fontSize: 12,
  fontWeight: "600",
  textTransform: "uppercase",
})

const $contactItem: ThemedStyle<ViewStyle> = ({ spacing, colors }) => ({
  flexDirection: "row",
  padding: spacing.md,
  alignItems: "center",
  backgroundColor: colors.background,
  borderBottomWidth: 1,
  borderBottomColor: colors.border,
  gap: spacing.md,
})

const $contactItemPressed: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.palette.neutral200,
})

const $checkboxContainer: ThemedStyle<ViewStyle> = () => ({
  justifyContent: "center",
  alignItems: "center",
})

const $checkbox: ThemedStyle<ViewStyle> = ({ colors }) => ({
  width: 24,
  height: 24,
  borderRadius: 4,
  borderWidth: 2,
  borderColor: colors.border,
  justifyContent: "center",
  alignItems: "center",
})

const $checkboxText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.palette.neutral100,
  fontSize: 14,
  fontWeight: "bold",
})

const $avatarContainer: ThemedStyle<ViewStyle> = () => ({
  position: "relative",
})

const $avatar: ThemedStyle<ImageStyle> = () => ({
  width: 48,
  height: 48,
  borderRadius: 24,
})

const $avatarPlaceholder: ThemedStyle<ViewStyle> = ({ colors }) => ({
  width: 48,
  height: 48,
  borderRadius: 24,
  backgroundColor: colors.palette.neutral400,
  justifyContent: "center",
  alignItems: "center",
})

const $avatarText: ThemedStyle<TextStyle> = ({ colors }) => ({
  fontSize: 18,
  fontWeight: "600",
  color: colors.palette.neutral100,
})

const $onlineIndicator: ThemedStyle<ViewStyle> = ({ colors }) => ({
  position: "absolute",
  bottom: 0,
  right: 0,
  width: 12,
  height: 12,
  borderRadius: 6,
  backgroundColor: colors.palette.success,
  borderWidth: 2,
  borderColor: colors.background,
})

const $contactContent: ThemedStyle<ViewStyle> = () => ({
  flex: 1,
})

const $contactName: ThemedStyle<TextStyle> = () => ({
  fontSize: 16,
  fontWeight: "600",
  marginBottom: 2,
})

const $contactUsername: ThemedStyle<TextStyle> = ({ colors }) => ({
  fontSize: 14,
  color: colors.textDim,
})

const $footer: ThemedStyle<ViewStyle> = ({ spacing, colors }) => ({
  flexDirection: "row",
  padding: spacing.md,
  gap: spacing.sm,
  borderTopWidth: 1,
  borderTopColor: colors.border,
})

const $cancelButton: ThemedStyle<ViewStyle> = () => ({
  flex: 1,
})

const $createButton: ThemedStyle<ViewStyle> = () => ({
  flex: 1,
})
