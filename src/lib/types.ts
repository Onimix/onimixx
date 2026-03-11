// Types for ONIMIX Eagle Eye Pick

export interface Result {
  id: string;
  league?: string; // GER, ITA, SPA
  block_time: string;
  home_team: string;
  away_team: string;
  home_goals: number;
  away_goals: number;
  total_goals: number;
  over_15: boolean;
  over_25: boolean;
  match_date?: string;
  match_time?: string;
  created_at: string;
}

export interface Odds {
  id: string;
  block_time: string;
  home_team: string;
  away_team: string;
  home_odd?: number;
  draw_odd?: number;
  away_odd?: number;
  goal_line?: number;
  over_odd: number;
  under_odd: number;
  match_date?: string;
  match_time?: string;
  created_at: string;
}

export interface ParsedResult {
  league?: string; // GER, ITA, SPA
  block_time: string;
  home_team: string;
  away_team: string;
  home_goals: number;
  away_goals: number;
  total_goals: number;
  over_15: boolean;
  over_25: boolean;
  match_date?: string;
}

export interface ParsedOdds {
  block_time: string;
  home_team: string;
  away_team: string;
  home_odd?: number;
  draw_odd?: number;
  away_odd?: number;
  goal_line?: number;
  over_odd: number;
  under_odd: number;
  match_date?: string;
}

export interface HistoricalStats {
  totalMatches: number;
  avgGoals: number;
  over15Rate: number;
  over25Rate: number;
}

export interface TeamStats {
  avgScored: number;
  avgConceded: number;
  matchesPlayed: number;
  over15Rate: number;
}

// Pattern analysis result (imported from pattern-detection module)
export interface PatternAnalysis {
  streakInfo: {
    currentStreak: number;
    streakType: 'over' | 'under' | 'none';
    longestOverStreak: number;
    longestUnderStreak: number;
  };
  recentForm: {
    last5: boolean[];
    last5OverRate: number;
    last10OverRate: number;
    trend: 'improving' | 'declining' | 'stable';
  };
  dayOfWeekStats: Array<{
    day: string;
    totalMatches: number;
    overRate: number;
    avgGoals: number;
  }>;
  bounceBack: {
    after1Under: number;
    after2Unders: number;
    after3Unders: number;
    after1Over: number;
    after2Overs: number;
    after3Overs: number;
  };
  blockTimePattern: {
    blockTime: string;
    recentOverRate: number;
    historicalOverRate: number;
    trend: 'hot' | 'cold' | 'neutral';
    streakInfo: {
      currentStreak: number;
      streakType: 'over' | 'under' | 'none';
      longestOverStreak: number;
      longestUnderStreak: number;
    };
  };
  patternScore: number;
  confidenceBoost: number;
}

// Prediction with performance tracking
export interface Prediction {
  id?: string;
  match: ParsedOdds;
  historicalStats: HistoricalStats;
  teamStats: TeamStats;
  prediction: 'OVER 1.5' | 'OVER 2.5' | 'UNDER 1.5' | 'UNDER 2.5' | 'LOW CONFIDENCE';
  confidence: number;
  status: 'SAFE' | 'MODERATE' | 'RISKY';
  // AI probability data
  ai_probability_over15?: number;
  ai_probability_over25?: number;
  ai_confidence_score?: number;
  // Calibration
  calibrated_probability?: number;
  calibration_applied?: boolean;
  // Pattern analysis
  patternAnalysis?: PatternAnalysis;
}

// Database prediction record
export interface PredictionRecord {
  id: string;
  match_id?: string;
  match_date?: string;
  match_time?: string;
  league?: string;
  home_team: string;
  away_team: string;
  home_odd?: number;
  draw_odd?: number;
  away_odd?: number;
  goal_line?: number;
  over_odd?: number;
  under_odd?: number;
  prediction_date: string;
  ai_prediction: string;
  ai_probability_over15?: number;
  ai_probability_over25?: number;
  ai_confidence_score?: number;
  ai_status?: string;
  block_time_stats?: Record<string, unknown>;
  team_stats_home?: Record<string, unknown>;
  team_stats_away?: Record<string, unknown>;
  final_result_over15?: boolean;
  final_result_over25?: boolean;
  final_home_goals?: number;
  final_away_goals?: number;
  final_total_goals?: number;
  is_correct?: boolean;
  profit_loss?: number;
  calibrated_probability?: number;
  calibration_applied?: boolean;
  created_at: string;
  updated_at: string;
  // Over 2.5 specific fields
  bucket_home?: string;
  bucket_over25?: string;
  historical_over25_rate?: number;
  total_in_bucket?: number;
  current_streak?: number;
  streak_type?: string;
  confidence_indicator?: string;
  recommendation?: string;
}

