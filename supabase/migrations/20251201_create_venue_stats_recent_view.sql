/*
  # Venue Stats Recent View
  
  Creates a view that calculates real-time statistics for venues based on
  recent check-ins (last 90 minutes).
  
  This view is used by the Heatmap 2.0 feature to display:
  - activity_score: how busy a venue is (0-1)
  - single_ratio: proportion of single users (0-1)
  - ons_ratio: proportion with ONS intent (0-1)
  - party_ratio: proportion with party vibe (0-1)
  - chill_ratio: proportion with chill vibe (0-1)
  
  ## Time Window
  The view uses a 90-minute rolling window. This can be adjusted by
  modifying the interval in the WHERE clause.
  
  ## Normalization
  - activity_score is capped at 20 check-ins = 1.0
  - All ratios are 0-1 based on actual proportions
  
  ## Usage
  Query this view and join with venues table to get complete heatmap data.
*/

-- Drop the view if it exists (for re-running migrations)
DROP VIEW IF EXISTS venue_stats_recent;

-- Create the venue stats view
CREATE VIEW venue_stats_recent AS
SELECT
  venue_id,
  
  -- Total check-ins in the time window
  COUNT(*)::integer AS total_checkins,
  
  -- Activity score: normalized 0-1, capped at 20 check-ins
  -- 0 check-ins = 0.0, 20+ check-ins = 1.0
  LEAST(COUNT(*)::numeric / 20.0, 1.0) AS activity_score,
  
  -- Single ratio: proportion of users with relationship_status = 'single'
  -- Uses COALESCE to handle NULL values (treats NULL as not single)
  COALESCE(
    COUNT(*) FILTER (WHERE relationship_status = 'single')::numeric / NULLIF(COUNT(*), 0),
    0
  ) AS single_ratio,
  
  -- ONS ratio: proportion of users with ONS intent
  -- Counts 'open' and 'maybe' as having ONS intent
  COALESCE(
    COUNT(*) FILTER (WHERE ons_intent IN ('open', 'maybe'))::numeric / NULLIF(COUNT(*), 0),
    0
  ) AS ons_ratio,
  
  -- Party ratio: proportion with 'party' intent
  COALESCE(
    COUNT(*) FILTER (WHERE intent = 'party')::numeric / NULLIF(COUNT(*), 0),
    0
  ) AS party_ratio,
  
  -- Chill ratio: proportion with 'chill' intent
  COALESCE(
    COUNT(*) FILTER (WHERE intent = 'chill')::numeric / NULLIF(COUNT(*), 0),
    0
  ) AS chill_ratio,
  
  -- Last check-in timestamp
  MAX(created_at) AS last_checkin_at

FROM check_ins

-- Only consider check-ins from the last 90 minutes
WHERE created_at >= now() - interval '90 minutes'

GROUP BY venue_id;

-- Add a comment to the view for documentation
COMMENT ON VIEW venue_stats_recent IS 
  'Rolling 90-minute statistics for venues. Used by Heatmap 2.0 feature.';

-- Grant read access to all users (matches our RLS policy)
GRANT SELECT ON venue_stats_recent TO anon, authenticated;

