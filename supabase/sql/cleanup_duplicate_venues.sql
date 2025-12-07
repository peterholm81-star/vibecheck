/*
  ============================================
  VENUE DEDUPLICATION – Safe Merge Strategy
  ============================================
  
  Fil: cleanup_duplicate_venues.sql
  Formål: Rydde opp duplikat-venues ved å MERGE dem (ikke bare slette)
  
  HVORDAN DETTE FUNGERER:
  -----------------------
  1. Vi finner duplikater basert på normalisert navn + by
  2. Vi velger én "kanonisk" venue per gruppe (foretrukket rekkefølge):
     - source = 'osm' eller 'overpass' (ikke 'google_places')
     - Har city_id satt (ikke NULL)
     - Eldste created_at
  3. Vi FLYTTER alle check-ins fra duplikater til den kanoniske venue
  4. Vi SLETTER kun tomme duplikat-venues (etter at check-ins er flyttet)
  
  SIKKERHET:
  ----------
  - Ingen data går tapt - check-ins flyttes, ikke slettes
  - Alt kjøres i en transaksjon (atomisk)
  - Skriptet kan kjøres flere ganger (idempotent)
  - Vi logger hva som skjer med RAISE NOTICE
  
  KJØR I TO STEG:
  ---------------
  STEG 1: Kjør preview-queryen (STEP 1) for å se hva som vil skje
  STEG 2: Kjør DO-blokken (STEP 2) for å faktisk merge duplikatene
*/

-- ============================================
-- STEP 1: PREVIEW – Se duplikater (INGEN ENDRINGER)
-- ============================================
-- Kjør denne queryen først for å se hvilke venues som er duplikater.
-- Kopier og kjør KUN dette i Supabase SQL Editor.

/*
WITH venue_normalized AS (
  -- Normaliser navn og by for sammenligning
  SELECT
    id,
    name,
    lower(trim(name)) AS name_key,
    city_id,
    city,
    COALESCE(city_id::text, lower(trim(COALESCE(city, '')))) AS city_key,
    source,
    created_at,
    latitude,
    longitude
  FROM public.venues
),
duplicate_groups AS (
  -- Finn grupper med mer enn én venue
  SELECT
    name_key,
    city_key,
    COUNT(*) AS venue_count
  FROM venue_normalized
  GROUP BY name_key, city_key
  HAVING COUNT(*) > 1
),
canonical_selection AS (
  -- Velg kanonisk venue per gruppe
  SELECT DISTINCT ON (vn.name_key, vn.city_key)
    vn.id AS canonical_id,
    vn.name AS canonical_name,
    vn.name_key,
    vn.city_key,
    vn.source AS canonical_source,
    vn.city_id AS canonical_city_id,
    vn.created_at AS canonical_created_at
  FROM venue_normalized vn
  JOIN duplicate_groups dg ON dg.name_key = vn.name_key AND dg.city_key = vn.city_key
  ORDER BY 
    vn.name_key, 
    vn.city_key,
    -- Prioritering: osm/overpass > andre sources
    CASE WHEN vn.source IN ('osm', 'overpass') THEN 0 ELSE 1 END,
    -- Deretter: har city_id > ingen city_id
    CASE WHEN vn.city_id IS NOT NULL THEN 0 ELSE 1 END,
    -- Til slutt: eldste først
    vn.created_at ASC,
    vn.id ASC
)
SELECT 
  vn.id AS venue_id,
  vn.name AS venue_name,
  vn.source,
  vn.city_id,
  vn.city,
  vn.created_at,
  cs.canonical_id,
  cs.canonical_name,
  CASE 
    WHEN vn.id = cs.canonical_id THEN '✓ KEEP (canonical)'
    ELSE '✗ DUPLICATE (will merge into canonical)'
  END AS action,
  (SELECT COUNT(*) FROM public.check_ins ci WHERE ci.venue_id = vn.id) AS check_in_count
FROM venue_normalized vn
JOIN duplicate_groups dg ON dg.name_key = vn.name_key AND dg.city_key = vn.city_key
JOIN canonical_selection cs ON cs.name_key = vn.name_key AND cs.city_key = vn.city_key
ORDER BY vn.name_key, vn.city_key, vn.created_at;
*/

-- ============================================
-- STEP 2: MERGE DUPLICATES (Kjør etter preview)
-- ============================================
-- Denne blokken flytter check-ins og sletter duplikater.
-- Alt skjer i én transaksjon - enten alt eller ingenting.

