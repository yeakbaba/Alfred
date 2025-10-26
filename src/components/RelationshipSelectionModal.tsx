import { useEffect, useState, useMemo } from "react"
import {
  View,
  ViewStyle,
  TextStyle,
  Pressable,
  FlatList,
  ActivityIndicator,
  ScrollView,
  Alert,
  TextInput,
  Modal,
} from "react-native"
import { MaterialCommunityIcons } from "@expo/vector-icons"

import { Button } from "@/components/Button"
import { Text } from "@/components/Text"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"
import { fetchFromTable } from "@/services/supabase"
import { translate } from "@/i18n"

interface RelationshipType {
  id: string
  neo4j_edge_label: string
  display_name: string
  has_type_property: boolean
  has_since_property: boolean
}

interface RelationshipSelectionModalProps {
  visible: boolean
  onSelect: (data: {
    relationshipTypeId: string
    neo4jEdgeLabel: string
    relationshipSubtype?: string
    relationshipSince?: string
  }) => void
  onCancel: () => void
  isLoading?: boolean
}

const RELATIONSHIP_SUBTYPES: Record<string, Array<{ value: string; label: string }>> = {
  PARENT_OF: [
    { value: "biological", label: "Biological" },
    { value: "adoptive", label: "Adoptive" },
    { value: "step", label: "Step" },
  ],
  CHILD_OF: [
    { value: "biological", label: "Biological" },
    { value: "adoptive", label: "Adoptive" },
    { value: "step", label: "Step" },
  ],
  SIBLING_OF: [
    { value: "full", label: "Full" },
    { value: "half", label: "Half" },
    { value: "step", label: "Step" },
  ],
  SPOUSE_OF: [
    { value: "married", label: "Married" },
    { value: "partner", label: "Partner" },
    { value: "engaged", label: "Engaged" },
  ],
}

