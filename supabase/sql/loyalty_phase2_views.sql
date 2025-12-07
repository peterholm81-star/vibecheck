/*
  ============================================
  LOYALTY PHASE 2: Views for Rankings
  ============================================
  
  Fil: loyalty_phase2_views.sql
  Formål: Opprette views for lojalitetsranking per by og globalt
  
  KJØR DENNE ETTER loyalty_phase1_stats_and_functions.sql
  
  Innhold:
  1. venue_loyalty_city_rank - Rangering per by (brukes av LoyaltyCard i frontend)
  2. venue_loyalty_top_venues_city - Topp 10 venues per by
  3. venue_loyalty_top_venues_global - Global topp 20
  
  Skriptet er IDEMPOTENT - kan kjøres flere ganger.
  
  ============================================
  RUNBOOK – Steg-for-steg kjøring
  ============================================
  
  FORUTSETNINGER:
  1) Du har kjørt cleanup_duplicate_venues.sql (venue dedup)
  2) Du har kjørt loyalty_phase1_stats_and_functions.sql (tabell + funksjoner)
  
  KJØR DETTE SKRIPTET:
  - Kopiér hele filen inn i Supabase SQL Editor og kjør
  
  GENERER DATA (hvis ikke allerede gjort):
  SELECT public.calculate_loyalty_for_all_venues(current_date);
  
  TEST AT DET FUNGERER:
  
  -- Se alle venues med lojalitetsdata:
  SELECT * FROM public.venue_loyalty_city_rank 
  ORDER BY city_name, loyalty_rank 
  LIMIT 50;
  
  -- Finn Circus spesifikt:
  SELECT * FROM public.venue_loyalty_city_rank 
  WHERE venue_name ILIKE '%Circus%';
  
  -- Topp venues i Trondheim:
  SELECT * FROM public.venue_loyalty_top_venues_city 
  WHERE city_name = 'Trondheim';
  
  -- Global toppliste:
  SELECT * FROM public.venue_loyalty_top_venues_global;
*/

-- ============================================
-- 1. VIEW: venue_loyalty_city_rank
-- ============================================
/*
  Hovedview for LoyaltyCard i Insights.
  Viser lojalitetsdata + rangering per by for siste stats_date.
  
  Kolonner som frontend (LoyaltyCard) forventer:
  - venue_id (uuid) - Venue sin unike ID
  - venue_name (text) - Venue-navn
  - city_id (uuid) - By-ID (kan være NULL)
  - city_name (text) - By-navn (kan være NULL)
  - stats_date (date) - Dato for statistikken
  - total_users_90d (integer) - Totale unike brukere siste 90 dager
  - weekly_returners (integer) - Brukere med 2+ besøk siste 7 dager
  - monthly_returners (integer) - Brukere med 2+ besøk siste 30 dager
  - high_frequency_guests (integer) - Brukere med 3+ besøk siste 90 dager
  - churned_users (integer) - Brukere som har sluttet å komme
  - retention_score (integer) - Lojalitetsscore 0-100
  - loyalty_rank (integer) - Plassering i byen (1 = best)
  - venues_in_city (integer) - Antall venues i byen med stats
*/

CREATE OR REPLACE VIEW public.venue_loyalty_city_rank AS
WITH latest_stats AS (
  -- Finn siste stats_date per venue
  -- DISTINCT ON gir oss kun den nyeste raden per venue_id
  SELECT DISTINCT ON (venue_id)
    venue_id,
    stats_date,
    total_users_90d,
    weekly_returners,
    monthly_returners,
    high_frequency_guests,
    churned_users,
    retention_score,
    calculated_at
  FROM public.venue_loyalty_stats
  ORDER BY venue_id, stats_date DESC
),
ranked AS (
  SELECT
    ls.venue_id,
    v.name AS venue_name,
    v.city_id,
    -- Bruk cities.name hvis city_id finnes, ellers venues.city-feltet
    COALESCE(c.name, v.city) AS city_name,
    ls.stats_date,
    ls.total_users_90d,
    ls.weekly_returners,
    ls.monthly_returners,
    ls.high_frequency_guests,
    ls.churned_users,
    ls.retention_score,
    ls.calculated_at,
    -- Rank per by (1 = høyest retention_score)
    -- Ved lik score, bruk total_users_90d som tie-breaker
    ROW_NUMBER() OVER (
      PARTITION BY COALESCE(v.city_id::text, v.city) 
      ORDER BY ls.retention_score DESC, ls.total_users_90d DESC
    ) AS loyalty_rank,
    -- Antall venues i byen med stats
    COUNT(*) OVER (PARTITION BY COALESCE(v.city_id::text, v.city)) AS venues_in_city
  FROM latest_stats ls
  JOIN public.venues v ON v.id = ls.venue_id
  LEFT JOIN public.cities c ON c.id = v.city_id
)
SELECT
  venue_id,
  venue_name,
  city_id,
  city_name,
  stats_date,
  total_users_90d,
  weekly_returners,
  monthly_returners,
  high_frequency_guests,
  churned_users,
  retention_score,
  loyalty_rank::integer,
  venues_in_city::integer,
  calculated_at
