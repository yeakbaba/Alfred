import { useState } from "react"
import {
  FlatList,
  Image,
  ImageStyle,
  Pressable,
  TextStyle,
  View,
  ViewStyle,
  ActivityIndicator,
  RefreshControl,
} from "react-native"
import { useRouter } from "expo-router"
import { MaterialCommunityIcons } from "@expo/vector-icons"

import { Button } from "@/components/Button"
import { EmptyState } from "@/components/EmptyState"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { TextField } from "@/components/TextField"
import { translate } from "@/i18n"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"
import { useChats, type ChatParticipant } from "@/contexts/ChatsContext"
import { getAgentByUsername, DEFAULT_AGENT } from "@/config/agents"

export default function ChatsScreen() {
  const router = useRouter()
  const { themed, theme } = useAppTheme()
  const { chats, isLoading, refreshChats } = useChats()

  const [searchQuery, setSearchQuery] = useState("")
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Handle pull-to-refresh
  const handleRefresh = async () => {
    setIsRefreshing(true)
    await refreshChats()
    setIsRefreshing(false)
  }

  // Filter chats based on search query
  const filteredChats = chats.filter((chat) =>
    chat.name.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const renderChatItem = ({ item }: { item: (typeof chats)[0] }) => {
    const participants = item.participants || []

    // Get active agent info
    const activeAgent = item.activeAgent
      ? getAgentByUsername(item.activeAgent) || DEFAULT_AGENT
      : DEFAULT_AGENT

    // Determine display name and avatars based on participants
    let displayName = activeAgent.username.charAt(0).toUpperCase() + activeAgent.username.slice(1)
    let displayAvatars: ChatParticipant[] = []

    if (participants.length === 0) {
      // Only active agent
      displayName = activeAgent.username.charAt(0).toUpperCase() + activeAgent.username.slice(1)
      displayAvatars = []
    } else if (participants.length === 1) {
      // Single participant - show full name
      displayName = participants[0].name
      displayAvatars = [participants[0]]
    } else if (participants.length === 2) {
      // 2 participants - show both first names
      displayName = participants.map(p => p.first_name || p.name).join(", ")
      displayAvatars = participants
    } else if (participants.length === 3) {
      // 3 participants - show all three first names and avatars
      displayName = participants.map(p => p.first_name || p.name).join(", ")
      displayAvatars = participants
    } else {
      // 4+ participants - show first 2 avatars + "..." and first names
      displayName = participants.map(p => p.first_name || p.name).join(", ")
      displayAvatars = participants.slice(0, 2) // Only show first 2 avatars
    }

    return (
      <Pressable
        style={({ pressed }) => [themed($chatItem), pressed && themed($chatItemPressed)]}
        onPress={() => router.push(`/chats/${item.id}`)}
      >
        {/* Avatar Section */}
        <View style={themed($avatarContainer)}>
          {displayAvatars.length === 0 ? (
            // Only active agent - show agent avatar (no badge needed since avatar is already the agent)
            <Image source={activeAgent.avatar} style={themed($avatar)} />
          ) : displayAvatars.length === 1 ? (
            // Single participant
            <>
              {displayAvatars[0].avatar_url ? (
                <Image source={{ uri: displayAvatars[0].avatar_url }} style={themed($avatar)} />
              ) : (
                <View style={themed($avatarPlaceholder)}>
                  <Text text={displayAvatars[0].name.charAt(0).toUpperCase()} style={themed($avatarText)} />
                </View>
              )}
              {/* Active agent badge */}
              {item.activeAgent && (
                <View style={themed($alfredBadge)}>
                  <Image source={activeAgent.avatar} style={themed($alfredIcon)} />
                </View>
              )}
            </>
          ) : (
            // Multiple participants - overlapping avatars
            <View style={themed($multipleAvatarsContainer)}>
              {displayAvatars.map((participant, index) => (
                <View
                  key={participant.user_id}
                  style={[themed($overlappingAvatar), { zIndex: displayAvatars.length - index, marginLeft: index * 25 }]}
                >
                  {participant.avatar_url ? (
                    <Image source={{ uri: participant.avatar_url }} style={themed($smallAvatar)} />
                  ) : (
                    <View style={themed($smallAvatarPlaceholder)}>
                      <Text text={participant.name.charAt(0).toUpperCase()} style={themed($smallAvatarText)} />
                    </View>
                  )}
                </View>
              ))}
              {participants.length > 3 && (
                <View style={[themed($overlappingAvatar), { zIndex: 0, marginLeft: displayAvatars.length * 25 }]}>
                  <View style={themed($moreAvatarPlaceholder)}>
                    <Text text="..." style={themed($moreAvatarText)} />
                  </View>
                </View>
              )}
              {/* Active agent badge */}
              {item.activeAgent && (
                <View style={themed($alfredBadgeMultiple)}>
                  <Image source={activeAgent.avatar} style={themed($alfredIcon)} />
                </View>
              )}
            </View>
          )}
        </View>

        <View style={themed($chatContent)}>
          <View style={themed($chatHeader)}>
            <Text text={displayName} style={themed($chatName)} numberOfLines={1} />
            <Text text={item.lastMessageTime} style={themed($chatTime)} />
          </View>

          <View style={themed($chatFooter)}>
            <Text text={item.lastMessage} style={themed($lastMessage)} numberOfLines={1} />
            {item.unreadCount > 0 && (
              <View style={themed($unreadBadge)}>
                <Text
                  text={item.unreadCount > 99 ? "99+" : item.unreadCount.toString()}
                  style={themed($unreadText)}
                />
              </View>
            )}
          </View>
        </View>
      </Pressable>
    )
  }

  return (
    <Screen preset="fixed" safeAreaEdges={["top"]} contentContainerStyle={themed($container)}>
      <View style={themed($header)}>
        <Text tx="chats:title" preset="heading" />
        <Button tx="chats:new.new" preset="default" onPress={() => router.push("/chats/new")} />
      </View>

      <TextField
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder={translate("chats:search")}
        containerStyle={themed($searchField)}
        LeftAccessory={() => (
          <MaterialCommunityIcons
            style={themed($searchFieldLeft)}
            name="magnify"
            size={20}
            color={theme.colors.textDim}
          />
        )}
      />

      {isLoading && !chats.length ? (
        <View style={themed($loadingContainer)}>
          <ActivityIndicator size="large" color={theme.colors.tint} />
        </View>
      ) : filteredChats.length === 0 ? (
        <View style={themed($emptyState)}>
          <EmptyState
            preset="generic"
            heading={translate("chats:emptyState")}
            content={translate("chats:emptyStateSubtitle")}
            button={translate("chats:newChat")}
            buttonOnPress={() => router.push("/chats/new")}
          />
        </View>
      ) : (
        <FlatList
          data={filteredChats}
          renderItem={renderChatItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={themed($listContent)}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={theme.colors.tint}
            />
          }
        />
      )}
    </Screen>
  )
}

// Styles
const $container: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flex: 1,
  paddingHorizontal: spacing.md,
})

