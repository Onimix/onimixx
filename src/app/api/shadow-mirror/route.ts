import { NextResponse } from 'next/server';
import { getAllResults, getAllOdds, getYesterdayResults, getResultsByDateRange } from '@/lib/supabase';
import { generateShadowMirrorPredictions, findMirrorAnchors, getYesterdayDate, getTodayDate } from '@/lib/shadow-mirror';
import type { ShadowMirrorPrediction, League } from '@/lib/types';

export async function GET() {
  try {
    // Use optimized date-range queries instead of fetching ALL results
    const yesterday = getYesterdayDate();
    const today = getTodayDate();
    
    // Fetch yesterday's results (critical for Shadow Mirror) - optimized query
    const yesterdayResults = await getYesterdayResults();
    
    // Fetch last 7 days for historical stats (Exit 6 Cap analysis)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];
    
    const historicalResults = await getResultsByDateRange(sevenDaysAgoStr, yesterday);
    
    // Combine yesterday + historical for complete analysis
    const allResults = [...yesterdayResults, ...historicalResults];
    
    // Fetch odds from database
    const odds = await getAllOdds();

    if (allResults.length === 0) {
      return NextResponse.json({
        success: true,
        predictions: [],
        message: 'No historical results available. Please upload results first.',
        yesterday_date: yesterday,
        query_info: {
          yesterday_count: 0,
          historical_count: 0,
          query_type: 'optimized_date_range'
        }
      });
    }

    // Generate shadow mirror predictions
    const predictions = generateShadowMirrorPredictions(allResults, odds);

    // Filter to only validated predictions (passing odds filter)
    const validatedPredictions = predictions.filter(p => p.validated);

    // Group by signal type for display
    const bySignalType = {
      'Gap-Fill': predictions.filter(p => p.signal_type === 'Gap-Fill'),
      'New Producer': predictions.filter(p => p.signal_type === 'New Producer'),
      'Bait Switch': predictions.filter(p => p.signal_type === 'Bait Switch'),
      'Mirror Anchor': predictions.filter(p => p.signal_type === 'Mirror Anchor'),
    };

    // Get mirror anchors summary
    const mirrorAnchors = findMirrorAnchors(allResults);
    const deadlocks = mirrorAnchors.filter(a => a.is_deadlock);
    const blowouts = mirrorAnchors.filter(a => a.is_blowout);

    return NextResponse.json({
      success: true,
      predictions: validatedPredictions.length > 0 ? validatedPredictions : predictions,
      all_predictions: predictions,
      summary: {
        total_matches_analyzed: odds.length,
        mirror_anchors_found: mirrorAnchors.length,
        deadlocks: deadlocks.length,
        blowouts: blowouts.length,
        validated_signals: validatedPredictions.length,
        by_signal_type: {
          gap_fill: bySignalType['Gap-Fill'].length,
          new_producer: bySignalType['New Producer'].length,
          bait_switch: bySignalType['Bait Switch'].length,
          mirror_anchor: bySignalType['Mirror Anchor'].length,
        },
      },
      yesterday_date: getYesterdayDate(),
      bayesian_weights: {
        mirror_anchor: '70%',
        production_switch: '20%',
        current_form: '10%',
      },
      odds_validation: {
        over_15: { min: 1.40, max: 1.57 },
        under_25: { min: 1.65, max: 2.10 },
      },
    });
  } catch (error) {
    console.error('Error generating shadow mirror predictions:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate predictions' },
      { status: 500 }
    );
  }
}
