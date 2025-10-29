-- Allow connection_type to be NULL in user_connections table
-- This allows users to accept invitations before defining relationship type

ALTER TABLE user_connections
ALTER COLUMN connection_type DROP NOT NULL;

-- Add a comment explaining why NULL is allowed
COMMENT ON COLUMN user_connections.connection_type IS 'Connection type - can be NULL when invitation is accepted but relationship not yet defined';