const $header: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  paddingVertical: spacing.md,
})

const $searchField: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginBottom: spacing.md,
})
const $searchFieldLeft: ThemedStyle<TextStyle> = ({ spacing }) => ({
  alignSelf: "center",
  marginLeft: spacing.xs,
})

const $loadingContainer: ThemedStyle<ViewStyle> = () => ({
  flex: 1,
  justifyContent: "center",
  alignItems: "center",
})

const $emptyState: ThemedStyle<ViewStyle> = () => ({
  paddingTop: 40,
})

const $listContent: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingBottom: spacing.lg,
})

const $chatItem: ThemedStyle<ViewStyle> = ({ spacing, colors }) => ({
  flexDirection: "row",
  alignItems: "center",
  paddingVertical: spacing.sm,
  paddingHorizontal: spacing.xs,
  borderRadius: spacing.xs,
  backgroundColor: colors.background,
})

const $chatItemPressed: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.separator,
})

const $avatarContainer: ThemedStyle<ViewStyle> = () => ({
  position: "relative",
  marginRight: 12,
})

const $avatar: ThemedStyle<ImageStyle> = () => ({
  width: 50,
  height: 50,
  borderRadius: 25,
})

const $avatarPlaceholder: ThemedStyle<ViewStyle> = ({ colors }) => ({
  width: 50,
  height: 50,
  borderRadius: 25,
  backgroundColor: colors.tint,
  justifyContent: "center",
  alignItems: "center",
})

