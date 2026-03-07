// Pattern Detection Module for ONIMIX Eagle Eye Pick
// Detects streaks, trends, and patterns in virtual football results

import type { Result } from './types';

export interface StreakInfo {
  currentStreak: number;
  streakType: 'over' | 'under' | 'none';
  longestOverStreak: number;
  longestUnderStreak: number;
}

export interface RecentForm {
  last5: boolean[]; // true = over, false = under
  last5OverRate: number;
  last10OverRate: number;
  trend: 'improving' | 'declining' | 'stable';
}

export interface DayOfWeekStats {
  day: string;
  totalMatches: number;
  overRate: number;
  avgGoals: number;
}

export interface BounceBackProbability {
  after1Under: number;
  after2Unders: number;
  after3Unders: number;
  after1Over: number;
  after2Overs: number;
  after3Overs: number;
}

export interface BlockTimePattern {
  blockTime: string;
  recentOverRate: number; // Last 10 matches
  historicalOverRate: number; // All time
  trend: 'hot' | 'cold' | 'neutral';
  streakInfo: StreakInfo;
}

export interface TeamSwitchPattern {
  teamName: string;
  currentBlockTime: string;
  overRateAtCurrentBlock: number; // Team's over rate at this block time
  overRateAtOtherBlocks: number; // Team's over rate at other block times
  switchImpact: number; // How much better/worse they perform after switching
  recentSwitchForm: boolean[]; // Results after recent block time switches
  switchOverRate: number; // Over rate when playing at current block
  avgGoalsAtCurrentBlock: number;
  matchesAtCurrentBlock: number;
}

export interface PatternAnalysis {
  streakInfo: StreakInfo;
  recentForm: RecentForm;
  dayOfWeekStats: DayOfWeekStats[];
  bounceBack: BounceBackProbability;
  blockTimePattern: BlockTimePattern;
  teamSwitchPattern?: TeamSwitchPattern;
  patternScore: number; // -100 to +100, positive = likely over
  confidenceBoost: number; // Adjustment to apply to base probability
}

