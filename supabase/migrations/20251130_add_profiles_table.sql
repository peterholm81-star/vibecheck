/*
  # Add Profiles Table for VibeCheck

  This migration adds a `profiles` table to store user profile data
  for matching and heatmap features.

  ## New Table: `profiles`
  - `id` (uuid, primary key) - User ID (references auth.users if using Supabase Auth)
  - `relationship_status` (text) - single, in_relationship, open_relationship, prefer_not_to_say
  - `gender` (text) - female, male, other, prefer_not_to_say
  - `orientation` (text) - straight, gay, bi, other, prefer_not_to_say
  - `birth_year` (int) - User's birth year for age calculation
  - `show_as_single` (boolean) - Show in "single" heatmap layer
  - `smart_checkin_enabled` (boolean) - Enable smart check-in suggestions
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ## Security
  - RLS enabled
  - Users can only read/update their own profile
*/

-- Create enum types for better data integrity
DO $$ BEGIN
  CREATE TYPE relationship_status_enum AS ENUM (
    'single',
    'in_relationship',
    'open_relationship',
    'prefer_not_to_say'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE gender_enum AS ENUM (
    'female',
    'male',
    'other',
    'prefer_not_to_say'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE orientation_enum AS ENUM (
    'straight',
    'gay',
    'bi',
    'other',
    'prefer_not_to_say'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Core profile fields
  relationship_status relationship_status_enum DEFAULT NULL,
  gender gender_enum DEFAULT NULL,
  orientation orientation_enum DEFAULT NULL,
  birth_year int DEFAULT NULL CHECK (birth_year >= 1920 AND birth_year <= 2010),
  
  -- Heatmap & feature flags
  show_as_single boolean DEFAULT false,
  smart_checkin_enabled boolean DEFAULT false,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Policy: Users can insert their own profile
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Policy: Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Create function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_show_as_single 
  ON profiles(show_as_single) 
  WHERE show_as_single = true;

-- Function to get or create profile for current user
-- This ensures a profile always exists when needed
CREATE OR REPLACE FUNCTION get_or_create_profile()
RETURNS profiles AS $$
DECLARE
  profile_row profiles;
BEGIN
  -- Try to get existing profile
  SELECT * INTO profile_row FROM profiles WHERE id = auth.uid();
  
  -- If not found, create one
  IF NOT FOUND THEN
    INSERT INTO profiles (id) VALUES (auth.uid())
    RETURNING * INTO profile_row;
  END IF;
  
  RETURN profile_row;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

