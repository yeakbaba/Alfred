import { useState, useEffect } from "react"
import {
  Alert,
  View,
  ViewStyle,
  TextStyle,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  ActionSheetIOS,
  Image,
  ImageStyle,
  Linking,
} from "react-native"
import { useRouter } from "expo-router"
import { MaterialCommunityIcons } from "@expo/vector-icons"

import { Button } from "@/components/Button"
import { DatePickerModal } from "@/components/DatePickerModal"
import { ListItem } from "@/components/ListItem"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { useAuth } from "@/hooks/useAuth"
import { useSupabase } from "@/hooks/useSupabase"
import { translate } from "@/i18n"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"
import {
  pickProfilePhoto,
  takePhoto,
  optimizeProfilePhoto,
  requestCameraPermissions,
  requestImagePermissions,
} from "@/utils/imageOptimization"
import { uploadProfilePhoto } from "@/services/supabase/storage"
import {
  getProfile,
  updateProfile,
  isUsernameAvailable,
  type Profile,
} from "@/services/supabase/profiles"

export default function SettingsScreen() {
  const router = useRouter()
  const { themed, theme } = useAppTheme()
  const { user } = useAuth()
  const { signOut } = useSupabase()

  // State
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [showDatePicker, setShowDatePicker] = useState(false)

  // Load profile
  useEffect(() => {
    loadProfile()
  }, [])

  async function loadProfile() {
    try {
      setLoading(true)
      if (!user) {
        Alert.alert("Error", "User not found")
        return
      }

      const { data, error } = await getProfile(user.id)
      if (error) {
        console.error("Error loading profile:", error)
        Alert.alert("Error", "Failed to load profile")
        return
      }

      if (data) {
        setProfile(data)
      }
    } catch (error) {
      console.error("Error loading profile:", error)
      Alert.alert("Error", "Failed to load profile")
    } finally {
      setLoading(false)
    }
  }

  async function handleChangeProfilePhoto() {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Cancel", "Take Photo", "Choose from Library"],
          cancelButtonIndex: 0,
        },
        async (buttonIndex) => {
          if (buttonIndex === 1) {
            await handleTakePhoto()
          } else if (buttonIndex === 2) {
            await handleChooseFromLibrary()
          }
        },
      )
    } else {
      Alert.alert("Select Photo", "Choose an option", [
        { text: "Cancel", style: "cancel" },
        { text: "Take Photo", onPress: handleTakePhoto },
        { text: "Choose from Library", onPress: handleChooseFromLibrary },
      ])
    }
  }

  async function handleTakePhoto() {
    try {
      const hasPermission = await requestCameraPermissions()
      if (!hasPermission) {
        Alert.alert("Permission Required", "Camera permission is required to take photos")
        return
      }

      const photo = await takePhoto()
      if (!photo) return

      await uploadPhoto(photo)
    } catch (error) {
      console.error("Error taking photo:", error)
      Alert.alert("Error", "Failed to take photo")
    }
  }

  async function handleChooseFromLibrary() {
    try {
      const hasPermission = await requestImagePermissions()
      if (!hasPermission) {
        Alert.alert("Permission Required", "Photo library permission is required")
        return
      }

      const photo = await pickProfilePhoto()
      if (!photo) return

      await uploadPhoto(photo)
    } catch (error) {
      console.error("Error picking photo:", error)
      Alert.alert("Error", "Failed to pick photo")
    }
  }

  async function uploadPhoto(photo: any) {
    try {
      setUploading(true)

      const optimized = await optimizeProfilePhoto(photo)

      if (!user) {
        Alert.alert("Error", "User not found")
        return
      }

      const { url, error } = await uploadProfilePhoto(optimized.uri, user.id)

      if (error) {
        console.error("Upload error:", error)
        Alert.alert("Error", "Failed to upload photo")
        return
      }

      const { data: updatedProfile, error: updateError } = await updateProfile(user.id, {
        avatar_url: url,
      })

      if (updateError) {
        console.error("Update error:", updateError)
        Alert.alert("Error", "Failed to update profile")
        return
      }

      if (updatedProfile) {
        setProfile(updatedProfile)
      }
    } catch (error) {
      console.error("Error uploading photo:", error)
      Alert.alert("Error", "Failed to upload photo")
    } finally {
      setUploading(false)
    }
  }

  function handleEditName() {
    Alert.prompt(
      "Edit Name",
      "Enter your full name",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Save",
          onPress: async (text?: string) => {
            if (!text || !text.trim()) {
              Alert.alert("Invalid Name", "Please enter your name")
              return
            }
            await handleUpdateProfile({ name: text.trim() })
          },
        },
      ],
      "plain-text",
      profile?.name || "",
    )
  }

  async function handleEditUsername() {
    if (Platform.OS === "ios") {
      Alert.prompt(
        "Edit Username",
        "Username must start with a letter and contain only lowercase letters, numbers, and underscores (3-30 characters)",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Save",
            onPress: async (text?: string) => {
              if (!text) return

              const username = text.toLowerCase().trim()

              // Check availability
              const { available, reason } = await isUsernameAvailable(username)
              if (!available) {
                let message = "This username is already taken"
                if (reason === "invalid") {
                  message =
                    "Username must start with a letter and contain only lowercase letters, numbers, and underscores (3-30 characters)"
                } else if (reason === "reserved") {
                  message = "This username is reserved"
                }
                Alert.alert("Invalid Username", message)
                return
              }

              await handleUpdateProfile({ username })
            },
          },
        ],
        "plain-text",
        profile?.username || "",
      )
    } else {
      // Android doesn't support Alert.prompt, would need a modal
      Alert.alert("Edit Username", "This feature requires a modal on Android")
    }
  }

  function handleEditDateOfBirth() {
    setShowDatePicker(true)
  }

  async function handleSaveDateOfBirth(date: Date) {
    await handleUpdateProfile({ date_of_birth: date.toISOString() })
  }

  async function handleUpdateProfile(updates: any) {
    try {
      if (!user) {
        Alert.alert("Error", "User not found")
        return
      }

      const { data: updatedProfile, error } = await updateProfile(user.id, updates)

      if (error) {
        console.error("Update error:", error)
        Alert.alert("Error", error.message || "Failed to update profile")
        return
      }

      if (updatedProfile) {
        setProfile(updatedProfile)
        Alert.alert("Success", "Profile updated successfully")
      }
    } catch (error) {
      console.error("Error updating profile:", error)
      Alert.alert("Error", "Failed to update profile")
    }
  }

  const handleSignOut = async () => {
    Alert.alert(translate("settings:signOutConfirm"), translate("settings:signOutMessage"), [
      {
        text: translate("common:cancel"),
        style: "cancel",
      },
      {
        text: translate("settings:signOutButton"),
        style: "destructive",
        onPress: async () => {
          setIsSigningOut(true)
          try {
            await signOut()
            router.replace("/(auth)/login")
          } catch (error) {
            Alert.alert(translate("common:error"), "Failed to sign out")
            setIsSigningOut(false)
          }
        },
      },
    ])
  }

  if (loading) {
    return (
      <Screen preset="fixed" contentContainerStyle={themed($container)}>
        <View style={themed($loadingContainer)}>
          <ActivityIndicator size="large" color={theme.colors.tint} />
        </View>
      </Screen>
    )
  }

  return (
    <Screen preset="scroll" contentContainerStyle={themed($container)} safeAreaEdges={["top"]}>
      {/* Profile Section */}
      <View style={themed($profileSection)}>
        <TouchableOpacity
          style={themed($profilePhotoWrapper)}
          onPress={handleChangeProfilePhoto}
          disabled={uploading}
        >
          {profile?.avatar_url ? (
            <Image
              source={{ uri: profile.avatar_url }}
              style={themed($profilePhoto)}
              resizeMode="cover"
            />
          ) : (
            <View style={themed($profilePhotoPlaceholder)}>
              <MaterialCommunityIcons name="account" size={64} color={theme.colors.textDim} />
            </View>
          )}
          {uploading && (
            <View style={themed($uploadingOverlay)}>
              <ActivityIndicator size="small" color="white" />
            </View>
          )}
          <View style={themed($cameraIconContainer)}>
            <MaterialCommunityIcons name="camera" size={20} color="white" />
          </View>
        </TouchableOpacity>

        <Text preset="heading" text={profile?.name || "User"} style={themed($profileName)} />
        <Text
          preset="default"
          text={`@${profile?.username || "username"}`}
          style={themed($profileUsername)}
        />
      </View>

      {/* Profile Information */}
      <View style={themed($section)}>
        <Text preset="subheading" text="Profile Information" style={themed($sectionTitle)} />

        <ListItem
          text="Full Name"
          leftIcon="view"
          topSeparator
          onPress={handleEditName}
          style={themed($listItem)}
          RightComponent={
            <View style={themed($rightContent)}>
              <Text preset="default" text={profile?.name || "Not set"} style={themed($rightText)} />
              <MaterialCommunityIcons name="chevron-right" size={20} color={theme.colors.textDim} />
            </View>
          }
        />

        <ListItem
          text="Username"
          leftIcon="view"
          onPress={handleEditUsername}
          style={themed($listItem)}
          RightComponent={
            <View style={themed($rightContent)}>
              <Text
                preset="default"
                text={`@${profile?.username || "Not set"}`}
                style={themed($rightText)}
              />
              <MaterialCommunityIcons name="chevron-right" size={20} color={theme.colors.textDim} />
            </View>
          }
        />

        <ListItem
          text="Date of Birth"
          leftIcon="view"
          onPress={handleEditDateOfBirth}
          bottomSeparator
          style={themed($listItem)}
          RightComponent={
            <View style={themed($rightContent)}>
              <Text
                preset="default"
                text={
                  profile?.date_of_birth
                    ? new Date(profile.date_of_birth).toLocaleDateString()
                    : "Not set"
                }
                style={themed($rightText)}
              />
              <MaterialCommunityIcons name="chevron-right" size={20} color={theme.colors.textDim} />
            </View>
          }
        />
      </View>

      {/* App Settings */}
      <View style={themed($section)}>
        <Text preset="subheading" text="App Settings" style={themed($sectionTitle)} />

        <ListItem
          text="Notifications"
          leftIcon="bell"
          rightIcon="caretRight"
          topSeparator
          onPress={() => router.push("/settings/notifications")}
          style={themed($listItem)}
        />

        <ListItem
          text="Theme"
          leftIcon="settings"
          onPress={() => router.push("/settings/theme")}
          style={themed($listItem)}
          RightComponent={
            <View style={themed($rightContent)}>
              <Text preset="default" text="System" style={themed($rightText)} />
              <MaterialCommunityIcons name="chevron-right" size={20} color={theme.colors.textDim} />
            </View>
          }
        />

        <ListItem
          text="Language"
          leftIcon="settings"
          onPress={() => router.push("/settings/language")}
          bottomSeparator
          style={themed($listItem)}
          RightComponent={
            <View style={themed($rightContent)}>
              <Text preset="default" text="English" style={themed($rightText)} />
              <MaterialCommunityIcons name="chevron-right" size={20} color={theme.colors.textDim} />
            </View>
          }
        />
      </View>

      {/* Alfred Settings */}
      <View style={themed($section)}>
        <Text preset="subheading" text="Alfred Settings" style={themed($sectionTitle)} />

        <ListItem
          text="Chat Preferences"
          leftIcon="settings"
          rightIcon="caretRight"
          topSeparator
          onPress={() => Alert.alert("Chat Preferences", "Chat preferences coming soon")}
          style={themed($listItem)}
        />

        <ListItem
          text="Voice & Speech"
          leftIcon="settings"
          rightIcon="caretRight"
          onPress={() => Alert.alert("Voice & Speech", "Voice settings coming soon")}
          style={themed($listItem)}
        />

        <ListItem
          text="Data & Storage"
          leftIcon="settings"
          rightIcon="caretRight"
          onPress={() => Alert.alert("Data & Storage", "Storage settings coming soon")}
          bottomSeparator
          style={themed($listItem)}
        />
      </View>

      {/* Account Actions */}
      <View style={themed($section)}>
        <Button
          tx="settings:signOutButton"
          preset="reversed"
          style={themed($signOutButton)}
          onPress={handleSignOut}
          disabled={isSigningOut}
        />
      </View>

      {/* Legal */}
      <View style={themed($legalSection)}>
        <TouchableOpacity
          onPress={() => Linking.openURL("https://yourwebsite.com/terms")}
          style={themed($legalButton)}
        >
          <Text preset="default" text="Terms of Use" style={themed($legalText)} />
        </TouchableOpacity>

        <Text preset="default" text="•" style={themed($legalSeparator)} />

        <TouchableOpacity
          onPress={() => Linking.openURL("https://yourwebsite.com/privacy")}
          style={themed($legalButton)}
        >
          <Text preset="default" text="Privacy Policy" style={themed($legalText)} />
        </TouchableOpacity>
      </View>

      <Text preset="default" text="Version 1.0.0" style={themed($versionText)} />

      {/* Date Picker Modal */}
      <DatePickerModal
        visible={showDatePicker}
        value={profile?.date_of_birth ? new Date(profile.date_of_birth) : new Date()}
        onClose={() => setShowDatePicker(false)}
        onSave={handleSaveDateOfBirth}
        title="Select Date of Birth"
        maximumDate={new Date()}
      />
    </Screen>
  )
}

