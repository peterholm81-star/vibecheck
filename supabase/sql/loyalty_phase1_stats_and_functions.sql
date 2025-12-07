/*
  ============================================
  LOYALTY PHASE 1: Tabell og Funksjoner
  ============================================
  
  Fil: loyalty_phase1_stats_and_functions.sql
  Formål: Opprette venue_loyalty_stats tabell og beregningsfunksjoner
  
  KJØR DENNE ETTER cleanup_duplicate_venues.sql
  
  Innhold:
  1. venue_loyalty_stats tabell (med UPSERT-støtte)
  2. calculate_loyalty_for_venue(venue_id, stats_date) funksjon
  3. calculate_loyalty_for_all_venues(stats_date) funksjon
  
  Skriptet er IDEMPOTENT - kan kjøres flere ganger uten feil.
  
  ============================================
  RUNBOOK – Steg-for-steg kjøring
  ============================================
  
  1) FØRST: Kjør venue cleanup
     - Se: supabase/sql/cleanup_duplicate_venues.sql
     - Dette rydder opp duplikater før vi beregner lojalitet
  
  2) Kjør HELE denne filen i Supabase SQL Editor
     - Kopiér alt og kjør
     - Dette oppretter tabellen og funksjonene
  
  3) Kjør loyalty_phase2_views.sql
     - Dette oppretter viewene som frontend bruker
  
  4) Generer lojalitetsdata:
     SELECT public.calculate_loyalty_for_all_venues(current_date);
  
  5) Verifiser at data finnes:
     SELECT * FROM public.venue_loyalty_stats 
     ORDER BY stats_date DESC, retention_score DESC 
     LIMIT 20;
*/

-- ============================================
-- 1. TABELL: venue_loyalty_stats
-- ============================================

CREATE TABLE IF NOT EXISTS public.venue_loyalty_stats (
  venue_id uuid NOT NULL,
  stats_date date NOT NULL,
  total_users_90d integer NOT NULL DEFAULT 0,
  weekly_returners integer NOT NULL DEFAULT 0,
  monthly_returners integer NOT NULL DEFAULT 0,
  high_frequency_guests integer NOT NULL DEFAULT 0,
  churned_users integer NOT NULL DEFAULT 0,
  retention_score integer NOT NULL DEFAULT 0,  -- 0-100 skala
  calculated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Primærnøkkel på (venue_id, stats_date)
  PRIMARY KEY (venue_id, stats_date)
);

-- Legg til foreign key hvis den ikke finnes
-- Bruker ON DELETE CASCADE så stats slettes hvis venue slettes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'venue_loyalty_stats_venue_id_fkey'
  ) THEN
    ALTER TABLE public.venue_loyalty_stats
      ADD CONSTRAINT venue_loyalty_stats_venue_id_fkey
      FOREIGN KEY (venue_id) REFERENCES public.venues(id) ON DELETE CASCADE;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;  -- Ignorer hvis constraint allerede finnes
END $$;

-- Indeks for raskere oppslag på stats_date
CREATE INDEX IF NOT EXISTS idx_venue_loyalty_stats_date 
  ON public.venue_loyalty_stats(stats_date DESC);

-- Indeks for oppslag per venue
CREATE INDEX IF NOT EXISTS idx_venue_loyalty_stats_venue 
  ON public.venue_loyalty_stats(venue_id, stats_date DESC);

-- RLS: Tillat lesing for alle
ALTER TABLE public.venue_loyalty_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view venue_loyalty_stats" ON public.venue_loyalty_stats;
CREATE POLICY "Anyone can view venue_loyalty_stats"
  ON public.venue_loyalty_stats FOR SELECT
  USING (true);

-- Grant tilgang
GRANT SELECT ON public.venue_loyalty_stats TO anon, authenticated;

COMMENT ON TABLE public.venue_loyalty_stats IS 
  'Daglig lojalitetsstatistikk per venue. Beregnes via calculate_loyalty_for_venue().';

