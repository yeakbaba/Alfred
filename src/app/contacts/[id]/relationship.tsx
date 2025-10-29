import { useState, useEffect } from "react"
import {
  View,
  ViewStyle,
  Alert,
  ActivityIndicator,
  Image,
  ImageStyle,
  ScrollView,
  TextStyle,
} from "react-native"
import { useRouter, useLocalSearchParams } from "expo-router"
import { MaterialCommunityIcons } from "@expo/vector-icons"

import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { TextField } from "@/components/TextField"
import { Button } from "@/components/Button"
import { ListItem } from "@/components/ListItem"
import { DatePickerModal } from "@/components/DatePickerModal"
import { useAuth } from "@/hooks/useAuth"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"
import { translate } from "@/i18n"
import { supabase } from "@/services/supabase"
import type { UserConnection } from "@/services/supabase/userConnections"
import { getProfile, type Profile } from "@/services/supabase/profiles"
import { createConnectionInNeo4j } from "@/services/api/neo4j"

// All relationship types from neo4j_edge_types.cypher
const RELATIONSHIP_TYPES = [
  // Family
  {
    value: "PARENT_OF",
    label: "relationshipTypes:PARENT_OF",
    category: "family",
    icon: "human-male-female-child",
  },
  {
    value: "CHILD_OF",
    label: "relationshipTypes:CHILD_OF",
    category: "family",
    icon: "human-male-female-child",
  },
  {
    value: "SIBLING_OF",
    label: "relationshipTypes:SIBLING_OF",
    category: "family",
    icon: "human-male-male",
  },
  {
    value: "SPOUSE_OF",
    label: "relationshipTypes:SPOUSE_OF",
    category: "family",
    icon: "heart",
    requiresSubtype: true,
    requiresSince: true,
    hasAnniversary: true,
  },
  {
    value: "GRANDPARENT_OF",
    label: "relationshipTypes:GRANDPARENT_OF",
    category: "family",
    icon: "human-cane",
  },
  {
    value: "GRANDCHILD_OF",
    label: "relationshipTypes:GRANDCHILD_OF",
    category: "family",
    icon: "baby-face",
  },
  {
    value: "AUNT_OF",
    label: "relationshipTypes:AUNT_OF",
    category: "family",
    icon: "human-female",
  },
  {
    value: "UNCLE_OF",
    label: "relationshipTypes:UNCLE_OF",
    category: "family",
    icon: "human-male",
  },
  {
    value: "NIECE_OF",
    label: "relationshipTypes:NIECE_OF",
    category: "family",
    icon: "human-female-girl",
  },
  {
    value: "NEPHEW_OF",
    label: "relationshipTypes:NEPHEW_OF",
    category: "family",
    icon: "human-male-boy",
  },
  {
    value: "COUSIN_OF",
    label: "relationshipTypes:COUSIN_OF",
    category: "family",
    icon: "account-multiple",
  },

  // In-laws
  {
    value: "PARENT_IN_LAW_OF",
    label: "relationshipTypes:PARENT_IN_LAW_OF",
    category: "in-law",
    icon: "human-male-female",
  },
  {
    value: "CHILD_IN_LAW_OF",
    label: "relationshipTypes:CHILD_IN_LAW_OF",
    category: "in-law",
    icon: "human-male-female-child",
  },
  {
    value: "SIBLING_IN_LAW_OF",
    label: "relationshipTypes:SIBLING_IN_LAW_OF",
    category: "in-law",
    icon: "human-male-male",
  },

  // Social
  {
    value: "FRIEND_OF",
    label: "relationshipTypes:FRIEND_OF",
    category: "social",
    icon: "account-heart",
  },
  {
    value: "COLLEAGUE_OF",
    label: "relationshipTypes:COLLEAGUE_OF",
    category: "social",
    icon: "briefcase-account",
  },
  {
    value: "NEIGHBOR_OF",
    label: "relationshipTypes:NEIGHBOR_OF",
    category: "social",
    icon: "home-account",
  },
  {
    value: "CLASSMATE_OF",
    label: "relationshipTypes:CLASSMATE_OF",
    category: "social",
    icon: "school",
  },
  { value: "KNOWS", label: "relationshipTypes:KNOWS", category: "social", icon: "account" },
] as const

