export interface Agent {
  id: string
  username: string
  name: string
  avatar: any
  description: string
  color: string
}

export const AGENTS: Record<string, Agent> = {
  alfred: {
    id: "alfred",
    username: "alfred",
    name: "agents:alfred.name",
    avatar: require("@/assets/images/avatars/alfred.jpg"),
    description: "agents:alfred.description",
    color: "#4A90E2",
  },
  max: {
    id: "max",
    username: "max",
    name: "agents:max.name",
    avatar: require("@/assets/images/avatars/max.jpg"),
    description: "agents:max.description",
    color: "#E94B3C",
  },
  alice: {
    id: "alice",
    username: "alice",
    name: "agents:alice.name",
    avatar: require("@/assets/images/avatars/alice.jpg"),
    description: "agents:alice.description",
    color: "#6BCF7F",
  },
  wes: {
    id: "wes",
    username: "wes",
    name: "agents:wes.name",
    avatar: require("@/assets/images/avatars/wes.jpg"),
    description: "agents:wes.description",
    color: "#F5A623",
  },
  rosa: {
    id: "rosa",
    username: "rosa",
    name: "agents:rosa.name",
    avatar: require("@/assets/images/avatars/rosa.jpg"),
    description: "agents:rosa.description",
    color: "#E91E63",
  },
}

export const AGENTS_LIST: Agent[] = Object.values(AGENTS)

export const DEFAULT_AGENT = AGENTS.alfred

export function getAgentByUsername(username: string): Agent | undefined {
  return AGENTS[username.toLowerCase()]
}

export function getAgentByMention(text: string): Agent | undefined {
  const mentionMatch = text.match(/@(\w+)/)
  if (!mentionMatch) return undefined
  return getAgentByUsername(mentionMatch[1])
}

export function getAllMentions(text: string): Agent[] {
  const mentions = text.match(/@(\w+)/g) || []
  return mentions
    .map((mention) => getAgentByUsername(mention.slice(1)))
    .filter((agent): agent is Agent => agent !== undefined)
}
