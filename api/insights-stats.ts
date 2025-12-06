/**
 * Vercel Edge Function: Insights Stats
 * 
 * Returns aggregated statistics for venue partners.
 * Protected by PIN-based authentication via x-insights-pin header.
 * Uses SERVICE_ROLE_KEY for server-side access (bypasses RLS).
 * 
 * IMPORTANT: PIN is stored in INSIGHTS_DASHBOARD_PIN environment variable.
 * This is separate from ADMIN_DASHBOARD_PIN.
 */

import { createClient } from '@supabase/supabase-js';

export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request): Promise<Response> {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ============================================
  // PIN-based authentication
  // ============================================
  const insightsPin = process.env.INSIGHTS_DASHBOARD_PIN;
  
  // If PIN is not configured, insights is disabled
  if (!insightsPin) {
    console.error('[insights-stats] INSIGHTS_DASHBOARD_PIN not configured');
    return new Response(
      JSON.stringify({ error: 'Insights not configured' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Check for x-insights-pin header
  const clientPin = req.headers.get('x-insights-pin');
  
  if (!clientPin || clientPin !== insightsPin) {
    // Log failed attempts (but don't reveal details to client)
    console.warn('[insights-stats] Unauthorized access attempt');
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // ============================================
  // Fetch stats (PIN verified)
  // ============================================
  try {
    // Read environment variables
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[insights-stats] Missing environment variables:', {
        hasUrl: !!supabaseUrl,
        hasServiceKey: !!supabaseServiceKey,
      });
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role key (bypasses RLS)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Calculate time filters
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();

    // Run all queries in parallel for better performance
    const [
      totalUsersResult,
      activeUsersResult,
      checkInsLast24hResult,
      checkInsLastHourResult,
      totalVenuesResult,
      venuesWithCheckInsResult,
    ] = await Promise.all([
      // Total users
      supabase.from('vibe_users').select('*', { count: 'exact', head: true }),
      
      // Active users in last 10 minutes
      supabase
        .from('vibe_users')
        .select('*', { count: 'exact', head: true })
        .gte('last_seen_at', tenMinutesAgo),
      
      // Check-ins in last 24 hours
      supabase
        .from('check_ins')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', twentyFourHoursAgo),
      
      // Check-ins in last hour
      supabase
        .from('check_ins')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', oneHourAgo),
      
      // Total venues
      supabase.from('venues').select('*', { count: 'exact', head: true }),
      
      // Venues with check-ins in last 24h (distinct venue_ids)
      supabase
        .from('check_ins')
        .select('venue_id')
        .gte('created_at', twentyFourHoursAgo),
    ]);

    // Check for errors (log details server-side, return generic error to client)
    const errors = [
      totalUsersResult.error,
      activeUsersResult.error,
      checkInsLast24hResult.error,
      checkInsLastHourResult.error,
      totalVenuesResult.error,
      venuesWithCheckInsResult.error,
    ].filter(Boolean);

    if (errors.length > 0) {
      console.error('[insights-stats] Database errors:', errors);
      return new Response(
        JSON.stringify({ error: 'Database error' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Calculate unique venues with check-ins
    const uniqueVenueIds = new Set(
      (venuesWithCheckInsResult.data || []).map((row: { venue_id: string }) => row.venue_id)
    );

    // Build response with stats relevant to venue partners
    const stats = {
      totalUsers: totalUsersResult.count ?? 0,
      activeLast10m: activeUsersResult.count ?? 0,
      checkInsLast24h: checkInsLast24hResult.count ?? 0,
      checkInsLastHour: checkInsLastHourResult.count ?? 0,
      totalVenues: totalVenuesResult.count ?? 0,
      venuesWithCheckInsLast24h: uniqueVenueIds.size,
    };

    console.log('[insights-stats] Returning stats');

    return new Response(JSON.stringify(stats), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    // Log full error server-side, return generic message to client
    console.error('[insights-stats] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

