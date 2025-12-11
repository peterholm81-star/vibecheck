/**
 * Anonymous Authentication Helper for VibeCheck
 * 
 * Ensures there's always a Supabase Auth user available.
 * If no user exists, creates an anonymous user automatically.
 * 
 * This enables frictionless onboarding - users don't need to
 * sign up with email/Google to use the app.
 */

import { supabase } from '../supabase';
import type { User } from '@supabase/supabase-js';

/**
 * Ensure the app has an authenticated Supabase user.
 * 
 * Flow:
 * 1. Check if there's already a logged-in user (anonymous or "real")
 * 2. If not, create an anonymous user via `signInAnonymously()`
 * 3. Return the user (or null if something fails)
 * 
 * This should be called once at app startup before any authenticated
 * Supabase queries are made.
 * 
 * @returns The current Supabase Auth user, or null if auth failed
 */
export async function ensureAnonymousUser(): Promise<User | null> {
  try {
    // First, check if we already have a user
    const { data: { user }, error: getUserError } = await supabase.auth.getUser();

    if (getUserError) {
      console.error('[Auth] Error getting current user:', getUserError.message);
      // Don't throw - try to sign in anonymously instead
    }

    if (user) {
      // User already exists (could be anonymous or a "real" user)
      console.log('[Auth] Existing user found:', user.id, user.is_anonymous ? '(anonymous)' : '(authenticated)');
      return user;
    }

    // No user - create an anonymous one
    console.log('[Auth] No user found, creating anonymous user...');
    
    const { data, error: signInError } = await supabase.auth.signInAnonymously();

    if (signInError) {
      console.error('[Auth] Anonymous sign-in error:', signInError.message);
      throw signInError;
    }

    if (!data.user) {
      console.error('[Auth] Anonymous sign-in returned no user');
      return null;
    }

    console.log('[Auth] Anonymous user created:', data.user.id);
    return data.user;
  } catch (err) {
    console.error('[Auth] Failed to ensure anonymous user:', err);
    throw err;
  }
}

/**
 * Check if the current user is anonymous.
 * 
 * @returns true if user is anonymous, false if authenticated with provider
 */
export async function isAnonymousUser(): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.is_anonymous === true;
  } catch {
    return false;
  }
}