const SPOUSE_SUBTYPES = [
  { value: "married", label: "relationshipTypes:subtypes.married" },
  { value: "partner", label: "relationshipTypes:subtypes.partner" },
  { value: "engaged", label: "relationshipTypes:subtypes.engaged" },
] as const

const PARENT_CHILD_SUBTYPES = [
  { value: "biological", label: "relationshipTypes:subtypes.biological" },
  { value: "adoptive", label: "relationshipTypes:subtypes.adoptive" },
  { value: "step", label: "relationshipTypes:subtypes.step" },
] as const

export default function RelationshipUpdateScreen() {
  const router = useRouter()
  const { themed, theme } = useAppTheme()
  const { user } = useAuth()
  const { id } = useLocalSearchParams<{ id: string }>()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [connectionProfile, setConnectionProfile] = useState<Profile | null>(null)
  const [selectedType, setSelectedType] = useState<string>("")
  const [subtype, setSubtype] = useState<string>("")
  const [since, setSince] = useState<Date | null>(null)
  const [anniversary, setAnniversary] = useState<Date | null>(null)
  const [showSincePicker, setShowSincePicker] = useState(false)
  const [showAnniversaryPicker, setShowAnniversaryPicker] = useState(false)

  useEffect(() => {
    loadConnection()
  }, [])

  async function loadConnection() {
    if (!user || !id) return

    try {
      setLoading(true)

      // Get connection by connection ID
      // We need to query by connection id, not user_id + connected_user_id
      const { data: connection, error: connectionError } = (await supabase
        .from("user_connections")
        .select("*")
        .eq("id", id)
        .single()) as { data: UserConnection | null; error: any }

      if (connectionError) {
        console.error("Error loading connection:", connectionError)
        Alert.alert("Error", "Failed to load connection")
        return
      }

      // Get connected user's profile
      if (connection) {
        const connectedUserId = connection.connected_user_id
        const { data: profile } = await getProfile(connectedUserId)
        setConnectionProfile(profile)

        // Load existing relationship data if any (check connection_type, not relationship_type_id)
        if (connection.connection_type && connection.connection_type !== "pending") {
          setSelectedType(connection.connection_type)

          // Load from relationship_metadata JSONB field
          if (connection.relationship_metadata) {
            const metadata = connection.relationship_metadata

            // Load subtype (e.g., "married", "biological")
            if (metadata.subtype) {
              setSubtype(metadata.subtype)
            }

            // Load since date
            if (metadata.since) {
              setSince(new Date(metadata.since))
            }

            // Load anniversary (for spouse relationships)
            if (metadata.anniversary) {
              setAnniversary(new Date(metadata.anniversary))
            }
          }
        }
      }
    } catch (error) {
      console.error("Error loading connection:", error)
      Alert.alert("Error", "Failed to load connection")
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    if (!selectedType) {
      Alert.alert("Error", translate("relationshipTypes:labels.selectRelationship"))
      return
    }

    if (!user || !connectionProfile) {
      Alert.alert("Error", "Missing required data")
      return
    }

    const selectedRelType = RELATIONSHIP_TYPES.find((t) => t.value === selectedType)

    // Validate required fields
    if (selectedRelType?.requiresSubtype && !subtype) {
      Alert.alert("Error", translate("relationshipTypes:labels.required"))
      return
    }

    try {
      setSaving(true)

      // Prepare metadata
      const metadata: Record<string, any> = {}
      if (subtype) metadata.subtype = subtype
      if (anniversary) metadata.anniversary = anniversary.toISOString().split("T")[0]

      // Call Neo4j service to create connection
      const response = await createConnectionInNeo4j({
        user_id_1: user.id,
        user_id_2: connectionProfile.id,
        relationship_type: selectedType,
        relationship_metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
        relationship_since: since ? since.toISOString().split("T")[0] : undefined,
      })

      if (!response.success) {
        console.error("Error creating connection:", response.error)
        Alert.alert("Error", response.error || "Failed to create connection")
        return
      }

      Alert.alert("Success", "Relationship defined successfully!")
      router.back()
    } catch (error) {
      console.error("Error saving relationship:", error)
      Alert.alert("Error", "Failed to save relationship")
    } finally {
      setSaving(false)
    }
  }

  const selectedRelType = RELATIONSHIP_TYPES.find((t) => t.value === selectedType)
  const needsSubtype =
    selectedRelType?.requiresSubtype || selectedType === "PARENT_OF" || selectedType === "CHILD_OF"

  const subtypeOptions = selectedType === "SPOUSE_OF" ? SPOUSE_SUBTYPES : PARENT_CHILD_SUBTYPES

  if (loading) {
    return (
      <Screen preset="fixed" contentContainerStyle={themed($container)}>
        <View style={themed($loadingContainer)}>
          <ActivityIndicator size="large" color={theme.colors.tint} />
        </View>
      </Screen>
    )
  }

  if (!connectionProfile) {
    return (
      <Screen preset="fixed" contentContainerStyle={themed($container)}>
        <View style={themed($loadingContainer)}>
          <Text text="Connection not found" />
        </View>
      </Screen>
    )
  }

  return (
    <Screen preset="scroll" contentContainerStyle={themed($container)}>
      {/* Profile Section */}
      <View style={themed($profileSection)}>
        {connectionProfile.avatar_url ? (
          <Image
            source={{ uri: connectionProfile.avatar_url }}
            style={themed($profilePhoto)}
            resizeMode="cover"
          />
        ) : (
          <View style={themed($profilePhotoPlaceholder)}>
            <MaterialCommunityIcons
              name="account"
              size={60}
              color={theme.colors.palette.neutral400}
            />
          </View>
        )}
        <Text text={connectionProfile.name} preset="heading" style={themed($profileName)} />
        <Text text={`@${connectionProfile.username}`} style={themed($profileUsername)} />
      </View>

      {/* Header */}
      <View style={themed($header)}>
        <Text preset="subheading" text="Define Relationship" style={themed($title)} />
        <Text
          preset="default"
          text="Help Alfred understand your relationship with this person for more personalized interactions."
          style={themed($subtitle)}
        />
      </View>

      {/* Relationship Type Selection */}
      <View style={themed($section)}>
        <Text
          preset="formLabel"
          text={translate("relationshipTypes:labels.relationshipType")}
          style={themed($sectionTitle)}
        />

        {selectedType ? (
          // Show only selected type with option to change
          <>
            <ListItem
              text={translate(RELATIONSHIP_TYPES.find((t) => t.value === selectedType)!.label)}
              topSeparator
              bottomSeparator
              onPress={() => {
                setSelectedType("")
                setSubtype("") // Clear subtype when changing relationship type
                setSince(null) // Clear since date
                setAnniversary(null) // Clear anniversary
              }}
              LeftComponent={
                <View style={themed($iconContainer)}>
                  <MaterialCommunityIcons
                    name={RELATIONSHIP_TYPES.find((t) => t.value === selectedType)!.icon as any}
                    size={24}
                    color={theme.colors.tint}
                  />
                </View>
              }
              RightComponent={
                <View style={themed($changeButton)}>
                  <Text text="Change" style={themed($changeButtonText)} />
                  <MaterialCommunityIcons name="pencil" size={20} color={theme.colors.tint} />
                </View>
              }
            />
          </>
        ) : (
          // Show all options grouped by category
          <>
            {/* Family Relationships */}
            <Text preset="formHelper" text="Family" style={themed($categoryLabel)} />
            {RELATIONSHIP_TYPES.filter((t) => t.category === "family").map((type, index) => (
              <ListItem
                key={type.value}
                text={translate(type.label)}
                topSeparator={index === 0}
                bottomSeparator
                onPress={() => {
                  setSelectedType(type.value)
                  setSubtype("") // Clear subtype when selecting new type
                }}
                LeftComponent={
                  <View style={themed($iconContainer)}>
                    <MaterialCommunityIcons
                      name={type.icon as any}
                      size={24}
                      color={theme.colors.textDim}
                    />
                  </View>
                }
              />
            ))}

            {/* In-Law Relationships */}
            <Text preset="formHelper" text="In-Laws" style={themed($categoryLabel)} />
            {RELATIONSHIP_TYPES.filter((t) => t.category === "in-law").map((type, index) => (
              <ListItem
                key={type.value}
                text={translate(type.label)}
                topSeparator={index === 0}
                bottomSeparator
                onPress={() => {
                  setSelectedType(type.value)
                  setSubtype("") // Clear subtype when selecting new type
                }}
                LeftComponent={
                  <View style={themed($iconContainer)}>
                    <MaterialCommunityIcons
                      name={type.icon as any}
                      size={24}
                      color={theme.colors.textDim}
                    />
                  </View>
                }
              />
            ))}

            {/* Social Relationships */}
            <Text preset="formHelper" text="Social" style={themed($categoryLabel)} />
            {RELATIONSHIP_TYPES.filter((t) => t.category === "social").map((type, index) => (
              <ListItem
                key={type.value}
                text={translate(type.label)}
                topSeparator={index === 0}
                bottomSeparator
                onPress={() => {
                  setSelectedType(type.value)
                  setSubtype("") // Clear subtype when selecting new type
                }}
                LeftComponent={
                  <View style={themed($iconContainer)}>
                    <MaterialCommunityIcons
                      name={type.icon as any}
                      size={24}
                      color={theme.colors.textDim}
                    />
                  </View>
                }
              />
            ))}
          </>
        )}
      </View>

      {/* Subtype Selection (for SPOUSE_OF, PARENT_OF, CHILD_OF) */}
      {needsSubtype && (
        <View style={themed($section)}>
          <Text
            preset="formLabel"
            text={translate("relationshipTypes:labels.relationshipSubtype")}
            style={themed($sectionTitle)}
          />

          {subtype && subtypeOptions.find((o) => o.value === subtype) ? (
            // Show only selected subtype with option to change
            <ListItem
              text={translate(subtypeOptions.find((o) => o.value === subtype)!.label)}
              topSeparator
              bottomSeparator
              onPress={() => setSubtype("")}
              RightComponent={
                <View style={themed($changeButton)}>
                  <Text text="Change" style={themed($changeButtonText)} />
                  <MaterialCommunityIcons name="pencil" size={20} color={theme.colors.tint} />
                </View>
              }
            />
          ) : (
            // Show all subtype options
            subtypeOptions.map((option, index) => (
              <ListItem
                key={option.value}
                text={translate(option.label)}
                topSeparator={index === 0}
                bottomSeparator
                onPress={() => setSubtype(option.value)}
              />
            ))
          )}
        </View>
      )}

      {/* Since Date (for relationships that need it) */}
      {selectedRelType?.requiresSince && (
        <View style={themed($section)}>
          <ListItem
            text={translate("relationshipTypes:labels.relationshipSince")}
            topSeparator
            bottomSeparator
            onPress={() => setShowSincePicker(true)}
            LeftComponent={
              <MaterialCommunityIcons name="calendar" size={24} color={theme.colors.textDim} />
            }
            RightComponent={
              <View style={themed($dateValue)}>
                <Text
                  text={since ? since.toLocaleDateString() : "Select date"}
                  style={themed($dateText)}
                />
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={20}
                  color={theme.colors.textDim}
                />
              </View>
            }
          />
        </View>
      )}

      {/* Anniversary (for SPOUSE_OF only) */}
      {selectedRelType?.hasAnniversary && (
        <View style={themed($section)}>
          <ListItem
            text="Anniversary"
            topSeparator
            bottomSeparator
            onPress={() => setShowAnniversaryPicker(true)}
            LeftComponent={
              <MaterialCommunityIcons
                name="calendar-heart"
                size={24}
                color={theme.colors.textDim}
              />
            }
            RightComponent={
              <View style={themed($dateValue)}>
                <Text
                  text={anniversary ? anniversary.toLocaleDateString() : "Select date (optional)"}
                  style={themed($dateText)}
                />
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={20}
                  color={theme.colors.textDim}
                />
              </View>
            }
          />
        </View>
      )}

      {/* Info Box */}
      <View style={themed($infoBox)}>
        <MaterialCommunityIcons name="information" size={20} color={theme.colors.tint} />
        <Text
          preset="formHelper"
          text="This information helps Alfred provide more relevant and personalized responses when discussing this person."
          style={themed($infoText)}
        />
      </View>

      {/* Actions */}
      <View style={themed($actions)}>
        <Button
          text="Cancel"
          preset="default"
          onPress={() => router.back()}
          style={themed($button)}
          disabled={saving}
        />
        <Button
          text={saving ? "" : "Save"}
          preset="filled"
          onPress={handleSave}
          disabled={saving || !selectedType}
          style={themed($button)}
        >
          {saving && <ActivityIndicator size="small" color="white" />}
        </Button>
      </View>

      {/* Date Pickers */}
      <DatePickerModal
        visible={showSincePicker}
        value={since || new Date()}
        onClose={() => setShowSincePicker(false)}
        onSave={(date) => {
          setSince(date)
          setShowSincePicker(false)
        }}
        title="Relationship Since"
        maximumDate={new Date()}
      />

      <DatePickerModal
        visible={showAnniversaryPicker}
        value={anniversary || new Date()}
        onClose={() => setShowAnniversaryPicker(false)}
        onSave={(date) => {
          setAnniversary(date)
          setShowAnniversaryPicker(false)
        }}
        title="Anniversary"
        maximumDate={new Date()}
      />
    </Screen>
  )
}

const $container: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.lg,
})

