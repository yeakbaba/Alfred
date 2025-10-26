import { useState } from "react"
import { FlatList, Image, ImageStyle, Pressable, TextStyle, View, ViewStyle } from "react-native"
import { useRouter } from "expo-router"

import { Button } from "@/components/Button"
import { EmptyState } from "@/components/EmptyState"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { TextField } from "@/components/TextField"
import { useAuth } from "@/hooks/useAuth"
import { translate } from "@/i18n"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

// Placeholder contact data type
interface Contact {
  id: string
  name: string
  username: string
  avatar?: string
  isOnline?: boolean
  lastSeen?: string
}

export default function ContactsScreen() {
  const router = useRouter()
  const { themed, theme } = useAppTheme()
  const { user } = useAuth()

  const [searchQuery, setSearchQuery] = useState("")
  const [contacts, setContacts] = useState<Contact[]>([])

  // Placeholder empty state - will be populated with real data later
  const filteredContacts = contacts.filter(
    (contact) =>
      contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.username.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const handleContactPress = (contactId: string) => {
    // TODO: Navigate to contact detail or open chat
    router.push(`/contacts/${contactId}`)
  }

  const handleAddContact = () => {
    // TODO: Navigate to add contact screen
    router.push("/contacts/add")
  }

  const renderContactItem = ({ item }: { item: Contact }) => (
    <Pressable
      style={({ pressed }) => [themed($contactItem), pressed && themed($contactItemPressed)]}
      onPress={() => handleContactPress(item.id)}
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
      </View>

      <View style={themed($contactContent)}>
        <Text text={item.name} style={themed($contactName)} numberOfLines={1} />
        <Text text={`@${item.username}`} style={themed($contactUsername)} numberOfLines={1} />
        {item.lastSeen && (
          <Text text={`Last seen ${item.lastSeen}`} style={themed($lastSeen)} numberOfLines={1} />
        )}
      </View>

      <Button
        text="Add"
        preset="default"
        style={themed($addButton)}
        onPress={() => handleContactPress(item.id)}
      />
    </Pressable>
  )

  return (
    <Screen preset="fixed" contentContainerStyle={themed($container)}>
      <View style={themed($header)}>
        <TextField
          value={searchQuery}
          onChangeText={setSearchQuery}
          containerStyle={themed($searchField)}
          placeholderTx="contacts:search"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Button
          tx="contacts:addContact"
          preset="filled"
          style={themed($addContactButton)}
          onPress={handleAddContact}
        />
      </View>

      {filteredContacts.length === 0 ? (
        <EmptyState
          preset="generic"
          heading={translate("contacts:emptyState")}
          content={translate("contacts:emptyStateSubtitle")}
          button={translate("contacts:startSearchButton")}
          buttonOnPress={handleAddContact}
          style={themed($emptyState)}
        />
      ) : (
        <FlatList
          data={filteredContacts}
          renderItem={renderContactItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={themed($listContent)}
        />
      )}
    </Screen>
  )
}

const $container: ThemedStyle<ViewStyle> = () => ({
  flex: 1,
})

const $header: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  padding: spacing.md,
  gap: spacing.sm,
})

const $searchField: ThemedStyle<ViewStyle> = () => ({
  marginBottom: 0,
})

const $addContactButton: ThemedStyle<ViewStyle> = () => ({})

const $emptyState: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingTop: spacing.xxxl,
})

const $listContent: ThemedStyle<ViewStyle> = () => ({
  flexGrow: 1,
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

const $avatarContainer: ThemedStyle<ViewStyle> = ({ spacing }) => ({
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
  marginBottom: 4,
})

const $lastSeen: ThemedStyle<TextStyle> = ({ colors }) => ({
  fontSize: 12,
  color: colors.textDim,
})

const $addButton: ThemedStyle<ViewStyle> = () => ({
  paddingHorizontal: 12,
  minHeight: 32,
})
