-- ============================================
-- Migration: Lock vibe_users age ranges to standard values
-- 
-- Standardizes avatar_age_range and age_group to match check_ins.age_band:
-- ['18-24', '25-34', '35-44', '45+']
--
-- This migration:
-- 1) Normalizes existing data with mapping from old values
-- 2) Adds CHECK constraints with NOT VALID (non-blocking)
-- 3) Validates constraints
-- 4) Reports any values that couldn't be mapped
-- ============================================

BEGIN;

-- ============================================
-- 0) Create temp table to track unmapped values (for reporting)
-- ============================================
CREATE TEMP TABLE IF NOT EXISTS _unmapped_age_values (
  column_name TEXT,
  original_value TEXT,
  row_count INT
);

-- Record any values that will become NULL due to unknown mapping
INSERT INTO _unmapped_age_values (column_name, original_value, row_count)
SELECT 
  'avatar_age_range' AS column_name,
  avatar_age_range AS original_value,
  COUNT(*) AS row_count
FROM public.vibe_users
WHERE avatar_age_range IS NOT NULL
  AND btrim(avatar_age_range) != ''
  AND avatar_age_range NOT IN (
    -- Known mappable values
    '18-22','18-24','18-25','18–25','18-25 år','18–25 år','18_25',
    '23-27','25-30','25-34','25–34','25-34 år','25–34 år','25_30','28-34','30-35','30_35',
    '35-40','35–40','35-44','35–44','35-44 år','35–44 år','35_40',
    '40+','40 +','40_plus','45+','45 +','40+ år','45+ år'
  )
  AND avatar_age_range NOT LIKE '18%'
  AND avatar_age_range NOT LIKE '23%'
  AND avatar_age_range NOT LIKE '25%'
  AND avatar_age_range NOT LIKE '28%'
  AND avatar_age_range NOT LIKE '30%'
  AND avatar_age_range NOT LIKE '35%'
  AND avatar_age_range NOT LIKE '40%'
  AND avatar_age_range NOT LIKE '45%'
GROUP BY avatar_age_range;

INSERT INTO _unmapped_age_values (column_name, original_value, row_count)
SELECT 
  'age_group' AS column_name,
  age_group AS original_value,
  COUNT(*) AS row_count
FROM public.vibe_users
WHERE age_group IS NOT NULL
  AND btrim(age_group) != ''
  AND age_group NOT IN (
    '18-22','18-24','18-25','18–25','18-25 år','18–25 år','18_25',
    '23-27','25-30','25-34','25–34','25-34 år','25–34 år','25_30','28-34','30-35','30_35',
    '35-40','35–40','35-44','35–44','35-44 år','35–44 år','35_40',
    '40+','40 +','40_plus','45+','45 +','40+ år','45+ år'
  )
  AND age_group NOT LIKE '18%'
  AND age_group NOT LIKE '23%'
  AND age_group NOT LIKE '25%'
  AND age_group NOT LIKE '28%'
  AND age_group NOT LIKE '30%'
  AND age_group NOT LIKE '35%'
  AND age_group NOT LIKE '40%'
  AND age_group NOT LIKE '45%'
GROUP BY age_group;

-- ============================================
-- 1) Normalize avatar_age_range
-- ============================================
UPDATE public.vibe_users
SET avatar_age_range = CASE
  -- NULL or empty → NULL
  WHEN avatar_age_range IS NULL OR btrim(avatar_age_range) = '' THEN NULL
  
  -- Exact matches for 18-24 bucket
  WHEN avatar_age_range IN ('18-22','18-24','18-25','18–25','18-25 år','18–25 år','18_25') THEN '18-24'
  
  -- Exact matches for 25-34 bucket
  WHEN avatar_age_range IN ('23-27','25-30','25-34','25–34','25-34 år','25–34 år','25_30','28-34','30-35','30_35') THEN '25-34'
  
  -- Exact matches for 35-44 bucket
  WHEN avatar_age_range IN ('35-40','35–40','35-44','35–44','35-44 år','35–44 år','35_40') THEN '35-44'
  
  -- Exact matches for 45+ bucket
  WHEN avatar_age_range IN ('40+','40 +','40_plus','45+','45 +','40+ år','45+ år') THEN '45+'
  
  -- Fallback pattern matching by prefix
  WHEN avatar_age_range LIKE '18%' THEN '18-24'
  WHEN avatar_age_range LIKE '23%' THEN '25-34'
  WHEN avatar_age_range LIKE '25%' THEN '25-34'
  WHEN avatar_age_range LIKE '28%' THEN '25-34'
  WHEN avatar_age_range LIKE '30%' THEN '25-34'
  WHEN avatar_age_range LIKE '35%' THEN '35-44'
  WHEN avatar_age_range LIKE '40%' THEN '45+'
  WHEN avatar_age_range LIKE '45%' THEN '45+'
  
  -- Unknown value → NULL (don't block, will be reported)
  ELSE NULL
END
WHERE avatar_age_range IS NOT NULL;

-- ============================================
-- 2) Normalize age_group (same mapping)
-- ============================================
UPDATE public.vibe_users
SET age_group = CASE
  -- NULL or empty → NULL
  WHEN age_group IS NULL OR btrim(age_group) = '' THEN NULL
  
  -- Exact matches for 18-24 bucket
  WHEN age_group IN ('18-22','18-24','18-25','18–25','18-25 år','18–25 år','18_25') THEN '18-24'
  
  -- Exact matches for 25-34 bucket
  WHEN age_group IN ('23-27','25-30','25-34','25–34','25-34 år','25–34 år','25_30','28-34','30-35','30_35') THEN '25-34'
  
  -- Exact matches for 35-44 bucket
  WHEN age_group IN ('35-40','35–40','35-44','35–44','35-44 år','35–44 år','35_40') THEN '35-44'
  
  -- Exact matches for 45+ bucket
  WHEN age_group IN ('40+','40 +','40_plus','45+','45 +','40+ år','45+ år') THEN '45+'
  
  -- Fallback pattern matching by prefix
  WHEN age_group LIKE '18%' THEN '18-24'
  WHEN age_group LIKE '23%' THEN '25-34'
  WHEN age_group LIKE '25%' THEN '25-34'
  WHEN age_group LIKE '28%' THEN '25-34'
  WHEN age_group LIKE '30%' THEN '25-34'
  WHEN age_group LIKE '35%' THEN '35-44'
  WHEN age_group LIKE '40%' THEN '45+'
  WHEN age_group LIKE '45%' THEN '45+'
  
  -- Unknown value → NULL
  ELSE NULL
