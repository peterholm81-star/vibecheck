import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ============================================
// SUPABASE CLIENT CONFIGURATION
// ============================================

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// Check if Supabase is configured
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Create client - in production this should always succeed
// In development without .env, we create a dummy client that will fail gracefully
let supabaseClient: SupabaseClient;

if (supabaseUrl && supabaseAnonKey) {
  // Normal case: env vars are set, create real client
  supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
} else {
  // Fallback: create a client with placeholder values
  // This will fail on actual queries, but prevents null reference errors
  console.warn(
    '⚠️ Supabase environment variables not found.\n' +
    'Expected: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY\n' +
    'Queries will fail until these are configured.'
  );
  // Create a dummy client - queries will fail but app won't crash
  supabaseClient = createClient(
    'https://placeholder.supabase.co',
    'placeholder-key'
  );
}

// Export the client - never null
export const supabase: SupabaseClient = supabaseClient;

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