-- ============================================
-- 2. FUNKSJON: calculate_loyalty_for_venue
-- ============================================
/*
  Beregner lojalitetsmetrikker for én venue på en gitt dato.
  
  METRIKKER:
  ----------
  - total_users_90d: Antall unike brukere (user_id) siste 90 dager
  - weekly_returners: Brukere med 2+ besøk siste 7 dager
  - monthly_returners: Brukere med 2+ besøk siste 30 dager
  - high_frequency_guests: Brukere med 3+ besøk siste 90 dager (stamgjester)
  - churned_users: Brukere aktive 60-90 dager siden, men IKKE siste 30 dager
  - retention_score: Vektet score 0-100
  
  RETENTION_SCORE FORMEL:
  -----------------------
  score = MIN(100, MAX(0, ROUND(
    (weekly_returners * 3 + monthly_returners * 2 + high_frequency_guests * 4) 
    / MAX(total_users_90d, 1) * 10
  )))
  
  Vekter:
  - Weekly returners × 3 (høy verdi - nylig engasjement)
  - Monthly returners × 2 (middels verdi)
  - High-freq guests × 4 (høyest verdi - stamgjester)
  
  Scoren normaliseres til 0-100 ved å dele på totale brukere.
*/

CREATE OR REPLACE FUNCTION public.calculate_loyalty_for_venue(
  p_venue_id uuid,
  p_stats_date date DEFAULT current_date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_window_start timestamptz;
  v_window_30d timestamptz;
  v_window_7d timestamptz;
  v_window_60d timestamptz;
  v_stats_end timestamptz;
  
  v_total_users_90d integer := 0;
  v_weekly_returners integer := 0;
  v_monthly_returners integer := 0;
  v_high_frequency_guests integer := 0;
  v_churned_users integer := 0;
  v_retention_score integer := 0;
BEGIN
  -- Sjekk at venue finnes i databasen
  IF NOT EXISTS (SELECT 1 FROM public.venues WHERE id = p_venue_id) THEN
    RAISE NOTICE 'Venue % finnes ikke i venues-tabellen, hopper over', p_venue_id;
    RETURN;
  END IF;

  -- Definer tidsvinduer (alle beregnes fra stats_date)
  v_stats_end := (p_stats_date + interval '1 day')::timestamptz;
  v_window_start := (p_stats_date - interval '90 days')::timestamptz;
  v_window_30d := (p_stats_date - interval '30 days')::timestamptz;
  v_window_7d := (p_stats_date - interval '7 days')::timestamptz;
  v_window_60d := (p_stats_date - interval '60 days')::timestamptz;

  -- ============================================
  -- Beregn metrikker
  -- ============================================

  -- Total unike brukere siste 90 dager
  -- Kun tell check-ins med gyldig user_id
  SELECT COALESCE(COUNT(DISTINCT user_id), 0)
  INTO v_total_users_90d
  FROM public.check_ins
  WHERE venue_id = p_venue_id
    AND created_at >= v_window_start
    AND created_at < v_stats_end
    AND user_id IS NOT NULL;

  -- Weekly returners: brukere med 2+ besøk siste 7 dager
  SELECT COALESCE(COUNT(*), 0)
  INTO v_weekly_returners
  FROM (
    SELECT user_id
    FROM public.check_ins
    WHERE venue_id = p_venue_id
      AND created_at >= v_window_7d
      AND created_at < v_stats_end
      AND user_id IS NOT NULL
    GROUP BY user_id
    HAVING COUNT(*) >= 2
  ) sub;

  -- Monthly returners: brukere med 2+ besøk siste 30 dager
  SELECT COALESCE(COUNT(*), 0)
  INTO v_monthly_returners
  FROM (
    SELECT user_id
    FROM public.check_ins
    WHERE venue_id = p_venue_id
      AND created_at >= v_window_30d
      AND created_at < v_stats_end
      AND user_id IS NOT NULL
    GROUP BY user_id
    HAVING COUNT(*) >= 2
  ) sub;

  -- High-frequency guests: brukere med 3+ besøk siste 90 dager
  SELECT COALESCE(COUNT(*), 0)
  INTO v_high_frequency_guests
  FROM (
    SELECT user_id
    FROM public.check_ins
    WHERE venue_id = p_venue_id
      AND created_at >= v_window_start
      AND created_at < v_stats_end
      AND user_id IS NOT NULL
    GROUP BY user_id
    HAVING COUNT(*) >= 3
  ) sub;

  -- Churned users: var aktive 60-90 dager siden, men ikke siste 30 dager
  SELECT COALESCE(COUNT(DISTINCT old_users.user_id), 0)
  INTO v_churned_users
  FROM (
    -- Brukere som var aktive mellom 60-90 dager siden
    SELECT DISTINCT user_id
    FROM public.check_ins
    WHERE venue_id = p_venue_id
      AND created_at >= v_window_start
      AND created_at < v_window_60d
      AND user_id IS NOT NULL
  ) old_users
  WHERE NOT EXISTS (
    -- Men som IKKE har vært her siste 30 dager
    SELECT 1
    FROM public.check_ins recent
    WHERE recent.venue_id = p_venue_id
      AND recent.user_id = old_users.user_id
      AND recent.created_at >= v_window_30d
      AND recent.created_at < v_stats_end
  );

  -- ============================================
  -- Beregn retention_score (0-100)
  -- ============================================
  -- Formel: vektet sum av returners delt på total brukere, skalert til 0-100
  v_retention_score := LEAST(
    100,
    GREATEST(
      0,
      ROUND(
        (
          v_weekly_returners * 3.0
          + v_monthly_returners * 2.0
          + v_high_frequency_guests * 4.0
        )
        / GREATEST(v_total_users_90d, 1)  -- Unngå divisjon med 0
        * 10
      )::integer
    )
  );

  -- ============================================
  -- UPSERT til venue_loyalty_stats
  -- ============================================
  INSERT INTO public.venue_loyalty_stats (
    venue_id,
    stats_date,
    total_users_90d,
    weekly_returners,
    monthly_returners,
    high_frequency_guests,
    churned_users,
    retention_score,
    calculated_at
  )
  VALUES (
    p_venue_id,
    p_stats_date,
    v_total_users_90d,
    v_weekly_returners,
    v_monthly_returners,
    v_high_frequency_guests,
    v_churned_users,
    v_retention_score,
    now()
  )
  ON CONFLICT (venue_id, stats_date)
  DO UPDATE SET
    total_users_90d = EXCLUDED.total_users_90d,
    weekly_returners = EXCLUDED.weekly_returners,
    monthly_returners = EXCLUDED.monthly_returners,
    high_frequency_guests = EXCLUDED.high_frequency_guests,
    churned_users = EXCLUDED.churned_users,
    retention_score = EXCLUDED.retention_score,
    calculated_at = now();

  RAISE NOTICE 'Loyalty beregnet for venue %: score=%, users=%, weekly=%, monthly=%, highfreq=%', 
    p_venue_id, v_retention_score, v_total_users_90d, v_weekly_returners, v_monthly_returners, v_high_frequency_guests;
END;
$$;

COMMENT ON FUNCTION public.calculate_loyalty_for_venue IS 
  'Beregner og lagrer lojalitetsstatistikk for én venue på en gitt dato. Bruker UPSERT for å oppdatere eksisterende data.';

-- ============================================
-- 3. FUNKSJON: calculate_loyalty_for_all_venues
-- ============================================
/*
  Kjører calculate_loyalty_for_venue for alle venues som har 
  minst én check-in siste 90 dager.
  
  Returnerer antall venues som ble oppdatert.
  
  BRUK:
  SELECT public.calculate_loyalty_for_all_venues(current_date);
*/

CREATE OR REPLACE FUNCTION public.calculate_loyalty_for_all_venues(
  p_stats_date date DEFAULT current_date
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_venue_id uuid;
  v_count integer := 0;
  v_window_start timestamptz;
BEGIN
  v_window_start := (p_stats_date - interval '90 days')::timestamptz;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'LOYALTY CALCULATION STARTED for %', p_stats_date;
  RAISE NOTICE '========================================';

  -- Loop over alle venues med check-ins siste 90 dager
  -- Sjekk også at venue faktisk finnes i venues-tabellen
  FOR v_venue_id IN
    SELECT DISTINCT ci.venue_id
    FROM public.check_ins ci
    WHERE ci.created_at >= v_window_start
      AND ci.venue_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM public.venues v WHERE v.id = ci.venue_id)
  LOOP
    -- Beregn for hver venue
    PERFORM public.calculate_loyalty_for_venue(v_venue_id, p_stats_date);
    v_count := v_count + 1;
  END LOOP;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'LOYALTY CALCULATION COMPLETE';
  RAISE NOTICE 'Totalt: % venues oppdatert', v_count;
  RAISE NOTICE '========================================';
  
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.calculate_loyalty_for_all_venues IS 
  'Kjører lojalitetsberegning for alle aktive venues. Returnerer antall oppdaterte venues.';

-- ============================================
-- FERDIG! 
-- ============================================
-- Neste steg: Kjør loyalty_phase2_views.sql
