import { createClient } from '@supabase/supabase-js';
import type { Result, Odds, PredictionRecord, PerformanceMetrics, ProbabilityBands, Over25Result, UpcomingMatch, BucketStats, OddsPattern } from './types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Support both anon key and publishable key variable names
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
                    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

// Validate URL format before creating client
function isValidUrl(url: string | undefined): url is string {
  if (!url) return false;
  try {
    new URL(url);
    return url.startsWith('http://') || url.startsWith('https://');
  } catch {
    return false;
  }
}

// Only create client if both variables are valid
export const supabase = isValidUrl(supabaseUrl) && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null;

if (!supabase) {
  console.warn('Missing or invalid Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY)');
}

// Results operations
export async function insertResults(results: Omit<Result, 'id' | 'created_at'>[]): Promise<{ success: boolean; error?: string; count: number; duplicates?: number }> {
  if (!supabase) {
    return { success: false, error: 'Supabase client not initialized', count: 0 };
  }

  try {
    // Use upsert to handle duplicates
    const { data, error } = await supabase
      .from('results')
      .upsert(results, { 
        onConflict: 'block_time,home_team,away_team,home_goals,away_goals',
        ignoreDuplicates: true 
      })
      .select();

    if (error) {
      console.error('Error inserting results:', error);
      return { success: false, error: error.message, count: 0 };
    }

    // Return actual inserted count (data contains only inserted rows)
    const insertedCount = data ? data.length : 0;
    const duplicatesCount = results.length - insertedCount;

    return { 
      success: true, 
      count: insertedCount, 
      duplicates: duplicatesCount > 0 ? duplicatesCount : undefined 
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error inserting results:', errorMessage);
    return { success: false, error: errorMessage, count: 0 };
  }
}

export async function getAllResults(): Promise<Result[]> {
  if (!supabase) {
    console.warn('Supabase client not initialized');
    return [];
  }

  try {
    // Fetch all results using pagination (Supabase default limit is 1000)
    const allResults: Result[] = [];
    let page = 0;
    const pageSize = 1000;
    
    while (true) {
      const { data, error } = await supabase
        .from('results')
        .select('*')
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) {
        console.error('Error fetching results:', error);
        break;
      }

      if (!data || data.length === 0) {
        break;
      }

      allResults.push(...data);

      // If we got less than pageSize, we've reached the end
      if (data.length < pageSize) {
        break;
      }

      page++;
    }

    return allResults;
  } catch (error) {
    console.error('Error fetching results:', error);
    return [];
  }
}

export async function getResultsByBlockTime(blockTime: string): Promise<Result[]> {
  if (!supabase) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('results')
      .select('*')
      .eq('block_time', blockTime);

    if (error) {
      console.error('Error fetching results by block time:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching results by block time:', error);
    return [];
  }
}

export async function getResultsByTeam(teamName: string): Promise<Result[]> {
  if (!supabase) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('results')
      .select('*')
      .or(`home_team.ilike.%${teamName}%,away_team.ilike.%${teamName}%`);

    if (error) {
      console.error('Error fetching results by team:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching results by team:', error);
    return [];
  }
}

// Get results by date range (for efficient Shadow Mirror queries)
export async function getResultsByDateRange(
  startDate: string, 
  endDate: string
): Promise<Result[]> {
  if (!supabase) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('results')
      .select('*')
      .gte('match_date', startDate)
      .lte('match_date', endDate)
      .order('match_date', { ascending: true });

    if (error) {
      console.error('Error fetching results by date range:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching results by date range:', error);
    return [];
  }
}

// Get yesterday's results specifically (optimized for Shadow Mirror)
export async function getYesterdayResults(): Promise<Result[]> {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  
  return getResultsByDateRange(yesterdayStr, yesterdayStr);
}

