-- Create storage bucket for chat images
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-images', 'chat-images', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies for chat images
-- Allow authenticated users to upload images
CREATE POLICY "Users can upload chat images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'chat-images');

-- Allow public read access to chat images
CREATE POLICY "Anyone can view chat images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'chat-images');

-- Allow users to delete their own images
CREATE POLICY "Users can delete their own chat images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'chat-images' AND owner = auth.uid());

-- Optional: Add a messages table column for image URL if not exists
-- ALTER TABLE messages ADD COLUMN IF NOT EXISTS image_url TEXT;
-- ALTER TABLE messages ADD COLUMN IF NOT EXISTS image_metadata JSONB;
