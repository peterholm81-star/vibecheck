# VibeCheck Scripts

Backend scripts for managing venue data.

## Prerequisites

Make sure you have the following environment variables set in `.env.local` at the project root:

```bash
# Supabase (use the SERVICE ROLE key for backend scripts)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Google Places API
GOOGLE_PLACES_API_KEY=your-google-places-api-key
```

> ⚠️ **Security Warning**: The `SUPABASE_SERVICE_ROLE_KEY` has elevated privileges. 
> Never expose it in frontend code or commit it to version control.

## Available Scripts

### Update Venues from Google Places

Updates existing venues that are missing coordinates (lat/lng) with data from Google Places API.

```bash
npm run update:venues:google
```

**What it does:**
1. Fetches all venues from `public.venues` where `lat IS NULL OR lng IS NULL`
2. For each venue, searches Google Places API using the venue name
3. Updates the venue with:
   - `lat` / `lng` / `latitude` / `longitude` - coordinates
   - `address` - formatted address (if currently null)
   - `city` - defaults to "Trondheim" (if currently null)
   - `external_place_id` - Google Place ID
   - `source` - "google_places"
   - `category` - mapped from Google place types (bar, night_club, restaurant, etc.)

**Notes:**
- Currently assumes all venues are in Trondheim, Norway
- Includes a 300ms delay between API calls to respect quotas
- Processes venues in batches of 20