export const RelationshipSelectionModal = ({
  visible,
  onSelect,
  onCancel,
  isLoading = false,
}: RelationshipSelectionModalProps) => {
  const { themed, theme } = useAppTheme()

  const [relationshipTypes, setRelationshipTypes] = useState<RelationshipType[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRelationType, setSelectedRelationType] = useState<RelationshipType | null>(null)
  const [selectedSubtype, setSelectedSubtype] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<string>("")

  useEffect(() => {
    if (!visible) return

    const loadRelationshipTypes = async () => {
      try {
        setLoading(true)
        const { data, error } = await fetchFromTable<RelationshipType>("relationship_types", "*")
        if (error) throw error
        if (data) setRelationshipTypes(data)
      } catch (error) {
        console.error("Error loading relationship types:", error)
        Alert.alert(translate("common:error"), "Failed to load relationship types")
      } finally {
        setLoading(false)
      }
    }

    loadRelationshipTypes()
  }, [visible])

  const availableSubtypes = useMemo(() => {
    if (!selectedRelationType) return []
    return RELATIONSHIP_SUBTYPES[selectedRelationType.neo4j_edge_label] || []
  }, [selectedRelationType])

  const handleSelectRelationType = (relationType: RelationshipType) => {
    setSelectedRelationType(relationType)
    setSelectedSubtype(null)
    setSelectedDate("")
  }

  const handleConfirm = () => {
    if (!selectedRelationType) {
      Alert.alert(translate("common:error"), "Please select a relationship type")
      return
    }

    // Date validation
    if (selectedRelationType.has_since_property && selectedDate) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/
      if (!dateRegex.test(selectedDate)) {
        Alert.alert(translate("common:error"), "Date format must be YYYY-MM-DD")
        return
      }

      // Check if date is valid
      const date = new Date(selectedDate)
      if (isNaN(date.getTime())) {
        Alert.alert(translate("common:error"), "Please enter a valid date")
        return
      }
    }

    onSelect({
      relationshipTypeId: selectedRelationType.id,
      neo4jEdgeLabel: selectedRelationType.neo4j_edge_label,
      relationshipSubtype: selectedSubtype || undefined,
      relationshipSince: selectedDate || undefined,
    })
  }

  const handleCancel = () => {
    setSelectedRelationType(null)
    setSelectedSubtype(null)
    setSelectedDate("")
    onCancel()
  }

  const renderRelationshipTypeItem = ({ item }: { item: RelationshipType }) => {
    const isSelected = selectedRelationType?.id === item.id

    return (
      <Pressable
        key={item.id}
        style={({ pressed }) => [
          themed($relationTypeItem),
          isSelected && { backgroundColor: theme.colors.tint + "20" },
          pressed && { opacity: 0.7 },
        ]}
        onPress={() => handleSelectRelationType(item)}
      >
        <View style={themed($relationTypeContent)}>
          <Text
            text={item.display_name}
            style={[themed($relationTypeName), isSelected && { fontWeight: "600" }]}
          />
        </View>
        {isSelected && (
          <MaterialCommunityIcons name="check-circle" size={24} color={theme.colors.tint} />
        )}
      </Pressable>
    )
  }

  const renderSubtypeItem = ({ item }: { item: { value: string; label: string } }) => {
    const isSelected = selectedSubtype === item.value

    return (
      <Pressable
        key={item.label}
        style={({ pressed }) => [
          themed($subtypeItem),
          isSelected && { backgroundColor: theme.colors.tint + "20" },
          pressed && { opacity: 0.7 },
        ]}
        onPress={() => setSelectedSubtype(item.value)}
      >
        <Text
          text={item.label}
          style={[themed($subtypeText), isSelected && { fontWeight: "600" }]}
        />
        {isSelected && <MaterialCommunityIcons name="check" size={20} color={theme.colors.tint} />}
      </Pressable>
    )
  }

  const getListData = () => {
    if (selectedRelationType) {
      return [selectedRelationType]
    }
    return relationshipTypes
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleCancel}>
      <View style={themed($modalOverlay)}>
        <View style={themed($modalContent)}>
          <View style={themed($header)}>
            <Text preset="heading" text="Select Relationship" style={themed($headerTitle)} />
          </View>

          {loading ? (
            <View style={themed($loadingContainer)}>
              <ActivityIndicator size="large" color={theme.colors.tint} />
            </View>
          ) : (
            <FlatList
              data={getListData()}
              renderItem={({ item }) => (
                <View>
                  {selectedRelationType?.id === item.id ? (
                    // Detail view
                    <>
                      <View style={themed($selectedItemBox)}>
                        <View style={themed($selectedItemHeader)}>
                          <Text text={item.display_name} style={themed($selectedItemTitle)} />
                          <Pressable
                            onPress={() => {
                              setSelectedRelationType(null)
                              setSelectedSubtype(null)
                              setSelectedDate("")
                            }}
                          >
                            <MaterialCommunityIcons
                              name="close"
                              size={20}
                              color={theme.colors.text}
                            />
                          </Pressable>
                        </View>
                      </View>

                      {availableSubtypes.length > 0 && (
                        <View style={themed($subtypesSection)}>
                          <Text preset="formLabel" text="Type" style={themed($sectionTitle)} />
                          <View style={themed($subtypesGrid)}>
                            {availableSubtypes.map((subitem) =>
                              renderSubtypeItem({ item: subitem }),
                            )}
                          </View>
                        </View>
                      )}

                      {item.has_since_property && (
                        <View style={themed($dateSection)}>
                          <Text
                            preset="formLabel"
                            text="Since (Optional)"
                            style={themed($sectionTitle)}
                          />
                          <TextInput
                            placeholder="YYYY-MM-DD"
                            value={selectedDate}
                            onChangeText={setSelectedDate}
                            keyboardType="numeric"
                            style={themed($dateInput)}
                            placeholderTextColor={theme.colors.textDim}
                          />
                        </View>
                      )}
                    </>
                  ) : (
                    // List item
                    renderRelationshipTypeItem({ item })
                  )}
                </View>
              )}
              keyExtractor={(item) => item.id}
              scrollEnabled={true}
              contentContainerStyle={themed($listContent)}
            />
          )}

          <View style={themed($footer)}>
            <Button
              tx="common:cancel"
              preset="default"
              style={themed($cancelButton)}
              onPress={handleCancel}
              disabled={isLoading}
            />
            <Button
              tx="common:done"
              preset="filled"
              style={themed($confirmButton)}
              onPress={handleConfirm}
              disabled={!selectedRelationType || isLoading}
            />
          </View>
        </View>
      </View>
    </Modal>
  )
}

