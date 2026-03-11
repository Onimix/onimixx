# Active Context: ONIMIX Universal Scan Protocol

## Current State

**Project Status**: ✅ Production Ready with Universal Scan Protocol

The ONIMIX Eagle Eye Pick now features the Universal Scan protocol - a 24-hour rolling analysis across Germany, Italy, and Spain without being limited to specific time blocks.

## Recently Completed

- [x] Supabase schema setup (results + odds tables)
- [x] JSON results upload with drag-and-drop
- [x] Tab-separated odds input with validation
- [x] Historical stats calculation engine
- [x] Analysis engine with SAFE/MODERATE/RISKY prediction
- [x] Production-ready dashboard UI
- [x] TypeScript strict mode
- [x] Build and lint checks passing
- [x] **Performance tracking system** (2026-02-21)
- [x] **Predictions table with result linking**
- [x] **Calibration logic for probability adjustment**
- [x] **Model performance metrics display**
- [x] **Date field support in odds/results input**
- [x] **Collapsible Data Input Panel** (2026-02-21)
- [x] **"Buy Me A Coffee" button in footer**
- [x] **"Onimix is cooking" animated footer**
- [x] **Results cleanup migration SQL**
- [x] **Team name validation** - reject numeric-only team names (2026-02-23)
- [x] **TOP PICK highlights** - Both dashboards now highlight the best match to bet on (2026-02-23)
- [x] **Predictions sorted by confidence** - SAFE/HIGH first, then MODERATE/MEDIUM (2026-02-23)
- [x] **Calibration now affects SAFE/MODERATE decision** - Uses calibrated probability in decision criteria (2026-02-23)
- [x] **Pattern Detection System** (2026-02-24)
  - Streak detection (consecutive overs/unders)
  - Recent form analysis (last 5/10 matches)
  - Day-of-week patterns
  - Bounce-back probability (after N unders)
  - Block time trend analysis (hot/cold/neutral)
  - Pattern score affects confidence (+/- 15%)
- [x] **Universal Scan Protocol** (2026-03-11)
  - Autonomous Block Monitoring across GER, ITA, SPA
  - Universal Switch Logic (no block restrictions)
  - Sharp Eye Safety Net (verify Over 1.5 vs Under 3.5)
  - Global Flush Detection (if all 3 leagues Under 1.5 → next block high prob)
  - Top 3 Global Signals display

## Current Structure

| File/Directory | Purpose | Status |
|----------------|---------|--------|
| `src/app/page.tsx` | Main dashboard with Universal Scan | ✅ Ready |
| `src/app/layout.tsx` | Root layout | ✅ Ready |
| `src/app/globals.css` | Global styles | ✅ Ready |
| `src/app/api/model-performance/route.ts` | Performance API | ✅ Ready |
| `src/app/api/universal-scan/route.ts` | Universal Scan API | ✅ Ready |
| `src/lib/supabase.ts` | Supabase client & DB ops | ✅ Ready |
| `src/lib/types.ts` | TypeScript types | ✅ Ready |
| `src/lib/analysis.ts` | Analysis engine | ✅ Ready |
| `src/lib/pattern-detection.ts` | Pattern detection module | ✅ Ready |
| `src/lib/universal-scan.ts` | Universal Scan protocol | ✅ Ready |
| `src/components/JsonUploader.tsx` | JSON upload | ✅ Ready |
| `src/components/OddsInput.tsx` | Odds paste input | ✅ Ready |
| `src/components/HistoricalStats.tsx` | Stats panel | ✅ Ready |
| `src/components/PredictionPanel.tsx` | Predictions display | ✅ Ready |
| `supabase/schema.sql` | DB schema | ✅ Ready |
| `supabase/migration-performance-tracking.sql` | Performance migration | ✅ Ready |
| `supabase/migration-cleanup-results.sql` | Results cleanup migration | ✅ Ready |
| `supabase/migration-over25-tracking.sql` | Over 2.5 tracking migration | ✅ Ready |
| `src/lib/over25-analysis.ts` | Over 2.5 analysis engine | ✅ Ready |
| `src/app/api/over25-analysis/route.ts` | Over 2.5 API route | ✅ Ready |
| `src/app/over25-structure/page.tsx` | Over 2.5 analytics page | ✅ Ready |
| `.env.example` | Environment template | ✅ Ready |