const $container: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingHorizontal: spacing.md,
  paddingTop: spacing.xl,
  paddingBottom: spacing.lg,
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

const $profilePhotoWrapper: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  position: "relative",
  marginBottom: spacing.md,
})

const $profilePhoto: ThemedStyle<ImageStyle> = () => ({
  width: 120,
  height: 120,
  borderRadius: 60,
})

const $profilePhotoPlaceholder: ThemedStyle<ViewStyle> = ({ colors }) => ({
  width: 120,
  height: 120,
  borderRadius: 60,
  backgroundColor: colors.separator,
  justifyContent: "center",
  alignItems: "center",
})

const $uploadingOverlay: ThemedStyle<ViewStyle> = () => ({
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(0, 0, 0, 0.5)",
  borderRadius: 60,
  justifyContent: "center",
  alignItems: "center",
})

const $cameraIconContainer: ThemedStyle<ViewStyle> = ({ colors }) => ({
  position: "absolute",
  bottom: 0,
  right: 0,
  width: 36,
  height: 36,
  borderRadius: 18,
  backgroundColor: colors.tint,
  justifyContent: "center",
  alignItems: "center",
  borderWidth: 3,
  borderColor: colors.background,
})

const $profileName: ThemedStyle<TextStyle> = ({ spacing }) => ({
  marginBottom: spacing.xxs,
  textAlign: "center",
})

