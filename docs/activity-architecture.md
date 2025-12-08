# VibeCheck Activity Architecture - Diagnose

> **Dato:** 8. desember 2024  
> **Status:** IDENTIFISERT - Debugging lagt til

## Dataflyt for Live Activity

```
check_ins (Supabase table)
    │
    ├─► getRecentCheckIns() [api/venues.ts]
    │       └── SELECT * FROM check_ins WHERE created_at >= now() - 3 hours
    │           │
    │           └─► App.tsx (state.checkIns)
    │                   │
    │                   └─► filterCheckInsByTime(checkIns, 180 min)
    │                           │
    │                           ├─► MapView (checkIns prop)
    │                           │       └── generateHeatmapData() + markers
    │                           │
    │                           └─► VenueList (checkIns prop)
    │                                   └── calculateAllVenueStats()
    │                                           └── Grupperer check-ins per venue.id
    │
    └─► venue_stats_recent (VIEW - 90 min window)
            │
            └─► useVenueHeatmap() [hooks/useVenueHeatmap.ts]
                    └── MapView (heatmapVenues)
                            └── Brukes til heatmap layer + statistikk
```

## Detaljert Komponent-analyse

### 1. App.tsx - Data Fetch
- `getRecentCheckIns()` kalles i `useEffect` ved oppstart og hver 30 sek
- Resultatet lagres i `state.checkIns`
- `filteredCheckIns` beregnes med `filterCheckInsByTime()`
- Sendes til MapView og VenueList som prop

### 2. VenueList.tsx - "0 aktive nå"
- Mottar `checkIns` prop fra App
- Venues hentes via `useCityVenues()` hook (geo-basert)
- `calculateAllVenueStats(venues, checkIns)` grupperer check-ins per venue
- "aktive nå" = antall venues hvor `checkInCount > 0`
- Total = `checkIns.length`

### 3. MapView.tsx - Heatmap
- Mottar `checkIns` prop fra App
- `useVenueHeatmap()` henter separat fra `venue_stats_recent` VIEW
- Heatmap bruker `heatmapVenues` for fargekoding
- Markers bruker `checkIns` for badge-count

### 4. venue_stats_recent VIEW
```sql
SELECT venue_id, COUNT(*), ...
FROM check_ins
WHERE created_at >= now() - interval '90 minutes'
GROUP BY venue_id;
```

## Identifisert Problem

### Sannsynlig årsak: Geo-filtrering av venues ekskluderer venues med check-ins

**VenueList flow:**
1. `useCityVenues()` henter venues via Edge Function → kun venues innenfor radius
2. Fallback: `fallbackCityVenues` filtrerer `propsVenues` på avstand fra bysentrum
3. `calculateAllVenueStats(venues, checkIns)` matcher `checkIn.venueId` mot `venue.id`
4. Hvis check-ins refererer til venues UTENFOR den geo-filtrerte listen, telles de ikke

**Bevis:**
- VenueList logger: `[Venues fanen] {city} geo: X api: Y vises: Z`
- Hvis seeded venues har `city_id=NULL` eller feil koordinater, ekskluderes de

### Sekundær årsak: Mulig timezone-mismatch
- `Date.now()` = lokal tid
- Supabase `created_at` = UTC
- `toISOString()` konverterer til UTC, SÅ dette burde være OK

## Debug-logging lagt til

Følgende logging er nå aktiv i development mode:

1. **api/venues.ts** - `getRecentCheckIns()`:
   - Current time (ISO)
   - Filter cutoff (3h ago)
   - Number of rows fetched
   - First and last check-in timestamps

2. **hooks/useVenueHeatmap.ts**:
   - Number of venues fetched
   - Number of stats from venue_stats_recent
   - First stat entry (sample)

3. **App.tsx** - `filteredCheckIns`:
   - Input check-ins count
   - After time filter count
   - Final filtered count

## SQL for å verifisere data

Kjør i Supabase SQL Editor:

```sql
-- 1. Sjekk siste check-ins
SELECT created_at, venue_id 
FROM check_ins 
ORDER BY created_at DESC 
LIMIT 10;

-- 2. Sjekk venue_stats_recent
SELECT * FROM venue_stats_recent LIMIT 10;

-- 3. Tell check-ins siste 3 timer
SELECT COUNT(*) FROM check_ins 
WHERE created_at >= now() - interval '3 hours';

-- 4. Sjekk om check-ins refererer til gyldige venues
SELECT DISTINCT ci.venue_id, v.name, v.city_id, v.latitude
FROM check_ins ci
LEFT JOIN venues v ON ci.venue_id = v.id
WHERE ci.created_at >= now() - interval '3 hours'
LIMIT 20;

-- 5. Venues med siste aktivitet
SELECT v.name, v.city, v.city_id, COUNT(ci.id) as check_in_count
FROM venues v
LEFT JOIN check_ins ci ON v.id = ci.venue_id 
  AND ci.created_at >= now() - interval '3 hours'
GROUP BY v.id, v.name, v.city, v.city_id
HAVING COUNT(ci.id) > 0
ORDER BY check_in_count DESC
LIMIT 20;
```

## Konklusjon

**Status:** Debugging er implementert. Åpne appen med DevTools åpen og se console.

**Mest sannsynlig årsaker:**
1. Check-ins hentes OK fra DB, men venues i UI er geo-filtrert til en annen by/radius
2. Venue-matching mislykkes fordi `checkIn.venueId` ikke finnes i den filtrerte listen

**Neste steg:** 
1. Kjør appen med debug-logging aktivert
2. Sjekk browser console for antall check-ins
3. Kjør SQL-queries i Supabase for å verifisere data
4. Sammenlign venue-IDer mellom check-ins og VenueList
