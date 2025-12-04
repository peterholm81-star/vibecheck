/**
 * Vercel Edge Function: Admin Stats
 * 
 * Returns user statistics from vibe_users table.
 * Uses SERVICE_ROLE_KEY for server-side access (bypasses RLS).
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

  try {
    // Read environment variables
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[admin-stats] Missing environment variables:', {
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

    console.log('[admin-stats] Fetching stats with filters:', {
      twentyFourHoursAgo,
      tenMinutesAgo,
    });

    // Run all three queries in parallel
    const [totalResult, newResult, activeResult] = await Promise.all([
      // Total users
      supabase.from('vibe_users').select('*', { count: 'exact', head: true }),
      // New users in last 24 hours
      supabase
        .from('vibe_users')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', twentyFourHoursAgo),
      // Active users in last 10 minutes
      supabase
        .from('vibe_users')
        .select('*', { count: 'exact', head: true })
        .gte('last_seen_at', tenMinutesAgo),
    ]);

    // Check for errors
    if (totalResult.error) {
      console.error('[admin-stats] Total count error:', totalResult.error);
      return new Response(
        JSON.stringify({ error: 'Database error', details: totalResult.error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (newResult.error) {
      console.error('[admin-stats] New users error:', newResult.error);
      return new Response(
        JSON.stringify({ error: 'Database error', details: newResult.error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (activeResult.error) {
      console.error('[admin-stats] Active users error:', activeResult.error);
      return new Response(
        JSON.stringify({ error: 'Database error', details: activeResult.error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Build response
    const stats = {
      totalUsers: totalResult.count ?? 0,
      newUsers24h: newResult.count ?? 0,
      activeLast10m: activeResult.count ?? 0,
    };

    console.log('[admin-stats] Returning stats:', stats);

    return new Response(JSON.stringify(stats), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[admin-stats] Unexpected error:', error);
    return new Response(
      JSON.stringify({
        error: 'Server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

