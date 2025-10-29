-- Add active_agent column to chats table
-- This tracks the currently selected AI agent for each chat
-- Default is 'alfred' (Home & Family Planner)

ALTER TABLE chats
ADD COLUMN active_agent VARCHAR DEFAULT 'alfred' CHECK (
  active_agent IN ('alfred', 'max', 'alice', 'wes', 'rosa')
);

COMMENT ON COLUMN chats.active_agent IS 'Currently selected AI agent for this chat. Options: alfred (Home & Family Planner), max (Sports Companion), alice (Family Health Companion), wes (Entertainment Curator), rosa (Food & Lifestyle Companion)';

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_chats_active_agent ON chats(active_agent);
