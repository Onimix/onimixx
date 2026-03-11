// Universal Scan Protocol Module for ONIMIX Eagle Eye Pick
// Autonomous 24-hour rolling analysis across GER, ITA, SPA without block restrictions

import type { Result, ParsedOdds, League, MirrorAnchor } from './types';
import { LEAGUE_TEAMS, ODDS_VALIDATION } from './shadow-mirror';

// ============================================================================
// TYPES
// ============================================================================

// Supported leagues
export type ScanLeague = 'GER' | 'ITA' | 'SPA';

// Universal signal types
export type UniversalSignalType = 
  | 'New Producer'      // Dry → Producer (Over 1.5)
  | 'Bait Trap'         // Exit 6 Balance (Under 2.5)
  | 'Gap Fill'          // Market Reset after dry spell
  | 'Mirror Debt'       // Debt from yesterday's deadlock
  | 'Exit 6 Cap'        // High-scoring block detected
  | 'Global Flush'      // All 3 leagues under 1.5 → next block high probability
  | 'Sharp Eye';        // Safety verification against Under 3.5

// Universal signal confidence level
export type SignalConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

// Universal prediction signal
export interface UniversalSignal {
  id: string;
  signal_type: UniversalSignalType;
  league: ScanLeague;
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

// Global scan result
export interface UniversalScanResult {
  signals: UniversalSignal[];
  top_3_signals: UniversalSignal[];
  global_status: {
    total_signals: number;
    production_vacuums: number;    // Leagues with dry yesterday
    over_production_peaks: number; // Leagues with blowouts yesterday
    global_flush_activated: boolean;
    active_leagues: ScanLeague[];
  };
  league_snapshots: Record<ScanLeague, LeagueSnapshot>;
  scan_timestamp: string;
}

// League-specific snapshot
export interface LeagueSnapshot {
  league: ScanLeague;
  current_block_stats: BlockStats | null;
  previous_block_stats: BlockStats | null;
  mirror_anchors: MirrorAnchor[];
  dry_teams: string[];
  producer_teams: string[];
  avg_goals: number;
  over_15_rate: number;
  is_exit_6_active: boolean;
  is_production_vacuum: boolean;
}

// Block statistics
export interface BlockStats {
  block_time: string;
  total_matches: number;
  total_goals: number;
  avg_goals: number;
  over_15_count: number;
  under_15_count: number;
  over_15_rate: number;
  deadlock_count: number;
  blowout_count: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const SCAN_LEAGUES: ScanLeague[] = ['GER', 'ITA', 'SPA'];

// Sharp Eye odds range for safety verification
const SHARP_EYE_ODDS = {
  OVER_15: { min: 1.40, max: 1.57 },
  UNDER_35: { min: 1.50, max: 1.80 }, // Safety net verification
};

// Exit 6 Cap thresholds
const EXIT_6_CAP = {
  GOAL_FLUSH: 4.5,    // Avg goals >= 4.5 = Goal Flush
  DEFENSIVE_LOCK: 1.5, // Avg goals <= 1.5 = Defensive Lock
};

// Global Flush threshold
const GLOBAL_FLUSH_THRESHOLD = 1.5; // All 3 leagues avg <= 1.5 = Global Flush

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Get yesterday's date
function getYesterdayDate(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().split('T')[0];
}

// Get today's date
function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

// Get team league
function getTeamLeague(team: string): ScanLeague | null {
  for (const [league, teams] of Object.entries(LEAGUE_TEAMS)) {
    if (teams.includes(team.toUpperCase())) {
      return league as ScanLeague;
    }
  }
  return null;
}

// Check if odds are in Sharp Eye range
export function isInSharpEyeRange(odds: number, type: 'OVER_15' | 'UNDER_35'): boolean {
  const range = SHARP_EYE_ODDS[type];
  return odds >= range.min && odds <= range.max;
}

// Check if match is deadlock (0:0 or 1:0)
function isDeadlock(totalGoals: number): boolean {
  return totalGoals <= 1;
}

// Check if match is blowout (4+ goals)
function isBlowout(totalGoals: number): boolean {
  return totalGoals >= 4;
}

// Get current block time based on minute (12-minute cycles)
export function getCurrentBlockTime(): string {
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const blockMinutes = Math.floor(minutes / 12) * 12;
  const hours = Math.floor(blockMinutes / 60);
  const mins = blockMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

// Get previous block time
export function getPreviousBlockTime(blockTime: string): string | null {
  const [hours, mins] = blockTime.split(':').map(Number);
  const totalMinutes = hours * 60 + mins;
  
  if (totalMinutes <= 0) return null;
  
  const prevTotalMinutes = totalMinutes - 12;
  const prevHours = Math.floor(prevTotalMinutes / 60);
  const prevMins = prevTotalMinutes % 60;
  
  return `${prevHours.toString().padStart(2, '0')}:${prevMins.toString().padStart(2, '0')}`;
}

// ============================================================================
// BLOCK ANALYSIS
// ============================================================================

// Calculate block statistics for a specific block time
export function calculateBlockStats(results: Result[], blockTime: string): BlockStats {
  const blockMatches = results.filter(r => r.block_time === blockTime);
  
  if (blockMatches.length === 0) {
    return {
      block_time: blockTime,
      total_matches: 0,
      total_goals: 0,
      avg_goals: 0,
      over_15_count: 0,
      under_15_count: 0,
      over_15_rate: 0,
      deadlock_count: 0,
      blowout_count: 0,
    };
  }
  
  const totalGoals = blockMatches.reduce((sum, r) => sum + r.total_goals, 0);
  const over15Count = blockMatches.filter(r => r.over_15).length;
  const under15Count = blockMatches.filter(r => r.total_goals <= 1).length;
  const deadlocks = blockMatches.filter(r => isDeadlock(r.total_goals)).length;
  const blowouts = blockMatches.filter(r => isBlowout(r.total_goals)).length;
  
  return {
    block_time: blockTime,
    total_matches: blockMatches.length,
    total_goals: totalGoals,
    avg_goals: totalGoals / blockMatches.length,
    over_15_count: over15Count,
    under_15_count: under15Count,
    over_15_rate: (over15Count / blockMatches.length) * 100,
    deadlock_count: deadlocks,
    blowout_count: blowouts,
  };
}

// ============================================================================
// MIRROR ANCHOR DETECTION (T-1)
// ============================================================================

// Find mirror anchors from yesterday
export function findMirrorAnchors(results: Result[]): MirrorAnchor[] {
  const yesterday = getYesterdayDate();
  const mirrorAnchors: MirrorAnchor[] = [];
  
  for (const result of results) {
    if (result.match_date !== yesterday) continue;
    
    const isDeadlockMatch = isDeadlock(result.total_goals);
    const isBlowoutMatch = isBlowout(result.total_goals);
    
    if (isDeadlockMatch || isBlowoutMatch) {
      const dryTeam = result.home_goals === 0 ? result.home_team : 
                      result.away_goals === 0 ? result.away_team : null;
      
      mirrorAnchors.push({
        block_time: result.block_time,
        match_date: result.match_date,
        home_team: result.home_team,
        away_team: result.away_team,
        home_goals: result.home_goals,
        away_goals: result.away_goals,
        total_goals: result.total_goals,
        is_deadlock: isDeadlockMatch,
        is_blowout: isBlowoutMatch,
        dry_team: dryTeam,
        goal_debt: isDeadlockMatch ? Math.max(0, 2 - result.total_goals) : 0,
      });
    }
  }
  
  return mirrorAnchors;
}

// ============================================================================
// LEAGUE SNAPSHOT GENERATION
// ============================================================================

// Generate league snapshot
function generateLeagueSnapshot(
  league: ScanLeague,
  results: Result[],
  currentBlockTime: string,
  previousBlockTime: string | null
): LeagueSnapshot {
  const leagueResults = results.filter(r => (r.league || 'GER') === league);
  
  const currentBlockStats = calculateBlockStats(leagueResults, currentBlockTime);
  const previousBlockStats = previousBlockTime 
    ? calculateBlockStats(leagueResults, previousBlockTime)
    : null;
  
  // Find mirror anchors for this league
  const yesterdayAnchors = findMirrorAnchors(leagueResults);
  
  // Identify dry and producer teams
  const dryTeams: string[] = [];
  const producerTeams: string[] = [];
  
  for (const anchor of yesterdayAnchors) {
    if (anchor.is_deadlock && anchor.dry_team) {
      dryTeams.push(anchor.dry_team);
    }
    if (anchor.is_blowout) {
      if (anchor.home_goals >= 3) producerTeams.push(anchor.home_team);
      if (anchor.away_goals >= 3) producerTeams.push(anchor.away_team);
    }
  }
  
  // Calculate overall league stats
  const avgGoals = leagueResults.length > 0
    ? leagueResults.reduce((sum, r) => sum + r.total_goals, 0) / leagueResults.length
    : 0;
    
  const over15Rate = leagueResults.length > 0
    ? (leagueResults.filter(r => r.over_15).length / leagueResults.length) * 100
    : 0;
  
  // Check Exit 6 Cap status
  const isExit6Active = currentBlockStats.avg_goals >= EXIT_6_CAP.GOAL_FLUSH;
  
  // Check Production Vacuum (dry yesterday)
  const isProductionVacuum = yesterdayAnchors.some(a => a.is_deadlock);
  
  return {
    league,
    current_block_stats: currentBlockStats,
    previous_block_stats: previousBlockStats,
    mirror_anchors: yesterdayAnchors,
    dry_teams: [...new Set(dryTeams)],
    producer_teams: [...new Set(producerTeams)],
    avg_goals: avgGoals,
    over_15_rate: over15Rate,
    is_exit_6_active: isExit6Active,
    is_production_vacuum: isProductionVacuum,
  };
}

// ============================================================================
// GLOBAL FLUSH DETECTION
// ============================================================================

// Check if all 3 leagues are in Global Flush state
function checkGlobalFlush(snapshots: Record<ScanLeague, LeagueSnapshot>): boolean {
  const leagues = Object.values(snapshots);
  
  // Check if all leagues finished Under 1.5 in previous block
  const allUnder15 = leagues.every(s => 
    s.previous_block_stats && s.previous_block_stats.avg_goals <= GLOBAL_FLUSH_THRESHOLD
  );
  
  // Also check if no production yesterday (all production vacuums)
  const allVacuum = leagues.every(s => s.is_production_vacuum);
  
  return allUnder15 || allVacuum;
}

// ============================================================================
// UNIVERSAL SIGNAL GENERATION
// ============================================================================

// Generate universal signals from odds and league snapshots
function generateUniversalSignals(
  odds: ParsedOdds[],
  snapshots: Record<ScanLeague, LeagueSnapshot>,
  globalFlushActivated: boolean
): UniversalSignal[] {
  const signals: UniversalSignal[] = [];
  const currentBlockTime = getCurrentBlockTime();
  
  for (const match of odds) {
    const league = getTeamLeague(match.home_team) || getTeamLeague(match.away_team);
    if (!league) continue;
    
    const snapshot = snapshots[league];
    if (!snapshot) continue;
    
    // Get mirror anchors for this match
    const relevantAnchors = snapshot.mirror_anchors.filter(
      a => a.home_team.toLowerCase() === match.home_team.toLowerCase() ||
           a.away_team.toLowerCase() === match.away_team.toLowerCase() ||
           a.home_team.toLowerCase() === match.away_team.toLowerCase() ||
           a.away_team.toLowerCase() === match.home_team.toLowerCase()
    );
    
    // === SIGNAL A: NEW PRODUCER (Dry → Producer) ===
    const dryTeam = relevantAnchors.find(a => a.is_deadlock && a.dry_team)?.dry_team;
    if (dryTeam && 
        (dryTeam.toLowerCase() === match.home_team.toLowerCase() || 
         dryTeam.toLowerCase() === match.away_team.toLowerCase())) {
      
      // Check if odds are valid for Over 1.5
      const oddsValid = isInSharpEyeRange(match.over_odd, 'OVER_15');
      
      // Sharp Eye verification - check Under 3.5 odds
      const sharpEyeVerified = match.under_odd 
        ? isInSharpEyeRange(match.under_odd, 'UNDER_35')
        : false;
      
      const confidence = oddsValid ? 92 : 85;
      
      signals.push({
        id: `np-${match.home_team}-${match.away_team}-${Date.now()}`,
        signal_type: 'New Producer',
        league,
        match: `${match.home_team} vs ${match.away_team}`,
        home_team: match.home_team,
        away_team: match.away_team,
        prediction: 'Over 1.5',
        confidence,
        confidence_level: confidence >= 90 ? 'HIGH' : confidence >= 80 ? 'MEDIUM' : 'LOW',
        target_market: sharpEyeVerified ? 'Under 3.5' : 'Over 1.5',
        odds: match.over_odd,
        reasoning: `Mirror Debt detected: ${dryTeam} was dry yesterday (deadlock). Forced into producer role today.`,
        mirror_anchor: relevantAnchors.find(a => a.is_deadlock),
        is_sharp_eye_verified: sharpEyeVerified,
        block_time: match.block_time,
        created_at: new Date().toISOString(),
      });
      continue;
    }
    
    // === SIGNAL B: BAIT TRAP (Exit 6 Balance) ===
    const blowoutAnchor = relevantAnchors.find(a => a.is_blowout);
    if (blowoutAnchor) {
      const teamWasProducer = 
        (match.home_team.toLowerCase() === blowoutAnchor.home_team.toLowerCase() && blowoutAnchor.home_goals >= 3) ||
        (match.away_team.toLowerCase() === blowoutAnchor.away_team.toLowerCase() && blowoutAnchor.away_goals >= 3);
      
      if (teamWasProducer) {
        signals.push({
          id: `bt-${match.home_team}-${match.away_team}-${Date.now()}`,
          signal_type: 'Bait Trap',
          league,
          match: `${match.home_team} vs ${match.away_team}`,
          home_team: match.home_team,
          away_team: match.away_team,
          prediction: 'Under 2.5',
          confidence: 87,
          confidence_level: 'MEDIUM',
          target_market: 'Under 2.5',
          odds: match.under_odd,
          reasoning: `Exit 6 Balance: Team was high-scoring yesterday (blowout). Defensive lock enforced today.`,
          mirror_anchor: blowoutAnchor,
          block_time: match.block_time,
          created_at: new Date().toISOString(),
        });
        continue;
      }
    }
    
    // === SIGNAL C: GLOBAL FLUSH ===
    if (globalFlushActivated) {
      // Prioritize highest Over 1.5 odds in safety range
      if (isInSharpEyeRange(match.over_odd, 'OVER_15')) {
        signals.push({
          id: `gf-${match.home_team}-${match.away_team}-${Date.now()}`,
          signal_type: 'Global Flush',
          league,
          match: `${match.home_team} vs ${match.away_team}`,
          home_team: match.home_team,
          away_team: match.away_team,
          prediction: 'Over 1.5',
          confidence: 94,
          confidence_level: 'HIGH',
          target_market: 'Over 1.5',
          odds: match.over_odd,
          reasoning: `Global Goal Flush activated: All 3 leagues finished Under 1.5 in previous cycle. Market reset expected.`,
          is_global_flush_trigger: true,
          block_time: match.block_time,
          created_at: new Date().toISOString(),
        });
        continue;
      }
    }
    
    // === SIGNAL D: MIRROR DEBT ===
    if (snapshot.is_production_vacuum && match.over_odd >= 1.40) {
      // Check if this team was involved in a deadlock
      const involvedInDeadlock = relevantAnchors.some(a => a.is_deadlock);
      if (involvedInDeadlock) {
        signals.push({
          id: `md-${match.home_team}-${match.away_team}-${Date.now()}`,
          signal_type: 'Mirror Debt',
          league,
          match: `${match.home_team} vs ${match.away_team}`,
          home_team: match.home_team,
          away_team: match.away_team,
          prediction: 'Over 1.5',
          confidence: 88,
          confidence_level: 'MEDIUM',
          target_market: 'Over 1.5',
          odds: match.over_odd,
          reasoning: `Mirror Debt: League had production vacuum yesterday. Goal debt accumulates.`,
          mirror_anchor: relevantAnchors.find(a => a.is_deadlock),
          block_time: match.block_time,
          created_at: new Date().toISOString(),
        });
        continue;
      }
    }
    
    // === SIGNAL E: EXIT 6 CAP (High Scoring Block) ===
    if (snapshot.is_exit_6_active && match.over_odd >= 1.40 && match.over_odd <= 1.57) {
      signals.push({
        id: `e6-${match.home_team}-${match.away_team}-${Date.now()}`,
        signal_type: 'Exit 6 Cap',
        league,
        match: `${match.home_team} vs ${match.away_team}`,
        home_team: match.home_team,
        away_team: match.away_team,
        prediction: 'Over 1.5',
        confidence: 90,
        confidence_level: 'HIGH',
        target_market: 'Over 1.5',
        odds: match.over_odd,
        reasoning: `Exit 6 Cap: Current block is in Goal Flush zone (avg ≥4.5 goals). High probability.`,
        block_time: match.block_time,
        created_at: new Date().toISOString(),
      });
    }
  }
  
  // Sort by confidence
  return signals.sort((a, b) => b.confidence - a.confidence);
}

// ============================================================================
// MAIN UNIVERSAL SCAN FUNCTION
// ============================================================================

// Perform universal scan across all leagues
export function performUniversalScan(
  results: Result[],
  odds: ParsedOdds[]
): UniversalScanResult {
  const currentBlockTime = getCurrentBlockTime();
  const previousBlockTime = getPreviousBlockTime(currentBlockTime);
  
  // Generate snapshots for each league
  const leagueSnapshots: Record<ScanLeague, LeagueSnapshot> = {
    GER: generateLeagueSnapshot('GER', results, currentBlockTime, previousBlockTime),
    ITA: generateLeagueSnapshot('ITA', results, currentBlockTime, previousBlockTime),
    SPA: generateLeagueSnapshot('SPA', results, currentBlockTime, previousBlockTime),
  };
  
  // Check for Global Flush
  const globalFlushActivated = checkGlobalFlush(leagueSnapshots);
  
  // Generate signals
  const signals = generateUniversalSignals(odds, leagueSnapshots, globalFlushActivated);
  
  // Get top 3 signals
  const top3Signals = signals.slice(0, 3);
  
  // Calculate global status
  const productionVacuums = Object.values(leagueSnapshots).filter(s => s.is_production_vacuum).length;
  const overProductionPeaks = Object.values(leagueSnapshots).filter(s => 
    s.mirror_anchors.some(a => a.is_blowout)
  ).length;
  
  return {
    signals,
    top_3_signals: top3Signals,
    global_status: {
      total_signals: signals.length,
      production_vacuums: productionVacuums,
      over_production_peaks: overProductionPeaks,
      global_flush_activated: globalFlushActivated,
      active_leagues: SCAN_LEAGUES,
    },
    league_snapshots: leagueSnapshots,
    scan_timestamp: new Date().toISOString(),
  };
}

// ============================================================================
// EXPORTS
// ============================================================================
// Functions are exported inline above (export function)
