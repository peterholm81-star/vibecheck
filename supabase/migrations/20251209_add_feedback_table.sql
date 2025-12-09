/*
  # Add Feedback Table for VibeCheck
  
  This migration adds a `feedback` table to store user feedback/bug reports.
  
  ## New Table: `feedback`
  - `id` (uuid, primary key) - Auto-generated
  - `created_at` (timestamptz) - When feedback was submitted
  - `user_id` (uuid, nullable) - References auth.users if logged in
  - `category` (text) - Type of feedback: bug, forslag, spørsmål, annet
  - `message` (text) - The feedback content
  - `status` (text) - Feedback status: åpen, under_arbeid, løst
  - `source` (text) - Where feedback came from (app, admin, etc.)
  - `metadata` (jsonb) - Optional extra data (device info, etc.)
  
  ## Security
  - RLS enabled
  - Users can INSERT new feedback
  - Admin access via service_role or edge functions
*/

-- Create feedback_category enum type
DO $$ BEGIN
  CREATE TYPE feedback_category_enum AS ENUM (
    'bug',
    'forslag',
    'spørsmål',
    'annet'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create feedback_status enum type
DO $$ BEGIN
  CREATE TYPE feedback_status_enum AS ENUM (
    'åpen',
    'under_arbeid',
    'løst'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create feedback table
CREATE TABLE IF NOT EXISTS feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now() NOT NULL,
  
  -- User reference (nullable for anonymous feedback)
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Feedback content
  category feedback_category_enum NOT NULL,
  message text NOT NULL CHECK (char_length(message) >= 10),
  
  -- Status tracking
  status feedback_status_enum NOT NULL DEFAULT 'åpen',
  
  -- Metadata
  source text DEFAULT 'app',
  metadata jsonb DEFAULT NULL,
  
  -- Update tracking
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Policy: Any authenticated user can INSERT feedback
CREATE POLICY "Users can insert feedback"
  ON feedback FOR INSERT
  WITH CHECK (true);

-- Policy: Users can view their own feedback (optional, for future use)
CREATE POLICY "Users can view own feedback"
  ON feedback FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Service role has full access (for admin operations via edge functions)
-- Note: service_role bypasses RLS by default, so this is just documentation

-- Create function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_feedback_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_feedback_updated_at ON feedback;
CREATE TRIGGER update_feedback_updated_at
  BEFORE UPDATE ON feedback
  FOR EACH ROW
  EXECUTE FUNCTION update_feedback_updated_at();

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_category ON feedback(category);