const $detailScrollView: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flex: 1,
  paddingHorizontal: spacing.md,
})

const $detailScrollContent: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingVertical: spacing.md,
  gap: spacing.md,
})

const $selectedItemBox: ThemedStyle<ViewStyle> = ({ spacing, colors }) => ({
  padding: spacing.md,
  borderWidth: 2,
  borderColor: colors.tint,
  borderRadius: 8,
  backgroundColor: colors.tint + "10",
})

const $selectedItemHeader: ThemedStyle<ViewStyle> = () => ({
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
})

const $selectedItemTitle: ThemedStyle<TextStyle> = () => ({
  fontSize: 16,
  fontWeight: "600",
  flex: 1,
})

const $subtypesSection: ThemedStyle<ViewStyle> = ({ spacing, colors }) => ({
  backgroundColor: colors.palette.neutral200,
  borderRadius: 8,
  padding: spacing.md,
  gap: spacing.sm,
})

const $subtypesGrid: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  flexWrap: "wrap",
  gap: spacing.sm,
})

const $dateSection: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.sm,
})

const $headerTitle: ThemedStyle<TextStyle> = ({ spacing }) => ({
  marginBottom: spacing.xs,
  fontSize: 18, // ← Küçült
  textAlign: "center", // ← Center yap
})

const $detailContainer: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flex: 1,
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.md,
  gap: spacing.md,
})

const $listContent: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.md,
  gap: spacing.sm,
})

const $modalContent: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  backgroundColor: colors.background,
  borderRadius: 16,
  maxHeight: "75%",
  width: "90%",
  maxWidth: 400,
  flexDirection: "column",
  paddingTop: spacing.md,
})

const $header: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingHorizontal: spacing.md,
  marginBottom: spacing.md,
})

const $footer: ThemedStyle<ViewStyle> = ({ spacing, colors }) => ({
  flexDirection: "row",
  gap: spacing.md,
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.md,
  borderTopWidth: 1,
  borderTopColor: colors.border,
})

const $content: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  maxHeight: 350,
  overflow: "scroll",
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.md,
})

const $typesContainer: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.sm,
})

const $modalOverlay: ThemedStyle<ViewStyle> = ({ colors }) => ({
  flex: 1,
  backgroundColor: "rgba(0, 0, 0, 0.5)",
  justifyContent: "center",
  alignItems: "center",
})

const $scrollContent: ThemedStyle<ViewStyle> = () => ({
  flex: 1,
})

const $scrollContentContainer: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingHorizontal: spacing.md,
  paddingTop: spacing.md,
  paddingBottom: spacing.lg,
  gap: spacing.md,
})

const $loadingContainer: ThemedStyle<ViewStyle> = () => ({
  minHeight: 100,
  justifyContent: "center",
  alignItems: "center",
})

const $sectionTitle: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.text,
})

const $relationTypeItem: ThemedStyle<ViewStyle> = ({ spacing, colors }) => ({
  padding: spacing.md,
  marginBottom: spacing.sm,
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: 8,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  minHeight: 50,
})

const $relationTypeContent: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flex: 1,
  marginRight: spacing.md,
})

const $relationTypeName: ThemedStyle<TextStyle> = ({ colors }) => ({
  fontSize: 14,
  fontWeight: "500",
  color: colors.text,
})

const $columnWrapper: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.sm,
})

const $subtypeItem: ThemedStyle<ViewStyle> = ({ spacing, colors }) => ({
  flex: 1,
  minWidth: "45%",
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.sm,
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: 6,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
})

const $subtypeText: ThemedStyle<TextStyle> = ({ colors }) => ({
  fontSize: 13,
  color: colors.text,
})

const $dateInput: ThemedStyle<TextStyle> = ({ spacing, colors, typography }) => ({
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: 6,
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.sm,
  color: colors.text,
  fontFamily: typography.primary.normal,
  fontSize: 14,
})

const $cancelButton: ThemedStyle<ViewStyle> = () => ({
  flex: 1,
})

const $confirmButton: ThemedStyle<ViewStyle> = () => ({
  flex: 1,
})
