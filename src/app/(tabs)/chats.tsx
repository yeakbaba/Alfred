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
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"
import { useChats } from "@/contexts/ChatsContext"

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

  const renderChatItem = ({ item }: { item: typeof chats[0] }) => (
    <Pressable
      style={({ pressed }) => [themed($chatItem), pressed && themed($chatItemPressed)]}
      onPress={() => router.push(`/chats/${item.id}`)}
    >
      <View style={themed($avatarContainer)}>
        {item.avatar ? (
          <Image source={{ uri: item.avatar }} style={themed($avatar)} />
        ) : (
          <View style={themed($avatarPlaceholder)}>
            <Text text={item.name.charAt(0).toUpperCase()} style={themed($avatarText)} />
          </View>
        )}
        {item.isOnline && <View style={themed($onlineIndicator)} />}
        {/* Alfred badge if enabled */}
        {item.alfredEnabled && (
          <View style={themed($alfredBadge)}>
            <Image
              source={require("../../../assets/images/alfred_icon.jpg")}
              style={themed($alfredIcon)}
            />
          </View>
        )}
      </View>

      <View style={themed($chatContent)}>
        <View style={themed($chatHeader)}>
          <Text text={item.name} style={themed($chatName)} numberOfLines={1} />
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

  return (
    <Screen preset="fixed" safeAreaEdges={["top"]} contentContainerStyle={themed($container)}>
      <View style={themed($header)}>
        <Text text="Chats" preset="heading" />
        <Button
          text="New"
          preset="default"
          onPress={() => router.push("/chats/new")}
        />
      </View>

      <TextField
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Search chats..."
        containerStyle={themed($searchField)}
        LeftAccessory={() => (
          <MaterialCommunityIcons name="magnify" size={20} color={theme.colors.textDim} />
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
            heading="No chats yet"
            content="Start a conversation by creating a new chat"
            button="New Chat"
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
