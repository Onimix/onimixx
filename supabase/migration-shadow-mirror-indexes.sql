-- Shadow Mirror Optimization Migration
-- Run this in Supabase SQL Editor to enable efficient 24-hour cycle queries
-- Required for preventing Vercel function timeout during 12-minute VFL cycle

-- ============================================================================
-- STEP 1: Add missing columns if they don't exist
-- ============================================================================

-- Add match_date column for date-based queries (critical for Shadow Mirror)
ALTER TABLE results ADD COLUMN IF NOT EXISTS match_date TEXT;

-- Add league column for multi-league support (GER, ITA, SPA)
ALTER TABLE results ADD COLUMN IF NOT EXISTS league TEXT DEFAULT 'GER' 
  CHECK (league IN ('GER', 'ITA', 'SPA'));

-- Add match_date to odds table for consistency
ALTER TABLE odds ADD COLUMN IF NOT EXISTS match_date TEXT;

-- Add league to odds table
ALTER TABLE odds ADD COLUMN IF NOT EXISTS league TEXT DEFAULT 'GER'
  CHECK (league IN ('GER', 'ITA', 'SPA'));

-- ============================================================================
-- STEP 2: Create optimized indexes for Shadow Mirror queries
-- ============================================================================

-- Primary index: Find yesterday's results by league (most common query)
-- Used in: getResultsByLeagueAndDateRange(league, yesterday, yesterday)
CREATE INDEX IF NOT EXISTS idx_results_league_date 
  ON results (league, match_date DESC);

-- Secondary index: Find results by block_time within date range
-- Used in: Block time analysis and Exit 6 Cap detection
CREATE INDEX IF NOT EXISTS idx_results_date_block 
  ON results (match_date, block_time);

-- Tertiary index: Composite index for full Shadow Mirror query
-- Used in: generateShadowMirrorPredictions with league filtering
CREATE INDEX IF NOT EXISTS idx_results_league_date_block 
  ON results (league, match_date, block_time);

-- Index for odds queries by league
CREATE INDEX IF NOT EXISTS idx_odds_league_block 
  ON odds (league, block_time);

-- Index for finding yesterday's results across all leagues (fallback)
CREATE INDEX IF NOT EXISTS idx_results_yesterday 
  ON results (match_date) 
  WHERE match_date = to_char(CURRENT_DATE - INTERVAL '1 day', 'YYYY-MM-DD');

-- ============================================================================
-- STEP 3: Create function to backfill match_date from block_time
-- ============================================================================

-- This function extracts date from block_time format (e.g., "06:00" -> today's date)
-- Run this once to populate existing data: SELECT backfill_match_date();

CREATE OR REPLACE FUNCTION backfill_match_date()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update results table: extract date from block_time
  UPDATE results 
  SET match_date = TO_CHAR(created_at::date, 'YYYY-MM-DD')
  WHERE match_date IS NULL OR match_date = '';
  
  -- Update odds table
  UPDATE odds
  SET match_date = TO_CHAR(created_at::date, 'YYYY-MM-DD')
  WHERE match_date IS NULL OR match_date = '';
END;
$$;

-- Run the backfill function to populate existing records
SELECT backfill_match_date();

-- ============================================================================
-- STEP 4: Verify indexes were created
-- ============================================================================

SELECT 
  indexname, 
  indexdef 
FROM pg_indexes 
WHERE tablename = 'results' 
  AND indexname LIKE 'idx_results_%'
ORDER BY indexname;

SELECT 
  indexname, 
  indexdef 
FROM pg_indexes 
WHERE tablename = 'odds' 
  AND indexname LIKE 'idx_odds_%'
ORDER BY indexname;

-- ============================================================================
-- STEP 5: Example queries that will now be optimized
-- ============================================================================

-- Query 1: Get yesterday's results for Germany league (optimized)
-- EXPLAIN ANALYZE SELECT * FROM results 
--   WHERE league = 'GER' 
--   AND match_date = to_char(CURRENT_DATE - INTERVAL '1 day', 'YYYY-MM-DD');

-- Query 2: Get all results for Shadow Mirror analysis (last 7 days, all leagues)
-- EXPLAIN ANALYZE SELECT * FROM results 
--   WHERE match_date >= to_char(CURRENT_DATE - INTERVAL '7 days', 'YYYY-MM-DD')
--   AND match_date <= to_char(CURRENT_DATE - INTERVAL '1 day', 'YYYY-MM-DD')
--   ORDER BY league, match_date, block_time;

-- Query 3: Get block time stats for Exit 6 Cap
-- EXPLAIN ANALYZE SELECT block_time, COUNT(*), AVG(total_goals) 
--   FROM results 
--   WHERE match_date >= to_char(CURRENT_DATE - INTERVAL '30 days', 'YYYY-MM-DD')
--   GROUP BY block_time;