const $loadingContainer: ThemedStyle<ViewStyle> = () => ({
  flex: 1,
  justifyContent: "center",
  alignItems: "center",
})

const $profileSection: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  alignItems: "center",
  marginBottom: spacing.xxl,
  paddingTop: spacing.lg,
})

const $profilePhoto: ThemedStyle<ImageStyle> = () => ({
  width: 100,
  height: 100,
  borderRadius: 50,
})

const $profilePhotoPlaceholder: ThemedStyle<ViewStyle> = ({ colors }) => ({
  width: 100,
  height: 100,
  borderRadius: 50,
  backgroundColor: colors.palette.neutral200,
  justifyContent: "center",
  alignItems: "center",
})

const $profileName: ThemedStyle<TextStyle> = ({ spacing }) => ({
  marginTop: spacing.sm,
  textAlign: "center",
})

const $profileUsername: ThemedStyle<TextStyle> = ({ colors, spacing }) => ({
  color: colors.textDim,
  marginTop: spacing.xxs,
  textAlign: "center",
})

const $header: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginBottom: spacing.lg,
})

const $title: ThemedStyle<TextStyle> = ({ spacing }) => ({
  marginBottom: spacing.xs,
})

const $subtitle: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
})

const $section: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginBottom: spacing.lg,
})

