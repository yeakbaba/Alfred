-- Add push_token column to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS push_token TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_push_token ON profiles(push_token);

-- Add notification preferences columns
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS message_notifications BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS sound_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS vibration_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS show_preview BOOLEAN DEFAULT true;

-- Comment on columns
COMMENT ON COLUMN profiles.push_token IS 'Expo push notification token for this user';
COMMENT ON COLUMN profiles.notifications_enabled IS 'Master switch for all notifications';
COMMENT ON COLUMN profiles.message_notifications IS 'Enable/disable message notifications';
COMMENT ON COLUMN profiles.sound_enabled IS 'Enable/disable notification sounds';
COMMENT ON COLUMN profiles.vibration_enabled IS 'Enable/disable notification vibration';
COMMENT ON COLUMN profiles.show_preview IS 'Show message preview in notifications';
