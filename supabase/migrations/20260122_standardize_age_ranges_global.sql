-- ============================================
-- Migration: Standardize Age Ranges Globally
-- 
-- Single source of truth for all age fields:
-- '18–24', '25–34', '35–44', '45+'
-- (Note: uses en-dash – not hyphen -)
--
-- Affected columns:
-- - check_ins.age_band
-- - vibe_users.age_group
-- - vibe_users.avatar_age_range
--
-- PREREQUISITE: All test data has been deleted before running this.
-- ============================================

BEGIN;

-- ============================================
-- STEP 1: Verify tables are empty (safety check)
-- ============================================
DO $$
DECLARE
  check_ins_count INT;
  vibe_users_count INT;
BEGIN
  SELECT COUNT(*) INTO check_ins_count FROM public.check_ins;
  SELECT COUNT(*) INTO vibe_users_count FROM public.vibe_users;
  
  IF check_ins_count > 0 OR vibe_users_count > 0 THEN
    RAISE NOTICE 'WARNING: Tables not empty! check_ins=%, vibe_users=%', check_ins_count, vibe_users_count;
    RAISE NOTICE 'Proceeding anyway - will set invalid values to NULL';
  ELSE
    RAISE NOTICE 'Tables are empty. Safe to proceed.';
  END IF;
END $$;

-- ============================================
-- STEP 2: Normalize any existing data (safety)
-- Maps old formats to new standard
-- ============================================

-- Normalize check_ins.age_band
UPDATE public.check_ins
SET age_band = CASE
  WHEN age_band IS NULL THEN NULL
  WHEN age_band IN ('18_24', '18-24', '18–24') THEN '18–24'
  WHEN age_band IN ('25_34', '25-34', '25–34') THEN '25–34'
  WHEN age_band IN ('35_44', '35-44', '35–44') THEN '35–44'
  WHEN age_band IN ('45_plus', '45+', '45 +') THEN '45+'
  ELSE NULL
END
WHERE age_band IS NOT NULL;

-- Normalize vibe_users.age_group
UPDATE public.vibe_users
SET age_group = CASE
  WHEN age_group IS NULL THEN NULL
  WHEN age_group IN ('18_24', '18-24', '18–24', '18-22', '18-25', '23-27') THEN '18–24'
  WHEN age_group IN ('25_34', '25-34', '25–34', '25-30', '28-34', '30-35') THEN '25–34'
  WHEN age_group IN ('35_44', '35-44', '35–44', '35-40') THEN '35–44'
  WHEN age_group IN ('45_plus', '45+', '45 +', '40+', '40_plus') THEN '45+'
  ELSE NULL
END
WHERE age_group IS NOT NULL;

-- Normalize vibe_users.avatar_age_range
UPDATE public.vibe_users
SET avatar_age_range = CASE
  WHEN avatar_age_range IS NULL THEN NULL
  WHEN avatar_age_range IN ('18_25', '18_24', '18-24', '18–24', '18-25') THEN '18–24'
  WHEN avatar_age_range IN ('25_30', '30_35', '25_34', '25-34', '25–34') THEN '25–34'
  WHEN avatar_age_range IN ('35_40', '35_44', '35-44', '35–44') THEN '35–44'
  WHEN avatar_age_range IN ('40_plus', '45_plus', '45+', '40+') THEN '45+'
  ELSE NULL
END
WHERE avatar_age_range IS NOT NULL;

-- ============================================
-- STEP 3: Drop old constraints
-- ============================================

-- Drop old check_ins constraint if exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'check_ins_age_band_check'
  ) THEN
    ALTER TABLE public.check_ins DROP CONSTRAINT check_ins_age_band_check;
    RAISE NOTICE 'Dropped constraint check_ins_age_band_check';
  END IF;
END $$;

-- Drop old vibe_users constraints if exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'vibe_users_age_group_check'
  ) THEN
    ALTER TABLE public.vibe_users DROP CONSTRAINT vibe_users_age_group_check;
    RAISE NOTICE 'Dropped constraint vibe_users_age_group_check';
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'vibe_users_avatar_age_range_check'
  ) THEN
    ALTER TABLE public.vibe_users DROP CONSTRAINT vibe_users_avatar_age_range_check;
    RAISE NOTICE 'Dropped constraint vibe_users_avatar_age_range_check';
  END IF;
END $$;

-- ============================================
-- STEP 4: Add new constraints with standard values
-- Using en-dash (–) character: U+2013
-- ============================================

-- check_ins.age_band constraint
ALTER TABLE public.check_ins
  ADD CONSTRAINT check_ins_age_band_check
  CHECK (age_band IS NULL OR age_band IN ('18–24', '25–34', '35–44', '45+'));

-- vibe_users.age_group constraint
ALTER TABLE public.vibe_users
  ADD CONSTRAINT vibe_users_age_group_check
  CHECK (age_group IS NULL OR age_group IN ('18–24', '25–34', '35–44', '45+'));

-- vibe_users.avatar_age_range constraint
ALTER TABLE public.vibe_users
  ADD CONSTRAINT vibe_users_avatar_age_range_check
  CHECK (avatar_age_range IS NULL OR avatar_age_range IN ('18–24', '25–34', '35–44', '45+'));

-- ============================================
-- STEP 5: Add comments for documentation
-- ============================================

COMMENT ON COLUMN public.check_ins.age_band IS 
  'Age range: 18–24, 25–34, 35–44, 45+ (uses en-dash)';

COMMENT ON COLUMN public.vibe_users.age_group IS 
  'Age group from onboarding: 18–24, 25–34, 35–44, 45+ (uses en-dash)';

COMMENT ON COLUMN public.vibe_users.avatar_age_range IS 
  'Avatar age range: 18–24, 25–34, 35–44, 45+ (uses en-dash)';

-- ============================================
-- STEP 6: Verification
-- ============================================

DO $$
DECLARE
  constraint_count INT;
BEGIN
  SELECT COUNT(*) INTO constraint_count
  FROM pg_constraint
  WHERE conname IN (
    'check_ins_age_band_check',
    'vibe_users_age_group_check', 
    'vibe_users_avatar_age_range_check'
  );
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'MIGRATION COMPLETE';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Constraints created: % (expected: 3)', constraint_count;
  RAISE NOTICE 'Standard values: 18–24, 25–34, 35–44, 45+';
  RAISE NOTICE '========================================';
END $$;

COMMIT;