FROM ranked;

COMMENT ON VIEW public.venue_loyalty_city_rank IS 
  'Lojalitetsranking per by. Viser siste stats_date for hver venue med by-rangering. Brukes av LoyaltyCard i frontend.';

GRANT SELECT ON public.venue_loyalty_city_rank TO anon, authenticated;

-- ============================================
-- 2. VIEW: venue_loyalty_top_venues_city
-- ============================================
/*
  Topp 10 venues per by basert på retention_score.
  Nyttig for "Topp i din by"-seksjoner i UI.
*/

CREATE OR REPLACE VIEW public.venue_loyalty_top_venues_city AS
SELECT
  city_id,
  city_name,
  venue_id,
  venue_name,
  retention_score,
  total_users_90d,
  loyalty_rank
FROM public.venue_loyalty_city_rank
WHERE loyalty_rank <= 10
ORDER BY city_name NULLS LAST, loyalty_rank;

COMMENT ON VIEW public.venue_loyalty_top_venues_city IS 
  'Topp 10 venues per by etter retention_score.';

GRANT SELECT ON public.venue_loyalty_top_venues_city TO anon, authenticated;

-- ============================================
-- 3. VIEW: venue_loyalty_top_venues_global
-- ============================================
/*
  Global toppliste - topp 20 venues på tvers av alle byer.
  Nyttig for "Beste steder i Norge"-visninger.
*/

CREATE OR REPLACE VIEW public.venue_loyalty_top_venues_global AS
WITH global_ranked AS (
  SELECT
    venue_id,
    venue_name,
    city_id,
    city_name,
    retention_score,
    total_users_90d,
    loyalty_rank AS city_rank,
    -- Global ranking på tvers av alle byer
    ROW_NUMBER() OVER (
      ORDER BY retention_score DESC, total_users_90d DESC
    ) AS global_rank
  FROM public.venue_loyalty_city_rank
)
SELECT
  venue_id,
  venue_name,
  city_id,
  city_name,
  retention_score,
  total_users_90d,
  city_rank::integer,
  global_rank::integer
FROM global_ranked
WHERE global_rank <= 20
ORDER BY global_rank;

COMMENT ON VIEW public.venue_loyalty_top_venues_global IS 
  'Global topp 20 venues etter retention_score, på tvers av alle byer.';

GRANT SELECT ON public.venue_loyalty_top_venues_global TO anon, authenticated;

-- ============================================
-- VERIFISERING – Test at viewene fungerer
-- ============================================
/*
  Kjør disse queryene for å teste:

  -- 1. Beregn lojalitet for alle venues (hvis ikke allerede gjort):
  SELECT public.calculate_loyalty_for_all_venues(current_date);

  -- 2. Se alle venues med lojalitetsdata:
  SELECT * FROM public.venue_loyalty_city_rank 
  ORDER BY city_name NULLS LAST, loyalty_rank 
  LIMIT 50;

  -- 3. Finn Circus spesifikt:
  SELECT * FROM public.venue_loyalty_city_rank 
  WHERE venue_name ILIKE '%Circus%';

  -- 4. Topp venues i Trondheim:
  SELECT * FROM public.venue_loyalty_top_venues_city 
  WHERE city_name = 'Trondheim';

  -- 5. Global toppliste:
  SELECT * FROM public.venue_loyalty_top_venues_global;

  -- 6. Finn venue UUID for testing i frontend:
  SELECT id, name FROM public.venues WHERE name ILIKE '%Circus%';
*/

-- ============================================
-- FERDIG!
-- Views er nå klare til bruk av frontend.
-- ============================================
