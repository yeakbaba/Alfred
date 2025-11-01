import avatars from "../../assets/images/avatars"

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
    avatar: avatars.alfred,
    description: "agents:alfred.description",
    color: "#4A90E2",
  },
  max: {
    id: "max",
    username: "max",
    name: "agents:max.name",
    avatar: avatars.max,
    description: "agents:max.description",
    color: "#E94B3C",
  },
  alice: {
    id: "alice",
    username: "alice",
    name: "agents:alice.name",
    avatar: avatars.alice,
    description: "agents:alice.description",
    color: "#6BCF7F",
  },
  wes: {
    id: "wes",
    username: "wes",
    name: "agents:wes.name",
    avatar: avatars.wes,
    description: "agents:wes.description",
    color: "#F5A623",
  },
  rosa: {
    id: "rosa",
    username: "rosa",
    name: "agents:rosa.name",
    avatar: avatars.rosa,
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
