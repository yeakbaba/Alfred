-- ============================================================================
-- User Invitations Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_invitations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT different_users CHECK (sender_id != receiver_id),
  CONSTRAINT unique_invitation UNIQUE (sender_id, receiver_id)
);

-- Indexes for user_invitations
CREATE INDEX IF NOT EXISTS idx_user_invitations_sender_id ON public.user_invitations(sender_id);
CREATE INDEX IF NOT EXISTS idx_user_invitations_receiver_id ON public.user_invitations(receiver_id);
CREATE INDEX IF NOT EXISTS idx_user_invitations_status ON public.user_invitations(status);

-- RLS Policies for user_invitations
ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;

-- Users can view invitations they sent or received
CREATE POLICY "Users can view their invitations"
ON public.user_invitations FOR SELECT
TO authenticated
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Users can send invitations
CREATE POLICY "Users can send invitations"
ON public.user_invitations FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = sender_id);

-- Users can update invitations they received
CREATE POLICY "Users can update received invitations"
ON public.user_invitations FOR UPDATE
TO authenticated
USING (auth.uid() = receiver_id)
WITH CHECK (auth.uid() = receiver_id);

-- Users can delete invitations they sent
CREATE POLICY "Users can delete sent invitations"
ON public.user_invitations FOR DELETE
TO authenticated
USING (auth.uid() = sender_id);

-- ============================================================================
-- User Connections Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_connections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id_1 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id_2 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_type TEXT,
  relationship_details JSONB,
  last_interaction_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT different_users_connection CHECK (user_id_1 != user_id_2),
  CONSTRAINT unique_connection UNIQUE (user_id_1, user_id_2)
);

-- Indexes for user_connections
CREATE INDEX IF NOT EXISTS idx_user_connections_user_id_1 ON public.user_connections(user_id_1);
CREATE INDEX IF NOT EXISTS idx_user_connections_user_id_2 ON public.user_connections(user_id_2);
CREATE INDEX IF NOT EXISTS idx_user_connections_last_interaction ON public.user_connections(last_interaction_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_user_connections_type ON public.user_connections(connection_type);

-- RLS Policies for user_connections
ALTER TABLE public.user_connections ENABLE ROW LEVEL SECURITY;

-- Users can view connections they are part of
CREATE POLICY "Users can view their connections"
ON public.user_connections FOR SELECT
TO authenticated
USING (auth.uid() = user_id_1 OR auth.uid() = user_id_2);

-- Users can create connections (typically through accepting invitations)
CREATE POLICY "Users can create connections"
ON public.user_connections FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id_1 OR auth.uid() = user_id_2);

-- Users can update connections they are part of
CREATE POLICY "Users can update their connections"
ON public.user_connections FOR UPDATE
TO authenticated
USING (auth.uid() = user_id_1 OR auth.uid() = user_id_2)
WITH CHECK (auth.uid() = user_id_1 OR auth.uid() = user_id_2);

-- Users can delete connections they are part of
CREATE POLICY "Users can delete their connections"
ON public.user_connections FOR DELETE
TO authenticated
USING (auth.uid() = user_id_1 OR auth.uid() = user_id_2);

-- ============================================================================
-- Updated At Triggers
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for user_invitations
DROP TRIGGER IF EXISTS set_user_invitations_updated_at ON public.user_invitations;
CREATE TRIGGER set_user_invitations_updated_at
  BEFORE UPDATE ON public.user_invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Trigger for user_connections
DROP TRIGGER IF EXISTS set_user_connections_updated_at ON public.user_connections;
CREATE TRIGGER set_user_connections_updated_at
  BEFORE UPDATE ON public.user_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Function to get connection between two users (regardless of order)
CREATE OR REPLACE FUNCTION public.get_connection_between_users(
  user_a UUID,
  user_b UUID
)
RETURNS SETOF public.user_connections AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.user_connections
  WHERE
    (user_id_1 = user_a AND user_id_2 = user_b) OR
    (user_id_1 = user_b AND user_id_2 = user_a);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_connection_between_users TO authenticated;