// Odds operations
export async function insertOdds(oddsList: Omit<Odds, 'id' | 'created_at'>[]): Promise<{ success: boolean; error?: string; count: number }> {
  if (!supabase) {
    return { success: false, error: 'Supabase client not initialized', count: 0 };
  }

  try {
    const { data, error } = await supabase
      .from('odds')
      .insert(oddsList)
      .select();

    if (error) {
      console.error('Error inserting odds:', error);
      return { success: false, error: error.message, count: 0 };
    }

    return { success: true, count: oddsList.length };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error inserting odds:', errorMessage);
    return { success: false, error: errorMessage, count: 0 };
  }
}

export async function getAllOdds(): Promise<Odds[]> {
  if (!supabase) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('odds')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching odds:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching odds:', error);
    return [];
  }
}

export async function clearOdds(): Promise<{ success: boolean; error?: string }> {
  if (!supabase) {
    return { success: false, error: 'Supabase client not initialized' };
  }

  try {
    const { error } = await supabase
      .from('odds')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (error) {
      console.error('Error clearing odds:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error clearing odds:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

// Statistics
export async function getHistoricalStats(): Promise<{
  totalMatches: number;
  avgGoals: number;
  over15Rate: number;
  over25Rate: number;
}> {
  if (!supabase) {
    return { totalMatches: 0, avgGoals: 0, over15Rate: 0, over25Rate: 0 };
  }

  try {
    // Fetch all results using pagination for accurate stats
    const allData: Array<{ total_goals: number; over_15: boolean; over_25: boolean }> = [];
    let page = 0;
    const pageSize = 1000;
    
    while (true) {
      const { data, error } = await supabase
        .from('results')
        .select('total_goals, over_15, over_25')
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) {
        console.error('Error fetching historical stats:', error);
        break;
      }

      if (!data || data.length === 0) {
        break;
      }

      allData.push(...data);

      if (data.length < pageSize) {
        break;
      }

      page++;
    }

    if (allData.length === 0) {
      return { totalMatches: 0, avgGoals: 0, over15Rate: 0, over25Rate: 0 };
    }

    const totalMatches = allData.length;
    const totalGoals = allData.reduce((sum, row) => sum + row.total_goals, 0);
    const over15Count = allData.filter(row => row.over_15).length;
    const over25Count = allData.filter(row => row.over_25).length;

    return {
      totalMatches,
      avgGoals: totalGoals / totalMatches,
      over15Rate: (over15Count / totalMatches) * 100,
      over25Rate: (over25Count / totalMatches) * 100,
    };
  } catch (error) {
    console.error('Error calculating historical stats:', error);
    return { totalMatches: 0, avgGoals: 0, over15Rate: 0, over25Rate: 0 };
  }
}

// =====================================================
// PREDICTIONS OPERATIONS
// =====================================================

export async function insertPrediction(prediction: {
  match_date?: string;
  match_time?: string;
  home_team: string;
  away_team: string;
  home_odd?: number;
  draw_odd?: number;
  away_odd?: number;
  goal_line?: number;
  over_odd?: number;
  under_odd?: number;
  ai_prediction: string;
  ai_probability_over15?: number;
  ai_probability_over25?: number;
  ai_confidence_score?: number;
  ai_status?: string;
  block_time_stats?: Record<string, unknown>;
  team_stats_home?: Record<string, unknown>;
  team_stats_away?: Record<string, unknown>;
  calibrated_probability?: number;
  calibration_applied?: boolean;
}): Promise<{ success: boolean; error?: string; data?: PredictionRecord }> {
  if (!supabase) {
    return { success: false, error: 'Supabase client not initialized' };
  }

  try {
    const { data, error } = await supabase
      .from('predictions')
      .insert(prediction)
      .select()
      .single();

    if (error) {
      console.error('Error inserting prediction:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error inserting prediction:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

export async function getPredictions(limit = 100): Promise<PredictionRecord[]> {
  if (!supabase) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('predictions')
      .select('*')
      .order('prediction_date', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching predictions:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching predictions:', error);
    return [];
  }
}

export async function getPendingPredictions(): Promise<PredictionRecord[]> {
  if (!supabase) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('predictions')
      .select('*')
      .is('is_correct', null)
      .order('prediction_date', { ascending: false });

    if (error) {
      console.error('Error fetching pending predictions:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching pending predictions:', error);
    return [];
  }
}

export async function getPredictionByMatch(
  homeTeam: string, 
  awayTeam: string, 
  matchDate?: string
): Promise<PredictionRecord | null> {
  if (!supabase) {
    return null;
  }

  try {
    let query = supabase
      .from('predictions')
      .select('*')
      .eq('home_team', homeTeam)
      .eq('away_team', awayTeam);

    if (matchDate) {
      query = query.eq('match_date', matchDate);
    }

    const { data, error } = await query
      .order('prediction_date', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code !== 'PGRST116') { // Not found error
        console.error('Error fetching prediction by match:', error);
      }
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error fetching prediction by match:', error);
    return null;
  }
}

// =====================================================
// PERFORMANCE METRICS
// =====================================================

export async function getPerformanceMetrics(): Promise<PerformanceMetrics> {
  const defaultMetrics: PerformanceMetrics = {
    total_predictions: 0,
    total_correct: 0,
    total_accuracy: 0,
    total_profit_loss: 0,
    rolling_50_accuracy: 0,
  };

  if (!supabase) {
    return defaultMetrics;
  }

  try {
    // Get total predictions with results
    const { data: allPredictions, error: predError } = await supabase
      .from('predictions')
      .select('is_correct, profit_loss, ai_probability_over15, prediction_date')
      .not('is_correct', 'is', null);

    if (predError) {
      console.error('Error fetching predictions for metrics:', predError);
      return defaultMetrics;
    }

    if (!allPredictions || allPredictions.length === 0) {
      return defaultMetrics;
    }

    const totalPredictions = allPredictions.length;
    const totalCorrect = allPredictions.filter(p => p.is_correct === true).length;
    const totalAccuracy = (totalCorrect / totalPredictions) * 100;
    const totalProfitLoss = allPredictions.reduce((sum, p) => sum + (p.profit_loss || 0), 0);

    // Rolling 50 accuracy
    const sortedPredictions = [...allPredictions].sort((a, b) => 
      new Date(b.prediction_date).getTime() - new Date(a.prediction_date).getTime()
    );
    const last50 = sortedPredictions.slice(0, 50);
    const rolling50Correct = last50.filter(p => p.is_correct === true).length;
    const rolling50Accuracy = last50.length > 0 ? (rolling50Correct / last50.length) * 100 : 0;

    // Current month accuracy
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const currentMonthPredictions = allPredictions.filter(p => {
      const predDate = new Date(p.prediction_date);
      return predDate.getMonth() === currentMonth && predDate.getFullYear() === currentYear;
    });
    const currentMonthCorrect = currentMonthPredictions.filter(p => p.is_correct === true).length;
    const currentMonthAccuracy = currentMonthPredictions.length > 0 
      ? (currentMonthCorrect / currentMonthPredictions.length) * 100 
      : 0;

    // Probability bands
    const bands: ProbabilityBands = {
      '50-59': { total: 0, correct: 0, accuracy: 0 },
      '60-69': { total: 0, correct: 0, accuracy: 0 },
      '70-79': { total: 0, correct: 0, accuracy: 0 },
      '80-89': { total: 0, correct: 0, accuracy: 0 },
      '90-100': { total: 0, correct: 0, accuracy: 0 },
    };

    allPredictions.forEach(p => {
      const prob = p.ai_probability_over15 || 0;
      let band: keyof ProbabilityBands | null = null;
      
      if (prob >= 50 && prob < 60) band = '50-59';
      else if (prob >= 60 && prob < 70) band = '60-69';
      else if (prob >= 70 && prob < 80) band = '70-79';
      else if (prob >= 80 && prob < 90) band = '80-89';
      else if (prob >= 90) band = '90-100';

      if (band) {
        bands[band].total++;
        if (p.is_correct === true) {
          bands[band].correct++;
        }
      }
    });

    // Calculate accuracy for each band
    Object.keys(bands).forEach(key => {
      const band = key as keyof ProbabilityBands;
      if (bands[band].total > 0) {
        bands[band].accuracy = (bands[band].correct / bands[band].total) * 100;
      }
    });

    // Calculate calibration factor
    const avgPredicted = allPredictions.reduce((sum, p) => sum + (p.ai_probability_over15 || 0), 0) / totalPredictions;
    const calibrationFactor = avgPredicted > 0 ? totalAccuracy / avgPredicted : 1.0;

    return {
      total_predictions: totalPredictions,
      total_correct: totalCorrect,
      total_accuracy: Math.round(totalAccuracy * 100) / 100,
      total_profit_loss: Math.round(totalProfitLoss * 100) / 100,
      rolling_50_accuracy: Math.round(rolling50Accuracy * 100) / 100,
      current_month_predictions: currentMonthPredictions.length,
      current_month_correct: currentMonthCorrect,
      current_month_accuracy: Math.round(currentMonthAccuracy * 100) / 100,
      probability_bands: bands,
      calibration_factor: Math.round(calibrationFactor * 10000) / 10000,
    };
  } catch (error) {
    console.error('Error calculating performance metrics:', error);
    return defaultMetrics;
  }
}

export async function getCalibrationFactor(): Promise<number> {
  if (!supabase) {
    return 1.0;
  }

  try {
    const metrics = await getPerformanceMetrics();
    return metrics.calibration_factor || 1.0;
  } catch (error) {
    console.error('Error getting calibration factor:', error);
    return 1.0;
  }
}

// =====================================================
// RESULT LINKING (Manual trigger for backfilling)
// =====================================================

export async function linkResultsToPredictions(): Promise<{ 
  success: boolean; 
  updated: number; 
  error?: string 
}> {
  if (!supabase) {
    return { success: false, updated: 0, error: 'Supabase client not initialized' };
  }

  try {
    // Get all predictions without results
    const { data: pendingPredictions, error: predError } = await supabase
      .from('predictions')
      .select('*')
      .is('is_correct', null);

    if (predError) {
      return { success: false, updated: 0, error: predError.message };
    }

    if (!pendingPredictions || pendingPredictions.length === 0) {
      return { success: true, updated: 0 };
    }

    let updatedCount = 0;

    for (const pred of pendingPredictions) {
      // Find matching result
      const query = supabase
        .from('results')
        .select('*')
        .eq('home_team', pred.home_team)
        .eq('away_team', pred.away_team);

      const { data: results, error: resultError } = pred.match_date
        ? await query.eq('match_date', pred.match_date)
        : await query;

      if (resultError || !results || results.length === 0) {
        continue;
      }

      const result = results[0];
      
      // Determine if prediction was correct
      let isCorrect: boolean | null = null;
      if (pred.ai_prediction === 'OVER 1.5') {
        isCorrect = result.over_15;
      } else if (pred.ai_prediction === 'OVER 2.5') {
        isCorrect = result.over_25;
      } else if (pred.ai_prediction === 'UNDER 1.5') {
        isCorrect = !result.over_15;
      } else if (pred.ai_prediction === 'UNDER 2.5') {
        isCorrect = !result.over_25;
      }

      // Calculate profit/loss
      let profitLoss = 0;
      if (isCorrect === true && pred.over_odd) {
        profitLoss = pred.over_odd - 1;
      } else if (isCorrect === false) {
        profitLoss = -1;
      }

      // Update prediction
      const { error: updateError } = await supabase
        .from('predictions')
        .update({
          final_result_over15: result.over_15,
          final_result_over25: result.over_25,
          final_home_goals: result.home_goals,
          final_away_goals: result.away_goals,
          final_total_goals: result.total_goals,
          is_correct: isCorrect,
          profit_loss: profitLoss,
          updated_at: new Date().toISOString(),
        })
        .eq('id', pred.id);

      if (!updateError) {
        updatedCount++;
      }
    }

    return { success: true, updated: updatedCount };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error linking results to predictions:', errorMessage);
    return { success: false, updated: 0, error: errorMessage };
  }
}

// =====================================================
// OVER 2.5 TRACKING OPERATIONS
// =====================================================

/**
 * Get all results with Over 2.5 tracking data
 */
export async function getOver25Results(): Promise<Over25Result[]> {
  if (!supabase) {
    return [];
  }

  try {
    const allResults: Over25Result[] = [];
    let page = 0;
    const pageSize = 1000;

    while (true) {
      const { data, error } = await supabase
        .from('results')
        .select('*')
        .not('match_date', 'is', null)
        .order('match_date', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) {
        console.error('Error fetching Over 2.5 results:', error);
        break;
      }

      if (!data || data.length === 0) {
        break;
      }

      allResults.push(...data);

      if (data.length < pageSize) {
        break;
      }

      page++;
    }

    return allResults;
  } catch (error) {
    console.error('Error fetching Over 2.5 results:', error);
    return [];
  }
}

/**
 * Get results filtered by date range
 */
export async function getOver25ResultsByDateRange(
  startDate: string,
  endDate: string
): Promise<Over25Result[]> {
  if (!supabase) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('results')
      .select('*')
      .gte('match_date', startDate)
      .lte('match_date', endDate)
      .order('match_date', { ascending: false });

    if (error) {
      console.error('Error fetching Over 2.5 results by date:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching Over 2.5 results by date:', error);
    return [];
  }
}

/**
 * Get results filtered by block ID
 */
export async function getOver25ResultsByBlock(blockId: string): Promise<Over25Result[]> {
  if (!supabase) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('results')
      .select('*')
      .eq('block_id', blockId)
      .order('match_date', { ascending: false });

    if (error) {
      console.error('Error fetching Over 2.5 results by block:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching Over 2.5 results by block:', error);
    return [];
  }
}

/**
 * Insert upcoming match for Over 2.5 analysis
 */
export async function insertUpcomingMatch(match: {
  match_date?: string;
  block_id?: string;
  home_team?: string;
  away_team?: string;
  home_odd: number;
  away_odd: number;
  over25_odd: number;
  under25_odd: number;
  bucket_home?: string;
  bucket_over25?: string;
  historical_over25_rate?: number;
  total_in_bucket?: number;
  current_streak?: number;
  streak_type?: string;
  confidence_indicator?: string;
}): Promise<{ success: boolean; error?: string; data?: UpcomingMatch }> {
  if (!supabase) {
    return { success: false, error: 'Supabase client not initialized' };
  }

  try {
    const { data, error } = await supabase
      .from('upcoming_matches')
      .insert(match)
      .select()
      .single();

    if (error) {
      console.error('Error inserting upcoming match:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error inserting upcoming match:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Get all upcoming matches
 */
export async function getUpcomingMatches(): Promise<UpcomingMatch[]> {
  if (!supabase) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('upcoming_matches')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching upcoming matches:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching upcoming matches:', error);
    return [];
  }
}

/**
 * Clear upcoming matches
 */
export async function clearUpcomingMatches(): Promise<{ success: boolean; error?: string }> {
  if (!supabase) {
    return { success: false, error: 'Supabase client not initialized' };
  }

  try {
    const { error } = await supabase
      .from('upcoming_matches')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (error) {
      console.error('Error clearing upcoming matches:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error clearing upcoming matches:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Update result with odds data
 */
export async function updateResultWithOdds(
  resultId: string,
  oddsData: {
    home_odd?: number;
    away_odd?: number;
    over25_odd?: number;
    under25_odd?: number;
    block_id?: string;
    platform?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  if (!supabase) {
    return { success: false, error: 'Supabase client not initialized' };
  }

  try {
    const { error } = await supabase
      .from('results')
      .update(oddsData)
      .eq('id', resultId);

    if (error) {
      console.error('Error updating result with odds:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error updating result with odds:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Get bucket statistics
 */
export async function getBucketStats(): Promise<BucketStats[]> {
  if (!supabase) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('bucket_stats')
      .select('*')
      .order('bucket_type', { ascending: true });

    if (error) {
      console.error('Error fetching bucket stats:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching bucket stats:', error);
    return [];
  }
}

/**
 * Upsert bucket statistics
 */
export async function upsertBucketStats(stats: {
  bucket_type: 'home_odd' | 'away_odd' | 'over25_odd';
  bucket_range: string;
  total_matches: number;
  over25_hits: number;
  over25_rate: number;
  current_streak: number;
  streak_type: 'over' | 'under' | 'none';
}): Promise<{ success: boolean; error?: string }> {
  if (!supabase) {
    return { success: false, error: 'Supabase client not initialized' };
  }

  try {
    const { error } = await supabase
      .from('bucket_stats')
      .upsert(stats, { onConflict: 'bucket_type,bucket_range' });

    if (error) {
      console.error('Error upserting bucket stats:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error upserting bucket stats:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Get odds patterns
 */
export async function getOddsPatterns(): Promise<OddsPattern[]> {
  if (!supabase) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('odds_patterns')
      .select('*')
      .order('total_matches', { ascending: false });

    if (error) {
      console.error('Error fetching odds patterns:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching odds patterns:', error);
    return [];
  }
}

/**
 * Upsert odds pattern
 */
export async function upsertOddsPattern(pattern: {
  pattern_hash: string;
  home_odd_range: string;
  over25_odd_range: string;
  total_matches: number;
  over25_hits: number;
  over25_rate: number;
  last_seen: string;
}): Promise<{ success: boolean; error?: string }> {
  if (!supabase) {
    return { success: false, error: 'Supabase client not initialized' };
  }

  try {
    const { error } = await supabase
      .from('odds_patterns')
      .upsert(pattern, { onConflict: 'pattern_hash' });

    if (error) {
      console.error('Error upserting odds pattern:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error upserting odds pattern:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

// =====================================================
// OVER 2.5 PREDICTIONS (Separate from Over 1.5)
// =====================================================

/**
 * Insert Over 2.5 prediction
 */
export async function insertOver25Prediction(prediction: {
  match_date?: string;
  match_time?: string;
  home_team?: string;
  away_team?: string;
  home_odd?: number;
  away_odd?: number;
  over25_odd?: number;
  under25_odd?: number;
  bucket_home?: string;
  bucket_over25?: string;
  historical_over25_rate?: number;
  total_in_bucket?: number;
  current_streak?: number;
  streak_type?: string;
  confidence_indicator?: string;
  recommendation?: string;
}): Promise<{ success: boolean; error?: string; data?: PredictionRecord }> {
  if (!supabase) {
    return { success: false, error: 'Supabase client not initialized' };
  }

  try {
    // Use the predictions table with a different prediction type
    const { data, error } = await supabase
      .from('predictions')
      .insert({
        ...prediction,
        ai_prediction: 'OVER 2.5',
        league: 'Germany Virtual',
        goal_line: 2.5,
        over_odd: prediction.over25_odd,
        under_odd: prediction.under25_odd,
        ai_status: prediction.confidence_indicator,
        ai_probability_over25: prediction.historical_over25_rate,
      })
      .select()
      .single();

    if (error) {
      console.error('Error inserting Over 2.5 prediction:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error inserting Over 2.5 prediction:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Get Over 2.5 predictions with performance stats
 */
export async function getOver25Predictions(): Promise<{
  predictions: PredictionRecord[];
  performance: {
    totalPredictions: number;
    correctPredictions: number;
    accuracy: number;
    currentStreak: number;
    streakType: string;
  };
}> {
  if (!supabase) {
    return { 
      predictions: [], 
      performance: { totalPredictions: 0, correctPredictions: 0, accuracy: 0, currentStreak: 0, streakType: 'none' }
    };
  }

  try {
    const { data, error } = await supabase
      .from('predictions')
      .select('*')
      .eq('ai_prediction', 'OVER 2.5')
      .order('prediction_date', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error fetching Over 2.5 predictions:', error);
      return { 
        predictions: [], 
        performance: { totalPredictions: 0, correctPredictions: 0, accuracy: 0, currentStreak: 0, streakType: 'none' }
      };
    }

    const predictions = data || [];
    
    // Calculate performance
    const withResults = predictions.filter(p => p.is_correct !== null && p.is_correct !== undefined);
    const totalPredictions = withResults.length;
    const correctPredictions = withResults.filter(p => p.is_correct === true).length;
    const accuracy = totalPredictions > 0 ? (correctPredictions / totalPredictions) * 100 : 0;

    // Calculate current streak
    let currentStreak = 0;
    let streakType = 'none';
    
    for (const pred of withResults) {
      if (currentStreak === 0) {
        if (pred.is_correct === true) {
          streakType = 'win';
          currentStreak = 1;
        } else if (pred.is_correct === false) {
          streakType = 'loss';
          currentStreak = 1;
        }
      } else {
        if ((streakType === 'win' && pred.is_correct === true) ||
            (streakType === 'loss' && pred.is_correct === false)) {
          currentStreak++;
        } else {
          break;
        }
      }
    }

    return {
      predictions,
      performance: {
        totalPredictions,
        correctPredictions,
        accuracy,
        currentStreak,
        streakType,
      },
    };
  } catch (error) {
    console.error('Error fetching Over 2.5 predictions:', error);
    return { 
      predictions: [], 
      performance: { totalPredictions: 0, correctPredictions: 0, accuracy: 0, currentStreak: 0, streakType: 'none' }
    };
  }
}

/**
 * Insert Over 2.5 odds
 */
export async function insertOver25Odds(oddsData: {
  home_team?: string;
  away_team?: string;
  home_odd?: number;
  away_odd?: number;
  over25_odd?: number;
  under25_odd?: number;
  match_date?: string;
  match_time?: string;
}): Promise<{ success: boolean; error?: string }> {
  if (!supabase) {
    return { success: false, error: 'Supabase client not initialized' };
  }

  try {
    const { error } = await supabase
      .from('odds')
      .insert({
        block_time: oddsData.match_time || '',
        home_team: oddsData.home_team || 'Unknown',
        away_team: oddsData.away_team || 'Unknown',
        home_odd: oddsData.home_odd,
        away_odd: oddsData.away_odd,
        over_odd: oddsData.over25_odd,
        under_odd: oddsData.under25_odd,
        goal_line: 2.5,
        match_date: oddsData.match_date,
        match_time: oddsData.match_time,
      });

    if (error) {
      console.error('Error inserting Over 2.5 odds:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error inserting Over 2.5 odds:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Clear Over 2.5 odds
 */
export async function clearOver25Odds(): Promise<{ success: boolean; error?: string }> {
  if (!supabase) {
    return { success: false, error: 'Supabase client not initialized' };
  }

  try {
    const { error } = await supabase
      .from('odds')
      .delete()
      .eq('goal_line', 2.5);

    if (error) {
      console.error('Error clearing Over 2.5 odds:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error clearing Over 2.5 odds:', errorMessage);
    return { success: false, error: errorMessage };
  }
}
