/*
  # VibeCheck Database Schema

  1. New Tables
    - `venues`
      - `id` (uuid, primary key) - Unique venue identifier
      - `name` (text) - Venue name
      - `area` (text) - Area/neighborhood name
      - `latitude` (float) - Geographic latitude
      - `longitude` (float) - Geographic longitude
      - `created_at` (timestamptz) - Record creation timestamp

    - `check_ins`
      - `id` (uuid, primary key) - Unique check-in identifier
      - `venue_id` (uuid, foreign key) - References venues table
      - `timestamp` (timestamptz) - Check-in timestamp
      - `desired_vibe` (text) - Selected vibe category
      - `energy_level` (int) - Energy rating 1-3
      - `crowd_level` (int) - Crowd rating 1-3
      - `music_type` (text) - Type of music playing
      - `comment` (text) - Optional comment (max 140 chars)
      - `created_at` (timestamptz) - Record creation timestamp

  2. Security
    - Enable RLS on both tables
    - Public read access (anonymous users can view data)
    - Public insert access on check_ins (anonymous users can check in)
    - No update/delete access for anonymous users

  3. Indexes
    - Index on venue_id for efficient check-in queries
    - Index on timestamp for time-based filtering
*/

CREATE TABLE IF NOT EXISTS venues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  area text NOT NULL,
  latitude float NOT NULL,
  longitude float NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS check_ins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  timestamp timestamptz DEFAULT now(),
  desired_vibe text NOT NULL,
  energy_level int NOT NULL CHECK (energy_level >= 1 AND energy_level <= 3),
  crowd_level int NOT NULL CHECK (crowd_level >= 1 AND crowd_level <= 3),
  music_type text,
  comment text CHECK (length(comment) <= 140),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view venues"
  ON venues FOR SELECT
  USING (true);

CREATE POLICY "Anyone can view check-ins"
  ON check_ins FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert check-ins"
  ON check_ins FOR INSERT
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_check_ins_venue_id ON check_ins(venue_id);
CREATE INDEX IF NOT EXISTS idx_check_ins_timestamp ON check_ins(timestamp DESC);