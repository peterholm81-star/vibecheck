/*
  # Notification System for VibeCheck
  
  This migration adds the foundation for opt-in "VibeWatch" notifications:
  
  1. Adds `allow_notifications` column to `profiles` table
     - Global preference to allow/disallow notifications
     - Default is false (opt-in)
  
  2. Creates `notification_sessions` table
     - Represents short-lived "radar mode" sessions (typically 4 hours)
     - Stores the user's filter snapshot (modus, stemning, age bands, etc.)
     - A future backend job will read active sessions and send web push
       notifications based on Heatmap 2.0 venue scores.
  
  ## Usage Flow
  1. User enables "Tillat varsler" in profile settings
  2. User activates "Live-varsler for kvelden" on the map
  3. A notification_session row is created with their current filters
  4. Backend job (future) checks active sessions and sends push notifications
     when matching venues become "hot" based on Heatmap 2.0 scores
*/

-- ============================================
-- Part 1: Add allow_notifications to profiles
-- ============================================

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS allow_notifications boolean NOT NULL DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN profiles.allow_notifications IS 
  'Global preference to allow/disallow push notifications. Must be true for radar mode to work.';

-- ============================================
-- Part 2: Create notification_sessions table
-- ============================================

CREATE TABLE IF NOT EXISTS notification_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User reference (same pattern as profiles table)
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Filter snapshot at the time of session creation
  -- Contains: { heatmapMode, activeIntents, activeAgeBands, singlesOnly, etc. }
  filters jsonb NOT NULL,
  
  -- Session timing
  started_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,  -- When this radar session should auto-expire
  
  -- Session state
  is_active boolean NOT NULL DEFAULT true,
  
  -- Tracking for notification throttling
  last_notified_at timestamptz NULL,
  
  -- Metadata
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add comments for documentation
COMMENT ON TABLE notification_sessions IS 
  'Short-lived radar mode sessions. Active sessions receive push notifications when matching venues become hot.';
  
COMMENT ON COLUMN notification_sessions.filters IS 
  'JSON snapshot of user filters: { heatmapMode, activeIntents, activeAgeBands, singlesOnly, etc. }';
  
COMMENT ON COLUMN notification_sessions.ends_at IS 
  'Auto-expiry time. Sessions typically last 4 hours.';
  
COMMENT ON COLUMN notification_sessions.last_notified_at IS 
  'Used to throttle notifications. Backend job should check this before sending.';

-- ============================================
-- Part 3: Indexes for efficient queries
-- ============================================

-- Index for backend job to find active, non-expired sessions
CREATE INDEX IF NOT EXISTS idx_notification_sessions_active 
  ON notification_sessions (is_active, ends_at)
  WHERE is_active = true;

-- Index for user lookup (e.g., finding user's current session)
CREATE INDEX IF NOT EXISTS idx_notification_sessions_user_id 
  ON notification_sessions (user_id);

-- ============================================
-- Part 4: Row Level Security
-- ============================================

ALTER TABLE notification_sessions ENABLE ROW LEVEL SECURITY;

-- Users can view their own sessions
CREATE POLICY "Users can view own notification sessions"
  ON notification_sessions FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own sessions
CREATE POLICY "Users can insert own notification sessions"
  ON notification_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own sessions
CREATE POLICY "Users can update own notification sessions"
  ON notification_sessions FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own sessions
CREATE POLICY "Users can delete own notification sessions"
  ON notification_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- Part 5: Helper function to clean up expired sessions
-- ============================================

-- Function to deactivate expired sessions (can be called by backend job or cron)
CREATE OR REPLACE FUNCTION deactivate_expired_notification_sessions()
RETURNS integer AS $$
DECLARE
  rows_updated integer;
BEGIN
  UPDATE notification_sessions
  SET is_active = false
  WHERE is_active = true AND ends_at < now();
  
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RETURN rows_updated;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION deactivate_expired_notification_sessions() IS 
  'Deactivates notification sessions that have passed their ends_at time. Call periodically via cron or backend job.';