## Current Focus

The application is deployed and in production. Supabase is configured at `zalplokogrvqkivrqlsn.supabase.co`.

**IMPORTANT**: Run the migration script `supabase/migration-performance-tracking.sql` in Supabase SQL Editor to enable performance tracking.

## Deployment Configuration

### Supabase Project
- **Project URL**: `https://zalplokogrvqkivrqlsn.supabase.co`
- **Schema**: `supabase/schema.sql` has been applied
- **Migration**: `supabase/migration-performance-tracking.sql` needs to be applied

### Environment Variables (Vercel)
Set these in Vercel:
- `NEXT_PUBLIC_SUPABASE_URL` = `https://zalplokogrvqkivrqlsn.supabase.co`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` = your publishable key

The code supports both `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` variable names.

## Features

### Data Ingestion
- JSON file upload (Sporty vFootball format)
- Tab-separated odds paste input with date support (DD/MM/YYYY)
- Tab-separated results input with date support
- Duplicate prevention with unique constraints

### Analysis Engine
- Block time analysis
- Team-based statistics
- Over 1.5 prediction with confidence scores
- **Calibrated probability based on historical performance**

### Prediction Output
- SAFE: ≥75% hit rate + ≥2.2 avg goals
- MODERATE: ≥60% hit rate + ≥1.8 avg goals
- RISKY: Below threshold

### Performance Tracking (NEW)
- Predictions stored with match details
- Automatic result linking via database trigger
- Accuracy by probability band (50-59%, 60-69%, etc.)
- Rolling 50 predictions accuracy
- ROI calculation
- Calibration factor for probability adjustment

## Input Formats

### Odds Input (Tab-Separated)
```
Date	Time	Event	1	X	2	Goals	Over	Under
26/01/2026	05:36	FCA - HDH	2.51	3.46	2.93	2.5	2.32	1.64
```

### Results Input (Tab-Separated)
```
Date	Time	Match and Result
26/01/2026	08:24	BVB 0-2 SCF
```

## Session History

| Date | Changes |
|------|---------|
| Initial | Template created with base setup |
| 2026-02-19 | ONIMIX Eagle Eye Pick analytics engine complete |
| 2026-02-19 | Pushed to GitHub: https://github.com/Onimix/ONIMIXXE.git |
| 2026-02-20 | Fixed build error: Added URL validation for missing env vars |
| 2026-02-20 | Added support for PUBLISHABLE_DEFAULT_KEY env variable |
| 2026-02-20 | Docs: Update context.md with deployment configuration |
| 2026-02-20 | Added powerful 5D rotating flames around dashboard edges |
| 2026-02-20 | Replaced flames with Matrix rain effect (tiny falling code on all 4 edges) |
| 2026-02-21 | Added performance tracking system with predictions table |
| 2026-02-21 | Added calibration logic and model performance display |
| 2026-02-21 | Added date field support to odds and results input |
| 2026-02-21 | Fixed SQL syntax error in migration (CROSS JOIN LATERAL → subquery) |
| 2026-02-21 | Added collapsible Data Input Panel with expand/collapse button |
| 2026-02-21 | Added "Buy Me A Coffee" button and animated "Onimix is cooking" footer |
| 2026-02-21 | Created results cleanup migration SQL to delete results without dates |
| 2026-02-22 | Added independent Over 2.5 tracking system with bucket analysis |
| 2026-02-22 | Added bulk odds input for Over 2.5 with instant predictions output |
| 2026-02-23 | Added team name validation to reject numeric-only team names |
| 2026-02-23 | Fixed SAFE prediction bug: KOE vs TSG 0:0 was SAFE due to 82.2% raw but 73.1% calibrated - now uses calibrated probability for decision criteria |
| 2026-02-24 | Added pattern detection system with streak, form, day-of-week, bounce-back, and block time trend analysis |
