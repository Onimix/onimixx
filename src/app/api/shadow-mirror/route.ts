import { NextResponse } from 'next/server';
import { getAllResults, getAllOdds } from '@/lib/supabase';
import { generateShadowMirrorPredictions, findMirrorAnchors, getYesterdayDate } from '@/lib/shadow-mirror';
import type { ShadowMirrorPrediction } from '@/lib/types';

export async function GET() {
  try {
    // Fetch results and odds from database
    const [results, odds] = await Promise.all([
      getAllResults(),
      getAllOdds(),
    ]);

    if (results.length === 0) {
      return NextResponse.json({
        success: true,
        predictions: [],
        message: 'No historical results available. Please upload results first.',
        yesterday_date: getYesterdayDate(),
      });
    }

    // Generate shadow mirror predictions
    const predictions = generateShadowMirrorPredictions(results, odds);

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
    const mirrorAnchors = findMirrorAnchors(results);
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
