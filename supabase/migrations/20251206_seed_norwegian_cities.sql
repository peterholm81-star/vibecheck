/*
  # Seed Norwegian Cities for VibeCheck
  
  This migration adds ~30 Norwegian city areas to the cities table.
  Uses UPSERT logic (ON CONFLICT) so it can be run multiple times safely.
  
  Fields:
  - name: City/area name
  - country_code: 'NO' for Norway
  - center_lat, center_lon: Approximate city center coordinates
  
  Note: radius_km is NOT stored in database - handled by frontend constants
*/

-- Ensure unique constraint on name + country_code if it doesn't exist
-- (the table may already have this from initial schema)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cities_name_country_unique'
  ) THEN
    ALTER TABLE cities ADD CONSTRAINT cities_name_country_unique UNIQUE (name, country_code);
  END IF;
EXCEPTION
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- Upsert Norwegian cities
INSERT INTO cities (name, country_code, center_lat, center_lon)
VALUES
  -- Major cities
  ('Oslo', 'NO', 59.9139, 10.7522),
  ('Bergen', 'NO', 60.3913, 5.3221),
  ('Trondheim', 'NO', 63.4305, 10.3951),
  ('Stavanger', 'NO', 58.9700, 5.7331),
  ('Kristiansand', 'NO', 58.1599, 7.9956),
  ('Tromsø', 'NO', 69.6492, 18.9553),
  ('Drammen', 'NO', 59.7440, 10.2045),
  ('Fredrikstad', 'NO', 59.2181, 10.9298),
  ('Sandnes', 'NO', 58.8520, 5.7357),
  ('Sarpsborg', 'NO', 59.2839, 11.1097),
  
  -- Medium-sized cities
  ('Porsgrunn', 'NO', 59.1406, 9.6560),
  ('Skien', 'NO', 59.2098, 9.6089),
  ('Ålesund', 'NO', 62.4722, 6.1495),
  ('Sandefjord', 'NO', 59.1314, 10.2166),
  ('Tønsberg', 'NO', 59.2674, 10.4076),
  ('Moss', 'NO', 59.4340, 10.6590),
  ('Haugesund', 'NO', 59.4138, 5.2680),
  ('Bodø', 'NO', 67.2804, 14.4049),
  ('Hamar', 'NO', 60.7945, 11.0680),
  ('Larvik', 'NO', 59.0530, 10.0265),
  
  -- Smaller cities/towns
  ('Lillehammer', 'NO', 61.1152, 10.4662),
  ('Gjøvik', 'NO', 60.7957, 10.6916),
  ('Molde', 'NO', 62.7375, 7.1591),
  ('Harstad', 'NO', 68.7983, 16.5417),
  ('Narvik', 'NO', 68.4385, 17.4273),
  ('Alta', 'NO', 69.9689, 23.2716),
  ('Arendal', 'NO', 58.4610, 8.7726),
  ('Grimstad', 'NO', 58.3405, 8.5946),
  ('Halden', 'NO', 59.1225, 11.3875),
  ('Kongsberg', 'NO', 59.6688, 9.6502)
  
ON CONFLICT (name, country_code) 
DO UPDATE SET
  center_lat = EXCLUDED.center_lat,
  center_lon = EXCLUDED.center_lon;

