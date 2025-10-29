-- Enable realtime for invitations table
ALTER PUBLICATION supabase_realtime ADD TABLE invitations;

-- Grant necessary permissions for realtime
GRANT SELECT ON invitations TO authenticated;

-- Create indexes for better realtime performance
CREATE INDEX IF NOT EXISTS idx_invitations_invited_by ON invitations(invited_by);
CREATE INDEX IF NOT EXISTS idx_invitations_invite_value ON invitations(invite_value);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON invitations(status);
