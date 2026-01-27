
-- Add Deep Research limit columns to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS research_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS research_limit INTEGER DEFAULT 300,
ADD COLUMN IF NOT EXISTS research_last_reset TIMESTAMPTZ DEFAULT NOW();