END
WHERE age_group IS NOT NULL;

-- ============================================
-- 3) Add CHECK constraints (idempotent with NOT VALID)
-- ============================================
DO $$
BEGIN
  -- Constraint for avatar_age_range
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'vibe_users_avatar_age_range_check'
      AND conrelid = 'public.vibe_users'::regclass
  ) THEN
    ALTER TABLE public.vibe_users
      ADD CONSTRAINT vibe_users_avatar_age_range_check
      CHECK (avatar_age_range IS NULL OR avatar_age_range IN ('18-24','25-34','35-44','45+'))
      NOT VALID;
    RAISE NOTICE 'Created constraint vibe_users_avatar_age_range_check';
  ELSE
    RAISE NOTICE 'Constraint vibe_users_avatar_age_range_check already exists, skipping';
  END IF;

  -- Constraint for age_group
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'vibe_users_age_group_check'
      AND conrelid = 'public.vibe_users'::regclass
  ) THEN
    ALTER TABLE public.vibe_users
      ADD CONSTRAINT vibe_users_age_group_check
      CHECK (age_group IS NULL OR age_group IN ('18-24','25-34','35-44','45+'))
      NOT VALID;
    RAISE NOTICE 'Created constraint vibe_users_age_group_check';
  ELSE
    RAISE NOTICE 'Constraint vibe_users_age_group_check already exists, skipping';
  END IF;
END $$;

-- ============================================
-- 4) Validate constraints (makes them fully enforced)
-- ============================================
ALTER TABLE public.vibe_users VALIDATE CONSTRAINT vibe_users_avatar_age_range_check;
ALTER TABLE public.vibe_users VALIDATE CONSTRAINT vibe_users_age_group_check;

-- ============================================
-- 5) Report unmapped values (info only)
-- ============================================
DO $$
DECLARE
  rec RECORD;
  total_unmapped INT := 0;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'UNMAPPED AGE VALUES REPORT';
  RAISE NOTICE '========================================';
  
  FOR rec IN SELECT * FROM _unmapped_age_values ORDER BY column_name, original_value LOOP
    RAISE NOTICE 'Column: %, Original: "%", Rows affected: %', rec.column_name, rec.original_value, rec.row_count;
    total_unmapped := total_unmapped + rec.row_count;
  END LOOP;
  
  IF total_unmapped = 0 THEN
    RAISE NOTICE 'No unmapped values found - all data normalized successfully!';
  ELSE
    RAISE NOTICE '----------------------------------------';
    RAISE NOTICE 'Total rows with unmapped values set to NULL: %', total_unmapped;
  END IF;
  
  RAISE NOTICE '========================================';
END $$;

-- Clean up temp table
DROP TABLE IF EXISTS _unmapped_age_values;

COMMIT;

-- ============================================
-- Post-migration verification query (run manually if needed)
-- ============================================
-- SELECT 
--   avatar_age_range, 
--   COUNT(*) as count 
-- FROM public.vibe_users 
-- GROUP BY avatar_age_range 
-- ORDER BY avatar_age_range;
--
-- SELECT 
--   age_group, 
--   COUNT(*) as count 
-- FROM public.vibe_users 
-- GROUP BY age_group 
-- ORDER BY age_group;