const $sectionTitle: ThemedStyle<TextStyle> = ({ spacing }) => ({
  marginBottom: spacing.sm,
  paddingHorizontal: spacing.xs,
})

const $categoryLabel: ThemedStyle<TextStyle> = ({ spacing, colors }) => ({
  marginTop: spacing.md,
  marginBottom: spacing.xs,
  paddingHorizontal: spacing.xs,
  color: colors.textDim,
  fontWeight: "600",
})

const $dateValue: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.xs,
})

const $dateText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
})

const $infoBox: ThemedStyle<ViewStyle> = ({ spacing, colors }) => ({
  flexDirection: "row",
  padding: spacing.md,
  backgroundColor: colors.palette.neutral200,
  borderRadius: 8,
  marginBottom: spacing.lg,
  gap: spacing.sm,
})

const $infoText: ThemedStyle<TextStyle> = ({ colors }) => ({
  flex: 1,
  color: colors.textDim,
})

const $actions: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  gap: spacing.sm,
  marginBottom: spacing.xl,
})

const $button: ThemedStyle<ViewStyle> = () => ({
  flex: 1,
})

const $iconContainer: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  width: 40,
  alignItems: "center",
  alignSelf: "center",
  justifyContent: "center",
  marginRight: spacing.xs,
})

const $changeButton: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.xxs,
  alignSelf: "center",
})

const $changeButtonText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.tint,
  fontSize: 14,
})