const $avatarText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.background,
  fontSize: 18,
  fontWeight: "bold",
})

const $onlineIndicator: ThemedStyle<ViewStyle> = ({ colors }) => ({
  position: "absolute",
  bottom: 0,
  right: 0,
  width: 14,
  height: 14,
  borderRadius: 7,
  backgroundColor: colors.palette.success,
  borderWidth: 2,
  borderColor: colors.background,
})

const $multipleAvatarsContainer: ThemedStyle<ViewStyle> = () => ({
  flexDirection: "row",
  alignItems: "center",
  height: 50,
  minWidth: 80,
})

const $overlappingAvatar: ThemedStyle<ViewStyle> = () => ({
  position: "absolute",
})

const $smallAvatar: ThemedStyle<ImageStyle> = ({ colors }) => ({
  width: 40,
  height: 40,
  borderRadius: 20,
  borderWidth: 2,
  borderColor: colors.background,
})

const $smallAvatarPlaceholder: ThemedStyle<ViewStyle> = ({ colors }) => ({
  width: 40,
  height: 40,
  borderRadius: 20,
  backgroundColor: colors.tint,
  justifyContent: "center",
  alignItems: "center",
  borderWidth: 2,
  borderColor: colors.background,
})

const $smallAvatarText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.background,
  fontSize: 14,
  fontWeight: "bold",
})

const $moreAvatarPlaceholder: ThemedStyle<ViewStyle> = ({ colors }) => ({
  width: 40,
  height: 40,
  borderRadius: 20,
  backgroundColor: colors.palette.neutral400,
  justifyContent: "center",
  alignItems: "center",
  borderWidth: 2,
  borderColor: colors.background,
})

const $moreAvatarText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.background,
  fontSize: 16,
  fontWeight: "bold",
})

const $alfredBadge: ThemedStyle<ViewStyle> = ({ colors }) => ({
  position: "absolute",
  top: -4,
  right: -4,
  width: 24,
  height: 24,
  borderRadius: 12,
  backgroundColor: colors.background,
  borderWidth: 2,
  borderColor: colors.tint,
  overflow: "hidden",
})

const $alfredBadgeMultiple: ThemedStyle<ViewStyle> = ({ colors }) => ({
  position: "absolute",
  top: -4,
  right: -4,
  width: 24,
  height: 24,
  borderRadius: 12,
  backgroundColor: colors.background,
  borderWidth: 2,
  borderColor: colors.tint,
  overflow: "hidden",
  zIndex: 100,
})

const $alfredIcon: ThemedStyle<ImageStyle> = () => ({
  width: 20,
  height: 20,
  borderRadius: 10,
})

const $chatContent: ThemedStyle<ViewStyle> = () => ({
  flex: 1,
  justifyContent: "center",
})

const $chatHeader: ThemedStyle<ViewStyle> = () => ({
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 4,
})

const $chatName: ThemedStyle<TextStyle> = ({ colors }) => ({
  flex: 1,
  fontSize: 16,
  fontWeight: "600",
  color: colors.text,
  marginRight: 8,
})

const $chatTime: ThemedStyle<TextStyle> = ({ colors }) => ({
  fontSize: 12,
  color: colors.textDim,
})

const $chatFooter: ThemedStyle<ViewStyle> = () => ({
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
})

const $lastMessage: ThemedStyle<TextStyle> = ({ colors }) => ({
  flex: 1,
  fontSize: 14,
  color: colors.textDim,
  marginRight: 8,
})

const $unreadBadge: ThemedStyle<ViewStyle> = ({ colors }) => ({
  minWidth: 20,
  height: 20,
  borderRadius: 10,
  backgroundColor: colors.tint,
  justifyContent: "center",
  alignItems: "center",
  paddingHorizontal: 6,
})

const $unreadText: ThemedStyle<TextStyle> = ({ colors }) => ({
  fontSize: 11,
  fontWeight: "bold",
  color: colors.background,
})
