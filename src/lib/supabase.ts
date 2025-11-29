import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ============================================
// SUPABASE CLIENT CONFIGURATION
// ============================================

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Check if Supabase is configured
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Create client only if configured, otherwise null
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Log warning in development if not configured
if (!isSupabaseConfigured && import.meta.env.DEV) {
  console.warn(
    '⚠️ Supabase is not configured. Using mock data.\n' +
    'To enable Supabase, create a .env file with:\n' +
    '  VITE_SUPABASE_URL=your_supabase_url\n' +
    '  VITE_SUPABASE_ANON_KEY=your_supabase_anon_key'
  );
}

// ============================================
// DATABASE TYPES (for Supabase)
// ============================================

export interface Database {
  public: {
    Tables: {
      venues: {
        Row: {
          id: string;
          name: string;
          address: string;
          latitude: number;
          longitude: number;
          vibe_score: number;
          crowd_level: 'low' | 'medium' | 'high';
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['venues']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['venues']['Insert']>;
      };
      check_ins: {
        Row: {
          id: string;
          venue_id: string;
          mood: 'chill' | 'energetic' | 'crowded' | 'empty';
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['check_ins']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['check_ins']['Insert']>;
      };
    };
  };
}
