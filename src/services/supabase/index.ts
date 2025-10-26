/**
 * Supabase Service
 * Centralized exports for all Supabase functionality
 */

// Client
export { supabase, isSupabaseConfigured } from "./supabaseClient"

// Types
export type {
  AuthSession,
  AuthResponse,
  DatabaseQuery,
  StorageUpload,
  RealtimeSubscription,
  OAuthProvider,
  Database,
} from "./types"

// Auth functions
export {
  getCurrentSession,
  getCurrentUser,
  signInWithOAuth,
  signInWithGoogle,
  signInWithApple,
  signInWithEmail,
  signUpWithEmail,
  signOut,
  resetPassword,
  updatePassword,
  updateUserMetadata,
  onAuthStateChange,
} from "./auth"

// Database functions
export {
  fetchFromTable,
  fetchSingleFromTable,
  insertIntoTable,
  insertMultipleIntoTable,
  updateInTable,
  upsertInTable,
  deleteFromTable,
  countRecords,
  executeQuery,
  callFunction,
} from "./database"

// Storage functions
export {
  uploadFile,
  uploadFileWithUUID,
  downloadFile,
  getPublicUrl,
  createSignedUrl,
  createSignedUrls,
  listFiles,
  deleteFile,
  deleteFiles,
  moveFile,
  copyFile,
  createBucket,
  deleteBucket,
  emptyBucket,
} from "./storage"

// Realtime functions
export {
  subscribeToTable,
  subscribeToInserts,
  subscribeToUpdates,
  subscribeToDeletes,
  subscribeToAllChanges,
  subscribeToBroadcast,
  sendBroadcast,
  subscribeToPresence,
  getPresenceState,
  unsubscribeAll,
} from "./realtime"

// Profile functions
export type { Profile, CreateProfileData, UpdateProfileData } from "./profiles"
export {
  isUsernameAvailable,
  createProfile,
  getProfile,
  getProfileByUsername,
  updateProfile,
  hasCompletedOnboarding,
  completeOnboarding,
} from "./profiles"

// Invitation functions
export type { Invitation } from "./invitations"
export {
  getInvitationForChat,
  acceptInvitation,
  rejectInvitation,
  removeParticipantFromChat,
} from "./invitations"

// Message functions
export type { Message } from "./messages"
export {
  getMessagesForChat,
  sendMessage,
  markMessagesAsRead,
  getUnreadCount,
  incrementUnreadCountForOthers,
  updateMessageStatus,
  deleteMessage,
} from "./messages"

// User Connection functions
export type { UserConnection } from "./userConnections"
export {
  getUserConnection,
  updateUserConnection,
  createUserConnection,
  hasUserConnectionsForChat,
  hasChatContextCache,
} from "./userConnections"