const $profileUsername: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  textAlign: "center",
})

const $section: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginBottom: spacing.lg,
})

const $sectionTitle: ThemedStyle<TextStyle> = ({ spacing }) => ({
  marginBottom: spacing.sm,
  paddingHorizontal: spacing.xs,
})

const $listItem: ThemedStyle<ViewStyle> = () => ({})

const $signOutButton: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginVertical: spacing.sm,
})

const $legalSection: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  justifyContent: "center",
  alignItems: "center",
  marginTop: spacing.xl,
  marginBottom: spacing.md,
})

const $legalButton: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingHorizontal: spacing.xs,
})

const $legalText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  fontSize: 12,
})

const $legalSeparator: ThemedStyle<TextStyle> = ({ spacing, colors }) => ({
  marginHorizontal: spacing.xs,
  color: colors.textDim,
  fontSize: 12,
})

const $versionText: ThemedStyle<TextStyle> = ({ colors, spacing }) => ({
  textAlign: "center",
  color: colors.textDim,
  fontSize: 12,
  marginBottom: spacing.lg,
})

const $rightContent: ThemedStyle<ViewStyle> = () => ({
  flexDirection: "row",
  alignItems: "center",
  alignSelf: "center",
})

const $rightText: ThemedStyle<TextStyle> = ({ colors, spacing }) => ({
  color: colors.textDim,
  marginRight: spacing.xxs,
  fontSize: 14,
})
