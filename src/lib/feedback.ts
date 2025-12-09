/**
 * Feedback helper functions for VibeCheck
 * 
 * Handles submitting user feedback to Supabase.
 */

import { supabase } from './supabase';

// ============================================
// TYPES
// ============================================

export type FeedbackCategory = 'bug' | 'forslag' | 'spørsmål' | 'annet';
export type FeedbackStatus = 'åpen' | 'under_arbeid' | 'løst';

export interface FeedbackInsert {
  category: FeedbackCategory;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface Feedback {
  id: string;
  created_at: string;
  user_id: string | null;
  category: FeedbackCategory;
  message: string;
  status: FeedbackStatus;
  source: string;
  metadata: Record<string, unknown> | null;
  updated_at: string;
}

// ============================================
// CATEGORY LABELS (for UI)
// ============================================

export const FEEDBACK_CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  bug: 'Bug / Feil',
  forslag: 'Forbedringsforslag',
  spørsmål: 'Spørsmål',
  annet: 'Annet',
};

export const FEEDBACK_STATUS_LABELS: Record<FeedbackStatus, string> = {
  åpen: 'Åpen',
  under_arbeid: 'Under arbeid',
  løst: 'Løst',
};

export const FEEDBACK_CATEGORIES: FeedbackCategory[] = ['bug', 'forslag', 'spørsmål', 'annet'];
export const FEEDBACK_STATUSES: FeedbackStatus[] = ['åpen', 'under_arbeid', 'løst'];

// ============================================
// SUBMIT FEEDBACK (USER-SIDE)
// ============================================

/**
 * Submit new feedback to Supabase.
 * Automatically attaches user_id if logged in.
 */
export async function submitFeedback(feedback: FeedbackInsert): Promise<{ success: boolean; error?: string }> {
  try {
    // Get current user (may be null if not logged in)
    const { data: { user } } = await supabase.auth.getUser();
    
    // Build metadata with device info
    const metadata = {
      ...feedback.metadata,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      timestamp: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('feedback')
      .insert({
        user_id: user?.id ?? null,
        category: feedback.category,
        message: feedback.message,
        source: 'app',
        metadata,
      });

    if (error) {
      console.error('[feedback] Supabase insert error:', error);
      return { success: false, error: error.message };
    }

    console.log('[feedback] Feedback submitted successfully');
    return { success: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Ukjent feil';
    console.error('[feedback] Unexpected error:', err);
    return { success: false, error: errorMsg };
  }
}

// ============================================
// FETCH FEEDBACK (ADMIN-SIDE)
// ============================================

export interface FetchFeedbackOptions {
  status?: FeedbackStatus | 'all';
  limit?: number;
  offset?: number;
}

/**
 * Fetch feedback from Supabase (for admin panel).
 * Note: This uses the anon key, so it depends on RLS policies.
 * For admin access, use edge functions with service_role.
 */
export async function fetchFeedback(options: FetchFeedbackOptions = {}): Promise<{
  data: Feedback[];
  error?: string;
}> {
  try {
    const { status = 'all', limit = 50, offset = 0 } = options;

    let query = supabase
      .from('feedback')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter by status if not 'all'
    if (status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[feedback] Supabase fetch error:', error);
      return { data: [], error: error.message };
    }

    return { data: (data as Feedback[]) ?? [] };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Ukjent feil';
    console.error('[feedback] Unexpected fetch error:', err);
    return { data: [], error: errorMsg };
  }
}

// ============================================
// UPDATE FEEDBACK STATUS (ADMIN-SIDE)
// ============================================

/**
 * Update feedback status.
 * Note: This requires appropriate RLS policies or service_role access.
 */
export async function updateFeedbackStatus(
  feedbackId: string,
  newStatus: FeedbackStatus
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('feedback')
      .update({ status: newStatus })
      .eq('id', feedbackId);

    if (error) {
      console.error('[feedback] Supabase update error:', error);
      return { success: false, error: error.message };
    }

    console.log('[feedback] Status updated to:', newStatus);
    return { success: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Ukjent feil';
    console.error('[feedback] Unexpected update error:', err);
    return { success: false, error: errorMsg };
  }
}

