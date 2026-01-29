/*
  # Add profile_ready_popup_seen Column
  
  This migration adds a boolean column to track whether the user has seen
  the one-time "profile ready" confirmation modal.
  
  ## New Column: `profile_ready_popup_seen`
  - Default: false
  - Set to true when user clicks "Go to map" after first profile completion
  - Used to ensure the popup only shows once per user lifetime
*/

-- Add column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS profile_ready_popup_seen boolean DEFAULT false;

-- Update the get_or_create_profile function to include the new column
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
