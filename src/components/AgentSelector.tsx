import { useState } from "react"
import { View, ViewStyle, Pressable, Image, ImageStyle, TextStyle, Animated } from "react-native"
import { MaterialCommunityIcons } from "@expo/vector-icons"

import { Text } from "@/components/Text"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"
import { translate } from "@/i18n"
import { AGENTS_LIST, type Agent } from "@/config/agents"

interface AgentSelectorProps {
  selectedAgent: Agent
  onSelectAgent: (agent: Agent) => void
}

export function AgentSelector({ selectedAgent, onSelectAgent }: AgentSelectorProps) {
  const { themed, theme } = useAppTheme()
  const [isExpanded, setIsExpanded] = useState(false)
  const [animation] = useState(new Animated.Value(0))

  const toggleExpanded = () => {
    const toValue = isExpanded ? 0 : 1

    Animated.spring(animation, {
      toValue,
      useNativeDriver: false,
      tension: 50,
      friction: 8,
    }).start()

    setIsExpanded(!isExpanded)
  }

  const handleSelectAgent = (agent: Agent) => {
    onSelectAgent(agent)
  }

  const handleSelectFromList = (agent: Agent) => {
    onSelectAgent(agent)
    toggleExpanded()
  }

  const listOpacity = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  })

  const listTranslateY = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [-20, 0],
  })

  return (
    <View style={themed($container)}>
      {/* Expanded List */}
      {isExpanded && (
        <Animated.View
          style={[
            themed($expandedList),
            {
              opacity: listOpacity,
              transform: [{ translateY: listTranslateY }],
            },
          ]}
        >
          {/* Agent List */}
          {AGENTS_LIST.map((agent) => (
            <Pressable
              key={agent.id}
              onPress={() => handleSelectFromList(agent)}
              style={[
                themed($agentItem),
                agent.id === selectedAgent.id && themed($agentItemSelected),
              ]}
            >
              <View style={themed($agentInfo)}>
                <View style={themed($agentHeader)}>
                  <Text text={translate(agent.name)} style={themed($agentName)} numberOfLines={1} />
                  <Text
                    text={`@${agent.username}`}
                    style={themed($agentUsername)}
                    numberOfLines={1}
                  />
                </View>
                <Text
                  text={translate(agent.description)}
                  style={themed($agentDescription)}
                  numberOfLines={1}
                />
              </View>
              <Image source={agent.avatar} style={themed($agentAvatar)} resizeMode="cover" />
            </Pressable>
          ))}
        </Animated.View>
      )}

      {/* Selected Agent Display - Avatar and Chevron as separate buttons */}
      <View style={themed($selectedAgentRow)}>
        <Pressable onPress={() => handleSelectAgent(selectedAgent)} style={themed($selectedAgentButton)}>
          <Image source={selectedAgent.avatar} style={themed($selectedAvatar)} resizeMode="cover" />
        </Pressable>
        <Pressable onPress={toggleExpanded} style={themed($chevronButton)}>
          <MaterialCommunityIcons
            name={isExpanded ? "chevron-down" : "chevron-up"}
            size={20}
            color={theme.colors.text}
          />
        </Pressable>
      </View>
    </View>
  )
}

const $container: ThemedStyle<ViewStyle> = () => ({
  position: "relative",
  alignItems: "flex-end",
})

const $expandedList: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  position: "absolute",
  bottom: "100%",
  right: 0,
  width: 240,
  backgroundColor: colors.background,
  borderRadius: 12,
  marginBottom: spacing.xs,
  padding: spacing.xs,
  shadowColor: "#000",
  shadowOffset: { width: 0, height: -2 },
  shadowOpacity: 0.1,
  shadowRadius: 8,
  elevation: 5,
  borderWidth: 1,
  borderColor: colors.border,
})

const $collapseButton: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  alignItems: "center",
  paddingVertical: spacing.xs,
  width: 40,
  height: 40,
  justifyContent: "center",
  alignSelf: "flex-end",
})

const $agentItem: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.xxs,
  borderRadius: 8,
  gap: spacing.sm,
})

const $agentItemSelected: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.palette.neutral200,
})

const $agentAvatar: ThemedStyle<ImageStyle> = () => ({
  width: 40,
  height: 40,
  borderRadius: 20,
})

const $agentInfo: ThemedStyle<ViewStyle> = () => ({
  flex: 1,
})

const $agentHeader: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.xs,
  marginBottom: 2,
})

const $agentName: ThemedStyle<TextStyle> = () => ({
  fontSize: 14,
  fontWeight: "600",
})

const $agentUsername: ThemedStyle<TextStyle> = ({ colors }) => ({
  fontSize: 12,
  color: colors.textDim,
})

const $agentDescription: ThemedStyle<TextStyle> = ({ colors }) => ({
  fontSize: 11,
  color: colors.textDim,
})

const $selectedAgentRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.xs,
})

const $selectedAgentButton: ThemedStyle<ViewStyle> = () => ({
  width: 40,
  height: 40,
})

const $selectedAvatar: ThemedStyle<ImageStyle> = () => ({
  width: 40,
  height: 40,
  borderRadius: 20,
})

const $chevronButton: ThemedStyle<ViewStyle> = ({ colors }) => ({
  width: 40,
  height: 40,
  borderRadius: 20,
  backgroundColor: colors.background,
  justifyContent: "center",
  alignItems: "center",
  borderWidth: 1,
  borderColor: colors.border,
})
