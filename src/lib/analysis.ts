import type { Result, ParsedOdds, Prediction, HistoricalStats, TeamStats, ParsedResult } from './types';
import { analyzePatterns, type PatternAnalysis } from './pattern-detection';

// Check if a team name is valid (must contain at least one letter)
export function isValidTeamName(name: string): boolean {
  // Team name must contain at least one letter (a-z or A-Z)
  return /[a-zA-Z]/.test(name);
}

// Convert timestamp to block time (HH:MM format)
export function timestampToBlockTime(timestamp: number): string {
  const date = new Date(timestamp);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

// Parse setScore string "2:1" to goals
export function parseScore(score: string): { homeGoals: number; awayGoals: number } {
  const parts = score.split(':');
  if (parts.length !== 2) {
    return { homeGoals: 0, awayGoals: 0 };
  }
  const homeGoals = parseInt(parts[0], 10) || 0;
  const awayGoals = parseInt(parts[1], 10) || 0;
  return { homeGoals, awayGoals };
}

// Calculate team statistics
export function calculateTeamStats(results: Result[], teamName: string): TeamStats & { over15Rate: number } {
  const teamMatches = results.filter(
    r => r.home_team.toLowerCase() === teamName.toLowerCase() ||
         r.away_team.toLowerCase() === teamName.toLowerCase()
  );

  if (teamMatches.length === 0) {
    return { avgScored: 0, avgConceded: 0, matchesPlayed: 0, over15Rate: 0 };
  }

  let goalsScored = 0;
  let goalsConceded = 0;
  let over15Count = 0;

  teamMatches.forEach(match => {
    if (match.over_15) {
      over15Count++;
    }
    
    if (match.home_team.toLowerCase() === teamName.toLowerCase()) {
      goalsScored += match.home_goals;
      goalsConceded += match.away_goals;
    } else {
      goalsScored += match.away_goals;
      goalsConceded += match.home_goals;
    }
  });

  return {
    avgScored: goalsScored / teamMatches.length,
    avgConceded: goalsConceded / teamMatches.length,
    matchesPlayed: teamMatches.length,
    over15Rate: (over15Count / teamMatches.length) * 100,
  };
}

// Calculate historical stats for a specific block time
export function calculateBlockTimeStats(results: Result[], blockTime: string): HistoricalStats {
  const blockMatches = results.filter(r => r.block_time === blockTime);

  if (blockMatches.length === 0) {
    return { totalMatches: 0, avgGoals: 0, over15Rate: 0, over25Rate: 0 };
  }

  const totalGoals = blockMatches.reduce((sum, r) => sum + r.total_goals, 0);
  const over15Count = blockMatches.filter(r => r.over_15).length;
  const over25Count = blockMatches.filter(r => r.over_25).length;

  return {
    totalMatches: blockMatches.length,
    avgGoals: totalGoals / blockMatches.length,
    over15Rate: (over15Count / blockMatches.length) * 100,
    over25Rate: (over25Count / blockMatches.length) * 100,
  };
}

// Determine prediction based on analysis with pattern detection
export function analyzeMatch(
  match: ParsedOdds,
  results: Result[]
): Prediction & { patternAnalysis?: PatternAnalysis } {
  // Get historical stats for this block time
  const historicalStats = calculateBlockTimeStats(results, match.block_time);
  
  // Get team stats for both teams
  const homeTeamStats = calculateTeamStats(results, match.home_team);
  const awayTeamStats = calculateTeamStats(results, match.away_team);

  // Calculate average team stats
  const teamAvgScored = (homeTeamStats.avgScored + awayTeamStats.avgScored) / 2;
  const teamAvgConceded = (homeTeamStats.avgConceded + awayTeamStats.avgConceded) / 2;
  const teamAvgOver15Rate = (homeTeamStats.over15Rate + awayTeamStats.over15Rate) / 2;

  // Calculate expected goals based on team stats
  const expectedGoals = teamAvgScored + teamAvgConceded;
  
  // Run pattern detection with team information for team switch analysis
  const patternAnalysis = analyzePatterns(
    results, 
    match.block_time,
    match.home_team,
    match.away_team
  );
  
  // Apply pattern-based confidence boost to historical rate
  const adjustedOver15Rate = Math.max(0, Math.min(100, 
    historicalStats.over15Rate + patternAnalysis.confidenceBoost
  ));
  
  // Decision rules - use ADJUSTED rate that includes pattern detection
  const isSafe = 
    adjustedOver15Rate >= 75 && 
    historicalStats.avgGoals >= 2.2 && 
    expectedGoals >= 2.0 &&
    teamAvgOver15Rate >= 65 &&
    historicalStats.totalMatches >= 10;
    
  const isModerate = 
    adjustedOver15Rate >= 60 && 
    historicalStats.avgGoals >= 1.8 && 
    expectedGoals >= 1.5 &&
    teamAvgOver15Rate >= 55 &&
    historicalStats.totalMatches >= 5;
  
  let prediction: 'OVER 1.5' | 'LOW CONFIDENCE';
  let confidence: number;
  let status: 'SAFE' | 'MODERATE' | 'RISKY';

  if (isSafe) {
    prediction = 'OVER 1.5';
    confidence = Math.min(95, Math.round(adjustedOver15Rate));
    status = 'SAFE';
  } else if (isModerate) {
    prediction = 'OVER 1.5';
    confidence = Math.round(adjustedOver15Rate);
    status = 'MODERATE';
  } else {
    prediction = 'LOW CONFIDENCE';
    confidence = Math.max(0, Math.round(adjustedOver15Rate));
    status = 'RISKY';
  }

  return {
    match,
    historicalStats,
    teamStats: {
      avgScored: teamAvgScored,
      avgConceded: teamAvgConceded,
      matchesPlayed: Math.min(homeTeamStats.matchesPlayed, awayTeamStats.matchesPlayed),
      over15Rate: teamAvgOver15Rate,
    },
    prediction,
    confidence,
    status,
    patternAnalysis,
  };
}

// Validate JSON structure
export function validateSportyJson(data: unknown): { valid: boolean; error?: string } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Invalid JSON structure' };
  }

  const obj = data as Record<string, unknown>;
  
  if (typeof obj.bizCode !== 'number') {
    return { valid: false, error: 'Missing bizCode' };
  }

  if (!obj.data || typeof obj.data !== 'object') {
    return { valid: false, error: 'Missing data object' };
  }

  const dataObj = obj.data as Record<string, unknown>;
  
  if (!Array.isArray(dataObj.tournaments)) {
    return { valid: false, error: 'Missing or invalid tournaments array' };
  }

  return { valid: true };
}

