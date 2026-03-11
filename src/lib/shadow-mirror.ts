// Shadow Mirror & Role Reversal Module for ONIMIX Eagle Eye Pick
// Analyzes 24-hour cycles to detect Team Switches and Production Gaps

import type { 
  Result, 
  ParsedOdds, 
  League, 
  MirrorAnchor, 
  TeamSwitchAnalysis, 
  ShadowMirrorPrediction,
} from './types';

// ============================================================================
// CONSTANTS
// ============================================================================

// Multi-league team arrays
export const LEAGUE_TEAMS: Record<League, string[]> = {
  GER: ['BMU', 'BVB', 'RBL', 'LEV', 'SGE', 'SCF', 'WOB', 'BMG', 'TSG', 'MAI', 'SVW', 'FCA', 'HDH', 'VFB', 'KOE', 'HSV', 'STP', 'UNI'],
  ITA: ['INT', 'JUV', 'ACM', 'NAP', 'ROM', 'LAZ', 'ATA', 'FIO', 'TOR', 'BFC', 'UDI', 'SAS', 'GEN', 'VER', 'LEC', 'CAG', 'EMP', 'MON', 'PAR', 'COM'],
  SPA: ['RMA', 'FCB', 'ATM', 'GIR', 'RSO', 'RBB', 'VIL', 'VCF', 'BIL', 'OSA', 'GET', 'RAY', 'SEV', 'MAL', 'CEL', 'ALA', 'GRA', 'LPA', 'CAD', 'ELC'],
};

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

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Get yesterday's date in YYYY-MM-DD format
export function getYesterdayDate(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().split('T')[0];
}

// Get today's date in YYYY-MM-DD format
export function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

// Check if a team is in a specific league
export function getTeamLeague(team: string): League | null {
  for (const [league, teams] of Object.entries(LEAGUE_TEAMS)) {
    if (teams.includes(team.toUpperCase())) {
      return league as League;
    }
  }
  return null;
}

// Validate odds are within acceptable ranges
export function validateOdds(odds: number, type: 'OVER_15' | 'UNDER_25'): boolean {
  const range = ODDS_VALIDATION[type];
  return odds >= range.min && odds <= range.max;
}

// Check if a match is a deadlock (0:0 or 1:0)
export function isDeadlock(homeGoals: number, awayGoals: number): boolean {
  return (homeGoals === 0 && awayGoals === 0) || 
         (homeGoals === 1 && awayGoals === 0) || 
         (homeGoals === 0 && awayGoals === 1);
}

// Check if a match is a blowout (6+ total goals)
export function isBlowout(homeGoals: number, awayGoals: number): boolean {
  return (homeGoals + awayGoals) >= 6;
}

// Calculate the total goal average for a specific block time across all leagues
export function calculateBlockGoalAverage(results: Result[], blockTime: string): number {
  const blockMatches = results.filter(r => r.block_time === blockTime);
  if (blockMatches.length === 0) return 0;
  const totalGoals = blockMatches.reduce((sum, r) => sum + r.total_goals, 0);
  return totalGoals / blockMatches.length;
}

// Check if block is in "Goal Flush" zone (high scoring) or "Defensive Lock" zone
export function getBlockZoneType(results: Result[], blockTime: string): 'goal_flush' | 'defensive_lock' | 'neutral' {
  const avgGoals = calculateBlockGoalAverage(results, blockTime);
  if (avgGoals >= 4.5) return 'goal_flush';
  if (avgGoals <= 1.5) return 'defensive_lock';
  return 'neutral';
}

// Get the team that was "dry" (scored 0 goals)
export function getDryTeam(homeGoals: number, awayGoals: number, homeTeam: string, awayTeam: string): string | null {
  if (homeGoals === 0) return homeTeam;
  if (awayGoals === 0) return awayTeam;
  return null;
}

// ============================================================================
// MIRROR ANCHOR DETECTION
// ============================================================================

// Find mirror anchors from yesterday's results
// A mirror anchor is either a Deadlock (0:0, 1:0) or Blowout (4:0, 3:1, 4:2)
export function findMirrorAnchors(results: Result[]): MirrorAnchor[] {
  const yesterday = getYesterdayDate();
  
  const mirrorAnchors: MirrorAnchor[] = [];
  
  for (const result of results) {
    // Only consider results from yesterday
    if (result.match_date !== yesterday) continue;
    
    const isDeadlockMatch = isDeadlock(result.home_goals, result.away_goals);
    const isBlowoutMatch = isBlowout(result.home_goals, result.away_goals);
    
    if (isDeadlockMatch || isBlowoutMatch) {
      const dryTeam = getDryTeam(result.home_goals, result.away_goals, result.home_team, result.away_team);
      const goalDebt = isDeadlockMatch ? Math.max(0, 2 - result.total_goals) : 0;
      
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
        goal_debt: goalDebt,
      });
    }
  }
  
  return mirrorAnchors;
}

// ============================================================================
// TEAM SWITCH ANALYSIS
// ============================================================================

