import { View, ViewStyle, Pressable, Image, ImageStyle, TextStyle } from "react-native"

import { Text } from "@/components/Text"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"
import { translate } from "@/i18n"
import { AGENTS_LIST, type Agent } from "@/config/agents"

interface MentionAutocompleteProps {
  query: string
  onSelectMention: (agent: Agent) => void
}

export function MentionAutocomplete({ query, onSelectMention }: MentionAutocompleteProps) {
  const { themed, theme } = useAppTheme()

  // Filter agents by query
  const filteredAgents = AGENTS_LIST.filter((agent) => {
    const searchQuery = query.toLowerCase()
    return (
      agent.username.toLowerCase().includes(searchQuery) ||
      translate(agent.name).toLowerCase().includes(searchQuery)
    )
  })

  if (filteredAgents.length === 0) {
    return null
  }

  return (
    <View style={themed($container)}>
      {filteredAgents.map((agent) => (
        <Pressable
          key={agent.id}
          onPress={() => onSelectMention(agent)}
          style={themed($mentionItem)}
        >
          <Image source={agent.avatar} style={themed($avatar)} resizeMode="cover" />
          <View style={themed($agentInfo)}>
            <Text text={translate(agent.name)} style={themed($name)} numberOfLines={1} />
            <Text text={`@${agent.username}`} style={themed($username)} numberOfLines={1} />
          </View>
        </Pressable>
      ))}
    </View>
  )
}

const $container: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  position: "absolute",
  bottom: "100%",
  left: 0,
  right: 0,
  backgroundColor: colors.background,
  borderRadius: 12,
  marginBottom: spacing.xs,
  padding: spacing.xs,
  maxHeight: 200,
  shadowColor: "#000",
  shadowOffset: { width: 0, height: -2 },
  shadowOpacity: 0.1,
  shadowRadius: 8,
  elevation: 5,
  borderWidth: 1,
  borderColor: colors.border,
})

const $mentionItem: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  padding: spacing.sm,
  borderRadius: 8,
  gap: spacing.sm,
})

const $avatar: ThemedStyle<ImageStyle> = () => ({
  width: 32,
  height: 32,
  borderRadius: 16,
})

const $agentInfo: ThemedStyle<ViewStyle> = () => ({
  flex: 1,
})

const $name: ThemedStyle<TextStyle> = () => ({
  fontSize: 14,
  fontWeight: "500",
})

const $username: ThemedStyle<TextStyle> = ({ colors }) => ({
  fontSize: 12,
  color: colors.textDim,
})
