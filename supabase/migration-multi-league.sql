-- ONIMIX Eagle Eye Pick - Multi-League Support Migration
-- Run this SQL in Supabase SQL Editor to add league support

-- ============================================================
-- ADD LEAGUE COLUMN TO RESULTS TABLE
-- ============================================================

-- Add league column to results table
ALTER TABLE results ADD COLUMN IF NOT EXISTS league TEXT DEFAULT 'GER' CHECK (league IN ('GER', 'ITA', 'SPA'));

-- Create index for league filtering
CREATE INDEX IF NOT EXISTS idx_results_league ON results (league);

-- Create composite index for efficient queries
CREATE INDEX IF NOT EXISTS idx_results_league_block_time ON results (league, block_time);

-- ============================================================
-- ADD LEAGUE COLUMN TO ODDS TABLE
-- ============================================================

ALTER TABLE odds ADD COLUMN IF NOT EXISTS league TEXT DEFAULT 'GER' CHECK (league IN ('GER', 'ITA', 'SPA'));

CREATE INDEX IF NOT EXISTS idx_odds_league ON odds (league);

-- ============================================================
-- UPDATE EXISTING DATA
-- ============================================================

-- Set default league for existing results (assuming all are Germany)
UPDATE results SET league = 'GER' WHERE league IS NULL;
UPDATE odds SET league = 'GER' WHERE league IS NULL;

-- ============================================================
-- GRANT PERMISSIONS
-- ============================================================

GRANT ALL ON results TO anon;
GRANT ALL ON results TO authenticated;
GRANT ALL ON odds TO anon;
GRANT ALL ON odds TO authenticated;

-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================