// Analyze team switch based on yesterday's mirror anchor
export function analyzeTeamSwitch(
  mirrorAnchor: MirrorAnchor,
  todayTeam: string
): TeamSwitchAnalysis | null {
  const { is_deadlock, is_blowout, dry_team, home_team, away_team } = mirrorAnchor;
  
  // Normalize team name for comparison
  const normalizedToday = todayTeam.toUpperCase();
  const normalizedHome = home_team.toUpperCase();
  const normalizedAway = away_team.toUpperCase();
  
  // Check if this team was involved in yesterday's match
  const wasInvolved = normalizedToday === normalizedHome || normalizedToday === normalizedAway;
  if (!wasInvolved) return null;
  
  // A. Dry-to-Producer Switch (Over 1.5 Target)
  // Trigger: Yesterday was a Deadlock and this team scored 0
  if (is_deadlock && dry_team && dry_team.toUpperCase() === normalizedToday) {
    return {
      team: todayTeam,
      yesterday_role: 'dry',
      today_role: 'producer',
      switch_trigger: 'dry_to_producer',
      switch_confidence: 90,
      switch_reason: `Yesterday's deadlock (${mirrorAnchor.home_team} ${mirrorAnchor.home_goals}-${mirrorAnchor.away_goals} ${mirrorAnchor.away_team}) created goal debt. Team forced into producer role today.`,
    };
  }
  
  // B. Producer-to-Bait Switch (Under 2.5 Target)
  // Trigger: Yesterday was a Blowout and this team was high-scoring
  if (is_blowout) {
    const teamWasProducer = (normalizedToday === normalizedHome && mirrorAnchor.home_goals >= 3) ||
                            (normalizedToday === normalizedAway && mirrorAnchor.away_goals >= 3);
    
    if (teamWasProducer) {
      return {
        team: todayTeam,
        yesterday_role: 'producer',
        today_role: 'bait',
        switch_trigger: 'producer_to_bait',
        switch_confidence: 85,
        switch_reason: `Yesterday's blowout (${home_team} ${mirrorAnchor.home_goals}-${mirrorAnchor.away_goals} ${away_team}). Defensive lock enforced - team switched to low-scoring performance.`,
      };
    }
  }
  
  return null;
}

// ============================================================================
// BAYESIAN WEIGHTING
// ============================================================================

// Calculate weighted confidence using Bayesian approach
export function calculateBayesianConfidence(
  mirrorAnchorScore: number,    // 0-100 from mirror anchor analysis
  switchScore: number,           // 0-100 from team switch analysis
  formScore: number              // 0-100 from current form analysis
): number {
  const { MIRROR_ANCHOR, PRODUCTION_SWITCH, CURRENT_FORM } = BAYESIAN_WEIGHTS;
  
  const weightedScore = 
    (mirrorAnchorScore * MIRROR_ANCHOR) +
    (switchScore * PRODUCTION_SWITCH) +
    (formScore * CURRENT_FORM);
  
  return Math.round(weightedScore);
}

// ============================================================================
// SHADOW MIRROR PREDICTION
// ============================================================================