// Parse odds from tab-separated string
// New simplified format: Date, Time, Home, Away, Over, Under
export function parseOddsInput(input: string): { valid: boolean; data?: ParsedOdds[]; error?: string } {
  const lines = input.trim().split('\n');
  
  if (lines.length < 2) {
    return { valid: false, error: 'No data rows found. Please include header and at least one data row.' };
  }

  // Skip header row
  const dataLines = lines.slice(1);
  const parsedOdds: ParsedOdds[] = [];

  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i].trim();
    if (!line) continue;

    const parts = line.split('\t');
    
    // New format: Date, Time, Home, Away, Over, Under (6 columns)
    if (parts.length < 6) {
      return { valid: false, error: `Line ${i + 2}: Expected 6 columns, got ${parts.length}. Format: Date, Time, Home, Away, Over, Under` };
    }
    
    const dateCol = parts[0].trim();
    const timeCol = parts[1].trim();
    const homeTeam = parts[2].trim();
    const awayTeam = parts[3].trim();
    const overOdd = parseFloat(parts[4]);
    const underOdd = parseFloat(parts[5]);

    if (isNaN(overOdd) || isNaN(underOdd)) {
      return { valid: false, error: `Line ${i + 2}: Invalid numeric values for Over/Under odds` };
    }

    if (!timeCol || !homeTeam || !awayTeam) {
      return { valid: false, error: `Line ${i + 2}: Missing required fields` };
    }

    // Validate team names - must contain at least one letter
    if (!isValidTeamName(homeTeam)) {
      return { valid: false, error: `Line ${i + 2}: Invalid home team name "${homeTeam}" - team names must contain letters` };
    }
    if (!isValidTeamName(awayTeam)) {
      return { valid: false, error: `Line ${i + 2}: Invalid away team name "${awayTeam}" - team names must contain letters` };
    }

    // Parse date to ISO format (DD/MM/YYYY -> YYYY-MM-DD)
    let matchDate: string | undefined;
    if (dateCol) {
      const dateParts = dateCol.split('/');
      if (dateParts.length === 3) {
        const day = dateParts[0].padStart(2, '0');
        const month = dateParts[1].padStart(2, '0');
        const year = dateParts[2];
        matchDate = `${year}-${month}-${day}`;
      }
    }

    parsedOdds.push({
      block_time: timeCol,
      home_team: homeTeam,
      away_team: awayTeam,
      over_odd: overOdd,
      under_odd: underOdd,
      match_date: matchDate,
    });
  }

  if (parsedOdds.length === 0) {
    return { valid: false, error: 'No valid data rows found' };
  }

  return { valid: true, data: parsedOdds };
}

