import { useState } from "react"
import { Modal, Platform, View, ViewStyle } from "react-native"
import DateTimePicker from "@react-native-community/datetimepicker"

import { Button } from "./Button"
import { Text } from "./Text"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

export interface DatePickerModalProps {
  visible: boolean
  value: Date
  onClose: () => void
  onSave: (date: Date) => void
  title?: string
  maximumDate?: Date
  minimumDate?: Date
}

export function DatePickerModal({
  visible,
  value,
  onClose,
  onSave,
  title = "Select Date",
  maximumDate,
  minimumDate,
}: DatePickerModalProps) {
  const { themed, theme } = useAppTheme()
  const [selectedDate, setSelectedDate] = useState(value)

  const handleSave = () => {
    onSave(selectedDate)
    onClose()
  }

  const handleDateChange = (_event: any, date?: Date) => {
    if (Platform.OS === "android") {
      onClose()
      if (date) {
        onSave(date)
      }
    } else if (date) {
      setSelectedDate(date)
    }
  }

  if (Platform.OS === "android") {
    return visible ? (
      <DateTimePicker
        value={selectedDate}
        mode="date"
        display="default"
        onChange={handleDateChange}
        maximumDate={maximumDate}
        minimumDate={minimumDate}
      />
    ) : null
  }

  // iOS Modal
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={themed($modalOverlay)}>
        <View style={themed($modalContent)}>
          <View style={themed($modalHeader)}>
            <Text preset="subheading" text={title} />
          </View>

          <DateTimePicker
            value={selectedDate}
            mode="date"
            display="spinner"
            onChange={handleDateChange}
            maximumDate={maximumDate}
            minimumDate={minimumDate}
            textColor={theme.colors.text}
          />

          <View style={themed($modalActions)}>
            <Button text="Cancel" preset="default" onPress={onClose} style={themed($button)} />
            <Button text="Save" preset="filled" onPress={handleSave} style={themed($button)} />
          </View>
        </View>
      </View>
    </Modal>
  )
}

const $modalOverlay: ThemedStyle<ViewStyle> = () => ({
  flex: 1,
  justifyContent: "flex-end",
  backgroundColor: "rgba(0, 0, 0, 0.5)",
})

const $modalContent: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  backgroundColor: colors.background,
  borderTopLeftRadius: 20,
  borderTopRightRadius: 20,
  paddingTop: spacing.lg,
  paddingBottom: spacing.xl,
})

const $modalHeader: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingHorizontal: spacing.lg,
  marginBottom: spacing.md,
  alignItems: "center",
})

const $modalActions: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  paddingHorizontal: spacing.lg,
  gap: spacing.sm,
  marginTop: spacing.md,
})

const $button: ThemedStyle<ViewStyle> = () => ({
  flex: 1,
})