// Performance metrics
export interface ProbabilityBand {
  total: number;
  correct: number;
  accuracy: number;
}

export interface ProbabilityBands {
  '50-59': ProbabilityBand;
  '60-69': ProbabilityBand;
  '70-79': ProbabilityBand;
  '80-89': ProbabilityBand;
  '90-100': ProbabilityBand;
}

export interface PerformanceMetrics {
  total_predictions: number;
  total_correct: number;
  total_accuracy: number;
  total_profit_loss: number;
  rolling_50_accuracy: number;
  current_month_predictions?: number;
  current_month_correct?: number;
  current_month_accuracy?: number;
  probability_bands?: ProbabilityBands;
  calibration_factor?: number;
}

// Sporty vFootball API JSON structure
export interface SportyResponse {
  bizCode: number;
  data: {
    tournaments: Tournament[];
  };
}

export interface Tournament {
  events: Match[];
}

export interface Match {
  estimateStartTime: number;
  setScore: string;
  homeTeamName: string;
  awayTeamName: string;
  matchStatus: string;
}

// ============================================
// OVER 2.5 TRACKING SYSTEM TYPES
// ============================================

// Bucket configuration for odds ranges
export interface BucketConfig {
  homeOddBuckets: Array<{ min: number; max: number; label: string }>;
  over25OddBuckets: Array<{ min: number; max: number; label: string }>;
}

// Default bucket configuration
export const DEFAULT_BUCKET_CONFIG: BucketConfig = {
  homeOddBuckets: [
    { min: 1.20, max: 1.40, label: '1.20-1.40' },
    { min: 1.41, max: 1.70, label: '1.41-1.70' },
    { min: 1.71, max: 2.20, label: '1.71-2.20' },
    { min: 2.21, max: 999, label: '2.21+' },
  ],
  over25OddBuckets: [
    { min: 1.40, max: 1.60, label: '1.40-1.60' },
    { min: 1.61, max: 1.80, label: '1.61-1.80' },
    { min: 1.81, max: 999, label: '1.81+' },
  ],
};

// Extended Result type for Over 2.5 tracking
export interface Over25Result {
  id: string;
  match_date: string;
  block_id?: string;
  platform?: string;
  home_team: string;
  away_team: string;
  home_goals: number;
  away_goals: number;
  total_goals: number;
  home_odd?: number;
  away_odd?: number;
  over25_odd?: number;
  under25_odd?: number;
  result_over25: boolean;
  result_home_win: boolean;
  created_at: string;
}

// Upcoming match input for Over 2.5 analysis
export interface UpcomingMatchInput {
  home_odd: number;
  away_odd: number;
  over25_odd: number;
  under25_odd: number;
  home_team?: string;
  away_team?: string;
  block_id?: string;
  match_date?: string;
}

// Upcoming match record from database
export interface UpcomingMatch extends UpcomingMatchInput {
  id: string;
  match_date: string;
  bucket_home?: string;
  bucket_over25?: string;
  historical_over25_rate?: number;
  total_in_bucket?: number;
  current_streak?: number;
  streak_type?: string;
  confidence_indicator?: string;
  created_at: string;
}

// Bucket statistics
export interface BucketStats {
  id: string;
  bucket_type: 'home_odd' | 'away_odd' | 'over25_odd';
  bucket_range: string;
  total_matches: number;
  over25_hits: number;
  over25_rate: number;
  current_streak: number;
  streak_type: 'over' | 'under' | 'none';
  last_updated: string;
}

// Odds pattern tracking
export interface OddsPattern {
  id: string;
  pattern_hash: string;
  home_odd_range: string;
  over25_odd_range: string;
  total_matches: number;
  over25_hits: number;
  over25_rate: number;
  last_seen: string;
  created_at: string;
}

// Over 2.5 analysis result
export interface Over25Analysis {
  bucket_home: string;
  bucket_over25: string;
  historical_over25_rate: number;
  total_in_bucket: number;
  current_streak: number;
  streak_type: 'over' | 'under' | 'none';
  confidence_indicator: 'HIGH' | 'MEDIUM' | 'LOW';
  recommendation?: string;
  // Internal tracking fields (optional)
  _fallback_used?: 'exact_pattern' | 'home_bucket' | 'over25_bucket' | 'overall';
  _exact_match_count?: number;
}

// Bucket performance for display
export interface BucketPerformance {
  bucket_range: string;
  total_matches: number;
  over25_hits: number;
  over25_rate: number;
  current_streak: number;
  streak_type: string;
}