DO $$
DECLARE
  rec RECORD;
  v_checkins_moved integer;
  v_loyalty_stats_moved integer;
  v_total_merged integer := 0;
  v_total_checkins_moved integer := 0;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'VENUE DEDUPLICATION STARTED';
  RAISE NOTICE '========================================';

  -- Lag en midlertidig mapping-tabell
  CREATE TEMP TABLE IF NOT EXISTS venue_merge_mapping AS
  WITH venue_normalized AS (
    SELECT
      id,
      name,
      lower(trim(name)) AS name_key,
      city_id,
      city,
      COALESCE(city_id::text, lower(trim(COALESCE(city, '')))) AS city_key,
      source,
      created_at
    FROM public.venues
  ),
  duplicate_groups AS (
    SELECT
      name_key,
      city_key,
      COUNT(*) AS venue_count
    FROM venue_normalized
    GROUP BY name_key, city_key
    HAVING COUNT(*) > 1
  ),
  canonical_selection AS (
    SELECT DISTINCT ON (vn.name_key, vn.city_key)
      vn.id AS canonical_id,
      vn.name_key,
      vn.city_key
    FROM venue_normalized vn
    JOIN duplicate_groups dg ON dg.name_key = vn.name_key AND dg.city_key = vn.city_key
    ORDER BY 
      vn.name_key, 
      vn.city_key,
      CASE WHEN vn.source IN ('osm', 'overpass') THEN 0 ELSE 1 END,
      CASE WHEN vn.city_id IS NOT NULL THEN 0 ELSE 1 END,
      vn.created_at ASC,
      vn.id ASC
  )
  SELECT 
    cs.canonical_id AS keep_id,
    vn.id AS duplicate_id,
    vn.name AS duplicate_name
  FROM venue_normalized vn
  JOIN duplicate_groups dg ON dg.name_key = vn.name_key AND dg.city_key = vn.city_key
  JOIN canonical_selection cs ON cs.name_key = vn.name_key AND cs.city_key = vn.city_key
  WHERE vn.id <> cs.canonical_id;  -- Ikke inkluder canonical selv

  -- Sjekk om det er noe å gjøre
  IF NOT EXISTS (SELECT 1 FROM venue_merge_mapping) THEN
    RAISE NOTICE 'Ingen duplikater funnet. Ingen endringer gjort.';
    DROP TABLE IF EXISTS venue_merge_mapping;
    RETURN;
  END IF;

  -- Vis hva vi skal gjøre
  RAISE NOTICE 'Fant % duplikater som skal merges', (SELECT COUNT(*) FROM venue_merge_mapping);

  -- Loop gjennom hver duplikat og merge
  FOR rec IN SELECT * FROM venue_merge_mapping LOOP
    RAISE NOTICE '';
    RAISE NOTICE 'Merger: "%" (%) -> canonical (%)', rec.duplicate_name, rec.duplicate_id, rec.keep_id;
    
    -- 1. Flytt check-ins
    UPDATE public.check_ins
    SET venue_id = rec.keep_id
    WHERE venue_id = rec.duplicate_id;
    
    GET DIAGNOSTICS v_checkins_moved = ROW_COUNT;
    v_total_checkins_moved := v_total_checkins_moved + v_checkins_moved;
    RAISE NOTICE '  - Flyttet % check-ins', v_checkins_moved;
    
    -- 2. Flytt venue_loyalty_stats (hvis tabellen finnes)
    IF EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'venue_loyalty_stats'
    ) THEN
      UPDATE public.venue_loyalty_stats
      SET venue_id = rec.keep_id
      WHERE venue_id = rec.duplicate_id;
      
      GET DIAGNOSTICS v_loyalty_stats_moved = ROW_COUNT;
      IF v_loyalty_stats_moved > 0 THEN
        RAISE NOTICE '  - Flyttet % loyalty stats rader', v_loyalty_stats_moved;
      END IF;
    END IF;
    
    -- 3. Slett duplikat-venue (kun hvis ingen referanser igjen)
    DELETE FROM public.venues
    WHERE id = rec.duplicate_id
      AND NOT EXISTS (
        SELECT 1 FROM public.check_ins ci WHERE ci.venue_id = rec.duplicate_id
      );
    
    IF FOUND THEN
      RAISE NOTICE '  - Slettet duplikat venue';
      v_total_merged := v_total_merged + 1;
    ELSE
      RAISE NOTICE '  - ADVARSEL: Kunne ikke slette venue (har fortsatt referanser)';
    END IF;
  END LOOP;

  -- Rydd opp temp-tabell
  DROP TABLE IF EXISTS venue_merge_mapping;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'VENUE DEDUPLICATION COMPLETE';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Totalt: % duplikater slettet, % check-ins flyttet', v_total_merged, v_total_checkins_moved;
END $$;

-- ============================================
-- STEP 3: VERIFY – Sjekk resultatet
-- ============================================
-- Kjør disse queryene for å verifisere at alt er OK

/*
-- 3A. Sjekk at det ikke lenger er duplikater
WITH venue_normalized AS (
  SELECT
    id,
    name,
    lower(trim(name)) AS name_key,
    COALESCE(city_id::text, lower(trim(COALESCE(city, '')))) AS city_key
  FROM public.venues
)
SELECT name_key, city_key, COUNT(*) AS venue_count
FROM venue_normalized
GROUP BY name_key, city_key
HAVING COUNT(*) > 1;
-- Forventet resultat: Ingen rader (eller svært få spesialtilfeller)

-- 3B. Finn Circus og bekreft at den er unik
SELECT id, name, source, city_id, city, created_at,
       (SELECT COUNT(*) FROM public.check_ins ci WHERE ci.venue_id = v.id) AS check_in_count
FROM public.venues v
WHERE name ILIKE '%Circus%'
ORDER BY name, created_at;

-- 3C. Tell totalt antall venues og check-ins
SELECT 
  (SELECT COUNT(*) FROM public.venues) AS total_venues,
  (SELECT COUNT(*) FROM public.check_ins) AS total_checkins;
*/

-- ============================================
-- FERDIG!
-- Gå videre til loyalty_phase1_stats_and_functions.sql
-- ============================================

