-- Supabase Realtime Setup Script
-- Run this in your Supabase SQL Editor to enable realtime for messages and chats

-- Enable realtime for messages table
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Enable realtime for chats table
ALTER PUBLICATION supabase_realtime ADD TABLE chats;

-- Enable realtime for chat_participants table (for unread counts)
ALTER PUBLICATION supabase_realtime ADD TABLE chat_participants;

-- Verify realtime is enabled
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime';

-- Check existing RLS policies for messages
SELECT * FROM pg_policies WHERE tablename = 'messages';

-- Check existing RLS policies for chats
SELECT * FROM pg_policies WHERE tablename = 'chats';