// Parse tab or comma-separated results input
// Old format: "08:24\tLEV 0-2 HSV" or "08:24,LEV 0-2 HSV"
// New format: "26/01/2026\t08:24\tLEV 0-2 HSV" (with date)
export function parseResultsInput(input: string, league?: string): { valid: boolean; data?: ParsedResult[]; error?: string } {
  const lines = input.trim().split('\n');
  const parsedResults: ParsedResult[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Split by tab or comma
    const parts = line.split(/[\t,]/);
    
    // Detect format: if first part looks like a date (DD/MM/YYYY), use new format
    let dateCol: string | undefined;
    let timeCol: string;
    let resultCol: string;
    
    const firstPart = parts[0].trim();
    const datePattern = /^\d{1,2}\/\d{1,2}\/\d{4}$/;
    
    if (datePattern.test(firstPart)) {
      // New format: Date, Time, Result
      if (parts.length < 3) {
        return { valid: false, error: `Line ${i + 1}: Expected Date, Time, Result format` };
      }
      dateCol = firstPart;
      timeCol = parts[1].trim();
      resultCol = parts[2].trim();
    } else {
      // Old format: Time, Result
      if (parts.length < 2) {
        return { valid: false, error: `Line ${i + 1}: Missing separator between time and result (use tab or comma)` };
      }
      timeCol = firstPart;
      resultCol = parts[1].trim();
    }

    // Parse result "LEV 0-2 HSV" to get teams and score
    // Format: TEAM_A GOAL-GOAL TEAM_B
    const resultParts = resultCol.split(/\s+/);
    if (resultParts.length !== 3) {
      return { valid: false, error: `Line ${i + 1}: Invalid result format. Expected "TEAM GOAL-GOAL TEAM"` };
    }

    const homeTeam = resultParts[0];
    const score = resultParts[1];
    const awayTeam = resultParts[2];

    // Parse score "0-2" to goals
    const scoreParts = score.split('-');
    if (scoreParts.length !== 2) {
      return { valid: false, error: `Line ${i + 1}: Invalid score format. Expected "GOAL-GOAL"` };
    }

    const homeGoals = parseInt(scoreParts[0], 10);
    const awayGoals = parseInt(scoreParts[1], 10);

    if (isNaN(homeGoals) || isNaN(awayGoals)) {
      return { valid: false, error: `Line ${i + 1}: Invalid score values` };
    }

    if (!timeCol || !homeTeam || !awayTeam) {
      return { valid: false, error: `Line ${i + 1}: Missing required fields` };
    }

    // Validate team names - must contain at least one letter
    if (!isValidTeamName(homeTeam)) {
      return { valid: false, error: `Line ${i + 1}: Invalid home team name "${homeTeam}" - team names must contain letters` };
    }
    if (!isValidTeamName(awayTeam)) {
      return { valid: false, error: `Line ${i + 1}: Invalid away team name "${awayTeam}" - team names must contain letters` };
    }

    const totalGoals = homeGoals + awayGoals;

    // Parse date to ISO format (DD/MM/YYYY -> YYYY-MM-DD)
    let matchDate: string | undefined;
    if (dateCol) {
      const dateParts = dateCol.split('/');
      if (dateParts.length === 3) {
        const day = dateParts[0].padStart(2, '0');
        const month = dateParts[1].padStart(2, '0');
        const year = dateParts[2];
        matchDate = `${year}-${month}-${day}`;
      }
    }

    parsedResults.push({
      league: league || 'GER',
      block_time: timeCol,
      home_team: homeTeam,
      away_team: awayTeam,
      home_goals: homeGoals,
      away_goals: awayGoals,
      total_goals: totalGoals,
      over_15: totalGoals >= 2,
      over_25: totalGoals >= 3,
      match_date: matchDate,
    });
  }

  if (parsedResults.length === 0) {
    return { valid: false, error: 'No valid data rows found' };
  }

  return { valid: true, data: parsedResults };
}