// Detect current streak and historical streaks
export function detectStreak(results: Result[]): StreakInfo {
  if (results.length === 0) {
    return {
      currentStreak: 0,
      streakType: 'none',
      longestOverStreak: 0,
      longestUnderStreak: 0,
    };
  }

  // Sort by date/time, most recent first
  const sorted = [...results].sort((a, b) => {
    const dateA = a.match_date || '';
    const dateB = b.match_date || '';
    if (dateA !== dateB) return dateB.localeCompare(dateA);
    return b.block_time.localeCompare(a.block_time);
  });

  let currentStreak = 0;
  let streakType: 'over' | 'under' | 'none' = 'none';
  let longestOverStreak = 0;
  let longestUnderStreak = 0;

  // Detect current streak
  const firstResult = sorted[0];
  if (firstResult) {
    streakType = firstResult.over_15 ? 'over' : 'under';
    currentStreak = 1;

    for (let i = 1; i < sorted.length; i++) {
      const result = sorted[i];
      if (!result) break;
      
      if ((streakType === 'over' && result.over_15) || 
          (streakType === 'under' && !result.over_15)) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  // Calculate longest streaks
  let tempOverStreak = 0;
  let tempUnderStreak = 0;

  for (const result of sorted) {
    if (result.over_15) {
      tempOverStreak++;
      tempUnderStreak = 0;
      longestOverStreak = Math.max(longestOverStreak, tempOverStreak);
    } else {
      tempUnderStreak++;
      tempOverStreak = 0;
      longestUnderStreak = Math.max(longestUnderStreak, tempUnderStreak);
    }
  }

  return {
    currentStreak,
    streakType,
    longestOverStreak,
    longestUnderStreak,
  };
}

// Analyze recent form (last 5 and 10 matches)
export function analyzeRecentForm(results: Result[]): RecentForm {
  if (results.length === 0) {
    return {
      last5: [],
      last5OverRate: 0,
      last10OverRate: 0,
      trend: 'stable',
    };
  }

  // Sort by date/time, most recent first
  const sorted = [...results].sort((a, b) => {
    const dateA = a.match_date || '';
    const dateB = b.match_date || '';
    if (dateA !== dateB) return dateB.localeCompare(dateA);
    return b.block_time.localeCompare(a.block_time);
  });

  const last5 = sorted.slice(0, 5).map(r => r.over_15);
  const last10 = sorted.slice(0, 10).map(r => r.over_15);

  const last5OverRate = last5.length > 0 ? (last5.filter(Boolean).length / last5.length) * 100 : 0;
  const last10OverRate = last10.length > 0 ? (last10.filter(Boolean).length / last10.length) * 100 : 0;

  // Determine trend by comparing first 5 to last 5 of last 10
  let trend: 'improving' | 'declining' | 'stable' = 'stable';
  if (last10.length >= 10) {
    const first5Of10 = last10.slice(5, 10);
    const last5Of10 = last10.slice(0, 5);
    const first5Rate = (first5Of10.filter(Boolean).length / 5) * 100;
    const last5Rate = (last5Of10.filter(Boolean).length / 5) * 100;
    
    if (last5Rate > first5Rate + 15) {
      trend = 'improving';
    } else if (last5Rate < first5Rate - 15) {
      trend = 'declining';
    }
  }

  return {
    last5,
    last5OverRate,
    last10OverRate,
    trend,
  };
}

// Analyze day of week patterns
export function analyzeDayOfWeek(results: Result[]): DayOfWeekStats[] {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayStats: Map<string, { total: number; overs: number; goals: number }> = new Map();

  // Initialize all days
  dayNames.forEach(day => {
    dayStats.set(day, { total: 0, overs: 0, goals: 0 });
  });

  // Aggregate by day
  for (const result of results) {
    if (result.match_date) {
      const date = new Date(result.match_date);
      const dayName = dayNames[date.getDay()];
      const stats = dayStats.get(dayName);
      if (stats) {
        stats.total++;
        if (result.over_15) stats.overs++;
        stats.goals += result.total_goals;
      }
    }
  }

  // Convert to output format
  return dayNames.map(day => {
    const stats = dayStats.get(day)!;
    return {
      day,
      totalMatches: stats.total,
      overRate: stats.total > 0 ? (stats.overs / stats.total) * 100 : 0,
      avgGoals: stats.total > 0 ? stats.goals / stats.total : 0,
    };
  });
}

// Calculate bounce-back probability (after N unders/overs)
export function calculateBounceBack(results: Result[]): BounceBackProbability {
  // Sort by date/time, oldest first
  const sorted = [...results].sort((a, b) => {
    const dateA = a.match_date || '';
    const dateB = b.match_date || '';
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    return a.block_time.localeCompare(b.block_time);
  });

  // Track sequences and outcomes
  const after1Under: boolean[] = [];
  const after2Unders: boolean[] = [];
  const after3Unders: boolean[] = [];
  const after1Over: boolean[] = [];
  const after2Overs: boolean[] = [];
  const after3Overs: boolean[] = [];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const prev1 = sorted[i - 1];
    
    if (!current || !prev1) continue;

    // After 1 under
    if (!prev1.over_15) {
      after1Under.push(current.over_15);
      
      // After 2 unders
      if (i >= 2) {
        const prev2 = sorted[i - 2];
        if (prev2 && !prev2.over_15) {
          after2Unders.push(current.over_15);
          
          // After 3 unders
          if (i >= 3) {
            const prev3 = sorted[i - 3];
            if (prev3 && !prev3.over_15) {
              after3Unders.push(current.over_15);
            }
          }
        }
      }
    }

    // After 1 over
    if (prev1.over_15) {
      after1Over.push(current.over_15);
      
      // After 2 overs
      if (i >= 2) {
        const prev2 = sorted[i - 2];
        if (prev2 && prev2.over_15) {
          after2Overs.push(current.over_15);
          
          // After 3 overs
          if (i >= 3) {
            const prev3 = sorted[i - 3];
            if (prev3 && prev3.over_15) {
              after3Overs.push(current.over_15);
            }
          }
        }
      }
    }
  }

  const calcRate = (arr: boolean[]) => arr.length > 0 ? (arr.filter(Boolean).length / arr.length) * 100 : 0;

  return {
    after1Under: calcRate(after1Under),
    after2Unders: calcRate(after2Unders),
    after3Unders: calcRate(after3Unders),
    after1Over: calcRate(after1Over),
    after2Overs: calcRate(after2Overs),
    after3Overs: calcRate(after3Overs),
  };
}

// Analyze block time patterns
export function analyzeBlockTimePattern(results: Result[], blockTime: string): BlockTimePattern {
  const blockMatches = results.filter(r => r.block_time === blockTime);
  
  // Sort by date, most recent first
  const sorted = [...blockMatches].sort((a, b) => {
    const dateA = a.match_date || '';
    const dateB = b.match_date || '';
    return dateB.localeCompare(dateA);
  });

  const recent10 = sorted.slice(0, 10);
  const recentOverRate = recent10.length > 0 
    ? (recent10.filter(r => r.over_15).length / recent10.length) * 100 
    : 0;
  
  const historicalOverRate = blockMatches.length > 0
    ? (blockMatches.filter(r => r.over_15).length / blockMatches.length) * 100
    : 0;

  // Determine trend
  let trend: 'hot' | 'cold' | 'neutral' = 'neutral';
  if (recentOverRate > historicalOverRate + 10) {
    trend = 'hot';
  } else if (recentOverRate < historicalOverRate - 10) {
    trend = 'cold';
  }

  const streakInfo = detectStreak(blockMatches);

  return {
    blockTime,
    recentOverRate,
    historicalOverRate,
    trend,
    streakInfo,
  };
}

// Analyze team switch patterns - how teams perform when switching block times
export function analyzeTeamSwitch(
  results: Result[], 
  homeTeam: string, 
  awayTeam: string, 
  targetBlockTime: string
): TeamSwitchPattern | null {
  // Get all matches for both teams
  const teamMatches = results.filter(
    r => r.home_team.toLowerCase() === homeTeam.toLowerCase() ||
         r.away_team.toLowerCase() === homeTeam.toLowerCase() ||
         r.home_team.toLowerCase() === awayTeam.toLowerCase() ||
         r.away_team.toLowerCase() === awayTeam.toLowerCase()
  );

  if (teamMatches.length < 3) {
    return null; // Not enough data
  }

  // Sort by date/time
  const sorted = [...teamMatches].sort((a, b) => {
    const dateA = a.match_date || '';
    const dateB = b.match_date || '';
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    return a.block_time.localeCompare(b.block_time);
  });

  // Find matches at the target block time
  const currentBlockMatches = sorted.filter(r => r.block_time === targetBlockTime);
  const otherBlockMatches = sorted.filter(r => r.block_time !== targetBlockTime);

  // Calculate over rate at current block
  const overRateAtCurrent = currentBlockMatches.length > 0
    ? (currentBlockMatches.filter(r => r.over_15).length / currentBlockMatches.length) * 100
    : 0;

  // Calculate over rate at other blocks
  const overRateAtOther = otherBlockMatches.length > 0
    ? (otherBlockMatches.filter(r => r.over_15).length / otherBlockMatches.length) * 100
    : 0;

  // Calculate average goals at current block
  const avgGoalsCurrent = currentBlockMatches.length > 0
    ? currentBlockMatches.reduce((sum, r) => sum + r.total_goals, 0) / currentBlockMatches.length
    : 0;

  // Analyze recent switch form (last 5 matches at this block time)
  const recentSwitchForm = currentBlockMatches
    .slice(0, 5)
    .map(r => r.over_15);

  // Switch impact: positive = team performs better at this block
  const switchImpact = overRateAtCurrent - overRateAtOther;

  return {
    teamName: `${homeTeam} vs ${awayTeam}`,
    currentBlockTime: targetBlockTime,
    overRateAtCurrentBlock: Math.round(overRateAtCurrent * 10) / 10,
    overRateAtOtherBlocks: Math.round(overRateAtOther * 10) / 10,
    switchImpact: Math.round(switchImpact * 10) / 10,
    recentSwitchForm,
    switchOverRate: Math.round(overRateAtCurrent * 10) / 10,
    avgGoalsAtCurrentBlock: Math.round(avgGoalsCurrent * 10) / 10,
    matchesAtCurrentBlock: currentBlockMatches.length,
  };
}

// Calculate overall pattern score and confidence boost
export function calculatePatternScore(
  streakInfo: StreakInfo,
  recentForm: RecentForm,
  blockTimePattern: BlockTimePattern,
  bounceBack: BounceBackProbability,
  teamSwitch?: TeamSwitchPattern | null
): { patternScore: number; confidenceBoost: number } {
  let score = 0;

  // Streak analysis (max ±30 points)
  // If we're in an under streak, probability of over increases (regression to mean)
  if (streakInfo.streakType === 'under') {
    score += Math.min(30, streakInfo.currentStreak * 10); // +10 per under, max +30
  } else if (streakInfo.streakType === 'over') {
    score -= Math.min(20, streakInfo.currentStreak * 5); // -5 per over, max -20
  }

  // Recent form (max ±25 points)
  if (recentForm.trend === 'improving') {
    score += 15;
  } else if (recentForm.trend === 'declining') {
    score -= 15;
  }
  
  // Compare recent to historical
  if (recentForm.last5OverRate < 40) {
    score += 10; // Due for bounce back
  } else if (recentForm.last5OverRate > 80) {
    score -= 10; // Due for regression
  }

  // Block time pattern (max ±20 points)
  if (blockTimePattern.trend === 'hot') {
    score += 10;
  } else if (blockTimePattern.trend === 'cold') {
    score += 15; // Cold blocks due for regression
  }

  // Block time streak
  if (blockTimePattern.streakInfo.streakType === 'under') {
    score += Math.min(10, blockTimePattern.streakInfo.currentStreak * 5);
  }

  // Bounce back probability (max ±25 points)
  // If bounce back after 2+ unders is high, boost confidence
  if (streakInfo.streakType === 'under' && streakInfo.currentStreak >= 2) {
    const bounceRate = streakInfo.currentStreak >= 3 
      ? bounceBack.after3Unders 
      : bounceBack.after2Unders;
    if (bounceRate > 70) {
      score += 20;
    } else if (bounceRate > 60) {
      score += 10;
    }
  }

  // Team switch analysis (max ±25 points)
  if (teamSwitch && teamSwitch.matchesAtCurrentBlock >= 3) {
    // Positive switch impact means team performs better at this block time
    if (teamSwitch.switchImpact > 15) {
      score += 20; // Strong preference for this block time
    } else if (teamSwitch.switchImpact > 5) {
      score += 10; // Moderate preference
    } else if (teamSwitch.switchImpact < -15) {
      score -= 20; // Team performs worse at this block time
    } else if (teamSwitch.switchImpact < -5) {
      score -= 10; // Slightly worse
    }

    // Recent switch form matters too
    if (teamSwitch.recentSwitchForm.length >= 3) {
      const recentOverRate = (teamSwitch.recentSwitchForm.filter(Boolean).length / teamSwitch.recentSwitchForm.length) * 100;
      if (recentOverRate >= 80) {
        score += 10; // Hot at this block time
      } else if (recentOverRate < 40) {
        score -= 10; // Cold at this block time
      }
    }
  }

  // Clamp score to -100 to +100
  const patternScore = Math.max(-100, Math.min(100, score));
  
  // Convert to confidence boost (-15 to +15 percentage points)
  const confidenceBoost = Math.round(patternScore * 0.15);

  return { patternScore, confidenceBoost };
}

// Main function: Full pattern analysis
export function analyzePatterns(
  results: Result[], 
  blockTime: string,
  homeTeam?: string,
  awayTeam?: string
): PatternAnalysis {
  const streakInfo = detectStreak(results);
  const recentForm = analyzeRecentForm(results);
  const dayOfWeekStats = analyzeDayOfWeek(results);
  const bounceBack = calculateBounceBack(results);
  const blockTimePattern = analyzeBlockTimePattern(results, blockTime);
  
  // Analyze team switch patterns if teams are provided
  const teamSwitchPattern = (homeTeam && awayTeam) 
    ? analyzeTeamSwitch(results, homeTeam, awayTeam, blockTime) ?? undefined
    : undefined;
  
  const { patternScore, confidenceBoost } = calculatePatternScore(
    streakInfo,
    recentForm,
    blockTimePattern,
    bounceBack,
    teamSwitchPattern
  );

  return {
    streakInfo,
    recentForm,
    dayOfWeekStats,
    bounceBack,
    blockTimePattern,
    teamSwitchPattern,
    patternScore,
    confidenceBoost,
  };
}
