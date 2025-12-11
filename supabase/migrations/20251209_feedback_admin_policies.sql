/*
  # Add Admin RLS Policies for Feedback Table
  
  This migration adds missing RLS policies for the feedback table to allow:
  - Admin (authenticated users) to SELECT all feedback
  - Admin (authenticated users) to UPDATE feedback status
  
  Note: In a production app, you would want a proper admin role check.
  For VibeCheck MVP, we allow any authenticated user to manage feedback.
*/

-- Policy: Allow authenticated users to view ALL feedback (for admin panel)
-- This is needed because the original policy only allows viewing own feedback
CREATE POLICY "Authenticated users can view all feedback"
  ON feedback FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Allow authenticated users to UPDATE feedback (for admin status changes)
CREATE POLICY "Authenticated users can update feedback"
  ON feedback FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

