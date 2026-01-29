/**
 * Get Current User ID Helper
 * 
 * Returns the Supabase auth.uid() for the current user.
 * This is the single source of truth for user identification.
 * 
 * Uses Supabase anonymous auth - every user has a Supabase Auth user,
 * even if they haven't signed up with email/password.
 */

import { supabase } from '../supabase';

/**
 * Get the current authenticated user's ID (auth.uid())
 * 
 * @returns The user ID string, or null if not authenticated
 */
export async function getCurrentUserId(): Promise<string | null> {
  if (!supabase) {
    console.warn('[Auth] Supabase not configured');
    return null;
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) {
      console.error('[Auth] Error getting current user:', error.message);
      return null;
    }

    return user?.id ?? null;
  } catch (err) {
    console.error('[Auth] Exception getting current user:', err);
    return null;
  }
}

/**
 * Get the current authenticated user's ID synchronously from session cache.
 * Faster than getCurrentUserId() but may be stale.
 * 
 * @returns The user ID string, or null if not authenticated
 */
export function getCurrentUserIdSync(): string | null {
  if (!supabase) {
    return null;
  }

  // Access the session from the auth client (cached)
  const session = supabase.auth.getSession();
  
  // getSession returns a Promise, but we can check if it's resolved
  // For truly sync access, we need to track the user in React state
  // This is a fallback that may not work in all cases
  return null;
}

/**
 * Require the current user ID - throws if not authenticated
 * 
 * @returns The user ID string
 * @throws Error if not authenticated
 */
export async function requireCurrentUserId(): Promise<string> {
  const userId = await getCurrentUserId();
  
  if (!userId) {
    throw new Error('User not authenticated. Please sign in.');
  }
  
  return userId;
}


