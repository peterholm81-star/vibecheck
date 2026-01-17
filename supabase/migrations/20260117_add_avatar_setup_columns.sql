/*
  # Add Avatar Setup columns to vibe_users

  This migration adds columns needed for the Avatar & Info setup feature.
  Users must complete this setup before entering Venue Rooms.

  ## New Columns on `vibe_users`:
  - `avatar_gender` (text) - Required: 'male' | 'female'
  - `avatar_age_range` (text) - Required: Uses existing age band values
  - `show_relationship` (boolean) - Whether to show relationship status
  - `relationship_status` (text) - 'single' | 'relationship'
  - `show_ons` (boolean) - Whether to show ONS preference
  - `open_for_ons` (boolean) - Open for ONS
  - `energy` (text) - Optional: 'calm' | 'curious' | 'playful'
  - `style` (text) - Optional: 'neutral' | 'marked'
  - `avatar_setup_complete` (boolean) - Track if setup is done

  ## Age Range Values (matches existing AgeBand type):
  - '18_25' - 18-25 år
  - '25_30' - 25-30 år
  - '30_35' - 30-35 år
  - '35_40' - 35-40 år
  - '40_plus' - 40+ år
*/

-- Add avatar setup columns to vibe_users
ALTER TABLE public.vibe_users
  ADD COLUMN IF NOT EXISTS avatar_gender text,
  ADD COLUMN IF NOT EXISTS avatar_age_range text,
  ADD COLUMN IF NOT EXISTS show_relationship boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS relationship_status text,
  ADD COLUMN IF NOT EXISTS show_ons boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS open_for_ons boolean,
  ADD COLUMN IF NOT EXISTS energy text,
  ADD COLUMN IF NOT EXISTS style text,
  ADD COLUMN IF NOT EXISTS avatar_setup_complete boolean DEFAULT false;

-- Add comments for documentation
COMMENT ON COLUMN public.vibe_users.avatar_gender IS 'User avatar gender: male or female';
COMMENT ON COLUMN public.vibe_users.avatar_age_range IS 'Age range: 18_25, 25_30, 30_35, 35_40, 40_plus';
COMMENT ON COLUMN public.vibe_users.show_relationship IS 'Whether to show relationship status publicly';
COMMENT ON COLUMN public.vibe_users.relationship_status IS 'single or relationship';
COMMENT ON COLUMN public.vibe_users.show_ons IS 'Whether to show ONS preference publicly';
COMMENT ON COLUMN public.vibe_users.open_for_ons IS 'Whether user is open for ONS';
COMMENT ON COLUMN public.vibe_users.energy IS 'Energy/mood: calm, curious, or playful';
COMMENT ON COLUMN public.vibe_users.style IS 'Style preference: neutral or marked';
COMMENT ON COLUMN public.vibe_users.avatar_setup_complete IS 'Whether avatar setup wizard is completed';

-- Create index for quick avatar setup checks
CREATE INDEX IF NOT EXISTS idx_vibe_users_avatar_setup_complete 
  ON public.vibe_users(avatar_setup_complete) 
  WHERE avatar_setup_complete = false;

