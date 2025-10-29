import { useState } from "react"
import {
  View,
  ViewStyle,
  Pressable,
  Image,
  ImageStyle,
  TextStyle,
  Animated,
} from "react-native"
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
    toggleExpanded()
  }

  const listHeight = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, AGENTS_LIST.length * 70], // 70px per item
  })

  const chevronRotation = animation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  })

  return (
    <View style={themed($container)}>
      {/* Expanded List */}
      {isExpanded && (
        <Animated.View style={[themed($expandedList), { height: listHeight }]}>
          <View style={themed($listContainer)}>
            {/* Collapse Button */}
            <Pressable onPress={toggleExpanded} style={themed($collapseButton)}>
              <MaterialCommunityIcons
                name="chevron-down"
                size={20}
                color={theme.colors.textDim}
              />
            </Pressable>

            {/* Agent List */}
            {AGENTS_LIST.map((agent) => (
              <Pressable
                key={agent.id}
                onPress={() => handleSelectAgent(agent)}
                style={[
                  themed($agentItem),
                  agent.id === selectedAgent.id && themed($agentItemSelected),
                ]}
              >
                <Image source={agent.avatar} style={themed($agentAvatar)} resizeMode="cover" />
                <View style={themed($agentInfo)}>
                  <View style={themed($agentHeader)}>
                    <Text
                      text={translate(agent.name)}
                      style={themed($agentName)}
                      numberOfLines={1}
                    />
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
              </Pressable>
            ))}
          </View>
        </Animated.View>
      )}

      {/* Selected Agent Display */}
      <Pressable onPress={toggleExpanded} style={themed($selectedAgentContainer)}>
        <View style={themed($selectedAgentContent)}>
          <Image
            source={selectedAgent.avatar}
            style={themed($selectedAvatar)}
            resizeMode="cover"
          />
          <Text
            text={translate(selectedAgent.name)}
            style={themed($selectedName)}
            numberOfLines={1}
          />
        </View>

        <Animated.View style={{ transform: [{ rotate: chevronRotation }] }}>
          <MaterialCommunityIcons name="chevron-up" size={20} color={theme.colors.text} />
        </Animated.View>
      </Pressable>
    </View>
  )
}

const $container: ThemedStyle<ViewStyle> = () => ({
  position: "relative",
})

const $expandedList: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  position: "absolute",
  bottom: "100%",
  right: 0,
  width: 300,
  backgroundColor: colors.background,
  borderRadius: 12,
  marginBottom: spacing.xs,
  overflow: "hidden",
  shadowColor: "#000",
  shadowOffset: { width: 0, height: -2 },
  shadowOpacity: 0.1,
  shadowRadius: 8,
  elevation: 5,
  borderWidth: 1,
  borderColor: colors.border,
})

const $listContainer: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  padding: spacing.xs,
})

const $collapseButton: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  alignItems: "center",
  paddingVertical: spacing.xs,
})

const $agentItem: ThemedStyle<ViewStyle> = ({ spacing, colors }) => ({
  flexDirection: "row",
  alignItems: "center",
  padding: spacing.sm,
  borderRadius: 8,
  gap: spacing.sm,
  marginVertical: spacing.xxs,
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

const $selectedAgentContainer: ThemedStyle<ViewStyle> = ({ spacing, colors }) => ({
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  backgroundColor: colors.palette.neutral200,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.xs,
  borderRadius: 20,
  gap: spacing.xs,
})

const $selectedAgentContent: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.xs,
  flex: 1,
})

const $selectedAvatar: ThemedStyle<ImageStyle> = () => ({
  width: 28,
  height: 28,
  borderRadius: 14,
})

const $selectedName: ThemedStyle<TextStyle> = () => ({
  fontSize: 13,
  fontWeight: "500",
})
