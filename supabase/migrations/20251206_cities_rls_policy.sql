/*
  # Enable RLS and add SELECT policy for cities table
  
  The cities table needs a policy to allow anonymous reads.
  Without this, the Supabase anon key cannot read city data.
*/

-- Enable RLS on cities table if not already enabled
ALTER TABLE cities ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists (to make this migration idempotent)
DROP POLICY IF EXISTS "Anyone can view cities" ON cities;

-- Create policy to allow anyone to read cities
CREATE POLICY "Anyone can view cities"
  ON cities FOR SELECT
  USING (true);

