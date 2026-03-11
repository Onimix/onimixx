import { NextResponse } from 'next/server';
import { getAllResults, getAllOdds, getYesterdayResults, getResultsByDateRange } from '@/lib/supabase';
import { performUniversalScan } from '@/lib/universal-scan';
import { getCurrentBlockTime } from '@/lib/universal-scan';

export async function GET() {
  try {
    // Fetch results for analysis
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];
    
    // Get historical results for pattern analysis
    const historicalResults = await getResultsByDateRange(sevenDaysAgoStr, yesterdayStr);
    
    // Get yesterday's results for mirror anchor detection
    const yesterdayResults = await getYesterdayResults();
    
    // Combine all results
    const allResults = [...yesterdayResults, ...historicalResults];
    
    // Get current odds
    const odds = await getAllOdds();
    
    if (allResults.length === 0) {
      return NextResponse.json({
        success: true,
        signals: [],
        top_3_signals: [],
        global_status: {
          total_signals: 0,
          production_vacuums: 0,
          over_production_peaks: 0,
          global_flush_activated: false,
          active_leagues: ['GER', 'ITA', 'SPA'],
        },
        message: 'No historical results available. Please upload results first.',
        current_block_time: getCurrentBlockTime(),
      });
    }
    
    // Perform universal scan
    const scanResult = performUniversalScan(allResults, odds);
    
    // Format response
    return NextResponse.json({
      success: true,
      signals: scanResult.signals,
      top_3_signals: scanResult.top_3_signals,
      global_status: scanResult.global_status,
      league_snapshots: Object.entries(scanResult.league_snapshots).map(([league, snapshot]) => ({
        league,
        current_block: snapshot.current_block_stats,
        previous_block: snapshot.previous_block_stats,
        mirror_anchors_count: snapshot.mirror_anchors.length,
        dry_teams: snapshot.dry_teams,
        producer_teams: snapshot.producer_teams,
        avg_goals: Math.round(snapshot.avg_goals * 100) / 100,
        over_15_rate: Math.round(snapshot.over_15_rate * 10) / 10,
        is_exit_6_active: snapshot.is_exit_6_active,
        is_production_vacuum: snapshot.is_production_vacuum,
      })),
      current_block_time: getCurrentBlockTime(),
      scan_timestamp: scanResult.scan_timestamp,
      protocol_info: {
        name: 'Universal Scan Protocol',
        version: '1.0',
        description: '24-hour rolling analysis across GER, ITA, SPA without block restrictions',
        features: [
          'Autonomous Block Monitoring',
          'Universal Switch Logic',
          'Sharp Eye Safety Net',
          'Global Flush Detection',
          'Pattern Recognition',
        ],
      },
    });
  } catch (error) {
    console.error('Error performing universal scan:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to perform universal scan' },
      { status: 500 }
    );
  }
}