// Generate shadow mirror predictions for all leagues
export function generateShadowMirrorPredictions(
  results: Result[],
  odds: ParsedOdds[]
): ShadowMirrorPrediction[] {
  const predictions: ShadowMirrorPrediction[] = [];
  
  // Find mirror anchors from yesterday
  const mirrorAnchors = findMirrorAnchors(results);
  
  // Process each odds entry
  for (const match of odds) {
    const league = getTeamLeague(match.home_team) || getTeamLeague(match.away_team);
    if (!league) continue;
    
    // Get block zone type (Exit 6 cap)
    const blockZone = getBlockZoneType(results, match.block_time);
    
    // Try to find a mirror anchor involving these teams
    const relevantAnchors = mirrorAnchors.filter(
      anchor => 
        anchor.home_team.toLowerCase() === match.home_team.toLowerCase() ||
        anchor.away_team.toLowerCase() === match.away_team.toLowerCase() ||
        anchor.home_team.toLowerCase() === match.away_team.toLowerCase() ||
        anchor.away_team.toLowerCase() === match.home_team.toLowerCase()
    );
    
    // Check for team switches
    const homeSwitch = relevantAnchors
      .map(anchor => analyzeTeamSwitch(anchor, match.home_team))
      .find(s => s !== null);
    
    const awaySwitch = relevantAnchors
      .map(anchor => analyzeTeamSwitch(anchor, match.away_team))
      .find(s => s !== null);
    
    // Determine prediction based on team switches
    let prediction: 'Over 1.5' | 'Under 2.5' | null = null;
    let confidence = 0;
    let signalType: ShadowMirrorPrediction['signal_type'] = 'Mirror Anchor';
    let validated = false;
    let mirrorAnchor: MirrorAnchor | undefined;
    let teamSwitch: TeamSwitchAnalysis | undefined;
    
    // A. Dry-to-Producer Switch → Over 1.5
    if (homeSwitch?.switch_trigger === 'dry_to_producer' || awaySwitch?.switch_trigger === 'dry_to_producer') {
      prediction = 'Over 1.5';
      teamSwitch = homeSwitch || awaySwitch;
      let baseConfidence = (teamSwitch?.switch_confidence || 90) + 4; // +4 for Gap-Fill bonus
      
      // Apply Exit 6 cap adjustment
      if (blockZone === 'goal_flush') {
        baseConfidence += 10; // Bonus in high-scoring block
      } else if (blockZone === 'defensive_lock') {
        baseConfidence -= 15; // Penalty in defensive block
      }
      
      confidence = baseConfidence;
      signalType = homeSwitch?.switch_trigger === 'dry_to_producer' ? 'Gap-Fill' : 'New Producer';
      
      // Validate odds
      validated = validateOdds(match.over_odd, 'OVER_15');
      
      if (validated) {
        mirrorAnchor = relevantAnchors.find(a => a.is_deadlock);
      }
    }
    // B. Producer-to-Bait Switch → Under 2.5
    else if (homeSwitch?.switch_trigger === 'producer_to_bait' || awaySwitch?.switch_trigger === 'producer_to_bait') {
      prediction = 'Under 2.5';
      teamSwitch = homeSwitch || awaySwitch;
      let baseConfidence = (teamSwitch?.switch_confidence || 85) + 3; // +3 for Bait Switch bonus
      
      // Apply Exit 6 cap adjustment
      if (blockZone === 'defensive_lock') {
        baseConfidence += 10; // Bonus in defensive block
      } else if (blockZone === 'goal_flush') {
        baseConfidence -= 15; // Penalty in high-scoring block
      }
      
      confidence = baseConfidence;
      signalType = 'Bait Switch';
      
      // Validate odds
      validated = validateOdds(match.under_odd, 'UNDER_25');
      
      if (validated) {
        mirrorAnchor = relevantAnchors.find(a => a.is_blowout);
      }
    }
    // C. No switch - check for mirror anchor influence
    else if (relevantAnchors.length > 0) {
      const anchor = relevantAnchors[0];
      mirrorAnchor = anchor;
      
      // Use historical over rate at this block time as baseline
      const blockMatches = results.filter(r => r.block_time === match.block_time);
      const over15Rate = blockMatches.length > 0 
        ? (blockMatches.filter(r => r.over_15).length / blockMatches.length) * 100 
        : 50;
      
      // If yesterday was deadlock, lean toward Over 1.5
      if (anchor.is_deadlock && over15Rate >= 60) {
        prediction = 'Over 1.5';
        confidence = Math.round(over15Rate * 0.85);
        validated = validateOdds(match.over_odd, 'OVER_15');
        signalType = 'Mirror Anchor';
      }
      // If yesterday was blowout, lean toward Under 2.5
      else if (anchor.is_blowout && over15Rate <= 40) {
        prediction = 'Under 2.5';
        confidence = Math.round((100 - over15Rate) * 0.85);
        validated = validateOdds(match.under_odd, 'UNDER_25');
        signalType = 'Mirror Anchor';
      }
    }
    
    // Only add prediction if we have a valid one
    if (prediction && confidence > 0) {
      predictions.push({
        time: match.block_time,
        league,
        match: `${match.home_team} vs ${match.away_team}`,
        home_team: match.home_team,
        away_team: match.away_team,
        prediction,
        confidence,
        confidence_label: confidence >= 90 ? 'Very High' : confidence >= 80 ? 'High' : confidence >= 70 ? 'Medium' : 'Low',
        odds: prediction === 'Over 1.5' ? match.over_odd : match.under_odd,
        mirror_anchor: mirrorAnchor,
        team_switch: teamSwitch,
        signal_type: signalType,
        validated,
      });
    }
  }
  
  // Sort by confidence (highest first)
  return predictions.sort((a, b) => b.confidence - a.confidence);
}

// ============================================================================
// CURRENT FORM ANALYSIS
// ============================================================================

// Get current form score for a team (0-100)
export function getCurrentFormScore(results: Result[], team: string): number {
  const teamMatches = results.filter(
    r => r.home_team.toLowerCase() === team.toLowerCase() ||
         r.away_team.toLowerCase() === team.toLowerCase()
  );
  
  if (teamMatches.length === 0) return 50; // Default neutral
  
  // Get last 5 matches
  const last5 = teamMatches.slice(0, 5);
  const overCount = last5.filter(r => r.over_15).length;
  
  return (overCount / last5.length) * 100;
}

// ============================================================================
// EXPORT DEFAULT CONFIG
// ============================================================================

const shadowMirrorExports = {
  LEAGUE_TEAMS,
  ODDS_VALIDATION,
  BAYESIAN_WEIGHTS,
  getYesterdayDate,
  getTodayDate,
  getTeamLeague,
  validateOdds,
  isDeadlock,
  isBlowout,
  getDryTeam,
  calculateBlockGoalAverage,
  getBlockZoneType,
  findMirrorAnchors,
  analyzeTeamSwitch,
  calculateBayesianConfidence,
  generateShadowMirrorPredictions,
  getCurrentFormScore,
};

export default shadowMirrorExports;