// Day/Block performance summary
export interface DayBlockPerformance {
  date: string;
  block_id?: string;
  total_matches: number;
  over25_hits: number;
  over25_rate: number;
}

// ============================================
// SHADOW MIRROR & ROLE REVERSAL TYPES
// ============================================

// Supported leagues
export type League = 'GER' | 'ITA' | 'SPA';

// Multi-league team arrays
export const LEAGUE_TEAMS: Record<League, string[]> = {
  GER: ['BMU', 'BVB', 'RBL', 'LEV', 'SGE', 'SCF', 'WOB', 'BMG', 'TSG', 'MAI', 'SVW', 'FCA', 'HDH', 'VFB', 'KOE', 'HSV', 'STP', 'UNI'],
  ITA: ['INT', 'JUV', 'ACM', 'NAP', 'ROM', 'LAZ', 'ATA', 'FIO', 'TOR', 'BFC', 'UDI', 'SAS', 'GEN', 'VER', 'LEC', 'CAG', 'EMP', 'MON', 'PAR', 'COM'],
  SPA: ['RMA', 'FCB', 'ATM', 'GIR', 'RSO', 'RBB', 'VIL', 'VCF', 'BIL', 'OSA', 'GET', 'RAY', 'SEV', 'MAL', 'CEL', 'ALA', 'GRA', 'LPA', 'CAD', 'ELC'],
};

// Mirror Anchor - result from T-1 (yesterday) used for prediction
export interface MirrorAnchor {
  block_time: string;
  match_date: string;
  home_team: string;
  away_team: string;
  home_goals: number;
  away_goals: number;
  total_goals: number;
  is_deadlock: boolean; // 0:0 or 1:0 (total goals <= 1)
  is_blowout: boolean; // 4+ total goals triggers Bait Switch to Under 2.5
  dry_team: string | null; // Team that scored 0
  goal_debt: number; // Goals needed to break deadlock
}

// Team Switch Analysis
export interface TeamSwitchAnalysis {
  team: string;
  yesterday_role: 'dry' | 'producer' | 'neutral';
  today_role: 'producer' | 'bait' | 'neutral';
  switch_trigger: 'dry_to_producer' | 'producer_to_bait' | null;
  switch_confidence: number;
  switch_reason: string;
}

// Shadow Mirror Prediction
export interface ShadowMirrorPrediction {
  id?: string;
  time: string;
  league: League;
  match: string;
  home_team: string;
  away_team: string;
  prediction: 'Over 1.5' | 'Under 2.5';
  confidence: number;
  confidence_label: string;
  odds: number;
  mirror_anchor?: MirrorAnchor;
  team_switch?: TeamSwitchAnalysis;
  signal_type: 'Gap-Fill' | 'New Producer' | 'Bait Switch' | 'Mirror Anchor';
  validated: boolean; // Passes odds filter
  created_at?: string;
}

// Odds validation ranges
export const ODDS_VALIDATION = {
  OVER_15: { min: 1.40, max: 1.57 },
  UNDER_25: { min: 1.65, max: 2.10 },
};

// Bayesian weights for prediction
export const BAYESIAN_WEIGHTS = {
  MIRROR_ANCHOR: 0.70,
  PRODUCTION_SWITCH: 0.20,
  CURRENT_FORM: 0.10,
};

// Parsed Over 2.5 odds from bulk input
export interface ParsedOver25Odds {
  match_date: string;
  match_time: string;
  home_team: string;
  away_team: string;
  home_odd: number;
  away_odd: number;
  over25_odd: number;
  under25_odd: number;
}

// ============================================
// UNIVERSAL SCAN PROTOCOL TYPES
// ============================================

// Universal signal types
export type UniversalSignalType = 
  | 'New Producer'
  | 'Bait Trap'
  | 'Gap Fill'
  | 'Mirror Debt'
  | 'Exit 6 Cap'
  | 'Global Flush'
  | 'Sharp Eye';

// Universal signal confidence level
export type SignalConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

// Universal prediction signal
export interface UniversalSignal {
  id: string;
  signal_type: UniversalSignalType;
  league: 'GER' | 'ITA' | 'SPA';
  match: string;
  home_team: string;
  away_team: string;
  prediction: 'Over 1.5' | 'Under 2.5';
  confidence: number;
  confidence_level: SignalConfidence;
  target_market: 'Over 1.5' | 'Under 2.5' | 'Under 3.5';
  odds: number;
  reasoning: string;
  mirror_anchor?: MirrorAnchor;
  is_sharp_eye_verified?: boolean;
  is_global_flush_trigger?: boolean;
  block_time: string;
  created_at: string;
}
