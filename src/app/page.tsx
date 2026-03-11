'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import JsonUploader from '@/components/JsonUploader';
import OddsInput from '@/components/OddsInput';
import HistoricalStatsPanel from '@/components/HistoricalStats';
import PredictionPanel from '@/components/PredictionPanel';
import { getAllResults, getAllOdds, getHistoricalStats, getPerformanceMetrics, insertPrediction } from '@/lib/supabase';
import { analyzeMatch } from '@/lib/analysis';
import type { Result, Odds, HistoricalStats, Prediction, PerformanceMetrics, ShadowMirrorPrediction, UniversalSignal } from '@/lib/types';

// Matrix characters for edges - tiny falling code effect
const matrixChars = '01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン';
const getRandomChar = () => matrixChars[Math.floor(Math.random() * matrixChars.length)];

// Matrix rain elements for all 4 edges
const matrixRainElements: Array<{
  position: 'top' | 'bottom' | 'left' | 'right';
  left?: string;
  top?: string;
  speed: number;
  delay: number;
  char: string;
}> = [
  // Top edge - falling down
  ...Array.from({ length: 40 }, (_, i) => ({
    position: 'top' as const,
    left: `${(i * 2.5)}%`,
    speed: 0.8 + Math.random() * 0.6,
    delay: Math.random() * 2,
    char: getRandomChar(),
  })),
  // Bottom edge - falling up
  ...Array.from({ length: 40 }, (_, i) => ({
    position: 'bottom' as const,
    left: `${(i * 2.5)}%`,
    speed: 0.8 + Math.random() * 0.6,
    delay: Math.random() * 2,
    char: getRandomChar(),
  })),
  // Left edge - falling right
  ...Array.from({ length: 30 }, (_, i) => ({
    position: 'left' as const,
    top: `${(i * 3.3)}%`,
    speed: 0.8 + Math.random() * 0.6,
    delay: Math.random() * 2,
    char: getRandomChar(),
  })),
  // Right edge - falling left
  ...Array.from({ length: 30 }, (_, i) => ({
    position: 'right' as const,
    top: `${(i * 3.3)}%`,
    speed: 0.8 + Math.random() * 0.6,
    delay: Math.random() * 2,
    char: getRandomChar(),
  })),
];

// Matrix ONIMIX floating elements
const matrixElements = [
  { text: 'ONIMIX', color: '#00ff41', top: '5%', left: '2%', delay: '0s', duration: '15s' },
  { text: 'ONIMIX', color: '#ff00ff', top: '15%', left: '85%', delay: '2s', duration: '18s' },
  { text: 'ONIMIX', color: '#00ffff', top: '25%', left: '5%', delay: '4s', duration: '20s' },
  { text: 'ONIMIX', color: '#ffff00', top: '35%', left: '90%', delay: '1s', duration: '16s' },
  { text: 'ONIMIX', color: '#ff0080', top: '45%', left: '3%', delay: '3s', duration: '22s' },
  { text: 'ONIMIX', color: '#80ff00', top: '55%', left: '88%', delay: '5s', duration: '17s' },
  { text: 'ONIMIX', color: '#0080ff', top: '65%', left: '8%', delay: '2.5s', duration: '19s' },
  { text: 'ONIMIX', color: '#ff8000', top: '75%', left: '92%', delay: '4.5s', duration: '21s' },
  { text: 'ONIMIX', color: '#ff0040', top: '85%', left: '4%', delay: '1.5s', duration: '14s' },
  { text: 'ONIMIX', color: '#40ff00', top: '12%', left: '50%', delay: '3.5s', duration: '23s' },
  { text: 'ONIMIX', color: '#0040ff', top: '30%', left: '45%', delay: '0.5s', duration: '16s' },
  { text: 'ONIMIX', color: '#ff40ff', top: '50%', left: '55%', delay: '6s', duration: '18s' },
  { text: 'ONIMIX', color: '#40ffff', top: '70%', left: '48%', delay: '2.2s', duration: '20s' },
  { text: 'ONIMIX', color: '#ffff40', top: '90%', left: '52%', delay: '4.8s', duration: '15s' },
  { text: 'ONIMIX', color: '#ff8040', top: '8%', left: '70%', delay: '1.8s', duration: '17s' },
  { text: 'ONIMIX', color: '#40ff80', top: '22%', left: '25%', delay: '3.2s', duration: '19s' },
  { text: 'ONIMIX', color: '#8040ff', top: '42%', left: '75%', delay: '5.5s', duration: '21s' },
  { text: 'ONIMIX', color: '#ff40ff', top: '62%', left: '20%', delay: '0.8s', duration: '16s' },
  { text: 'ONIMIX', color: '#40ff40', top: '82%', left: '78%', delay: '2.8s', duration: '14s' },
  { text: 'ONIMIX', color: '#ff4040', top: '20%', left: '60%', delay: '4.2s', duration: '18s' },
];

// Cooking animation elements
const cookingEmojis = ['🍳', '🔥', '⚡', '✨', '🚀', '💎', '🎯', '🦅'];

export default function Home() {
  const [results, setResults] = useState<Result[]>([]);
  const [odds, setOdds] = useState<Odds[]>([]);
  const [historicalStats, setHistoricalStats] = useState<HistoricalStats>({
    totalMatches: 0,
    avgGoals: 0,
    over15Rate: 0,
    over25Rate: 0,
  });
  const [totalResultsCount, setTotalResultsCount] = useState(0);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInputExpanded, setIsInputExpanded] = useState(false);
  const [isDataInputUnlocked, setIsDataInputUnlocked] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [shadowMirrorPredictions, setShadowMirrorPredictions] = useState<ShadowMirrorPrediction[]>([]);
  const [shadowMirrorSummary, setShadowMirrorSummary] = useState<any>(null);
  const [isShadowMirrorLoading, setIsShadowMirrorLoading] = useState(false);
  const [universalSignals, setUniversalSignals] = useState<UniversalSignal[]>([]);
  const [universalScanStatus, setUniversalScanStatus] = useState<any>(null);
  const [isUniversalScanLoading, setIsUniversalScanLoading] = useState(false);

  const handleDataInputClick = () => {
    if (isDataInputUnlocked) {
      setIsInputExpanded(!isInputExpanded);
    } else {
      setShowPasswordModal(true);
      setPasswordError(false);
      setPasswordInput('');
    }
  };

  const handlePasswordSubmit = () => {
    if (passwordInput === 'ONIMIX') {
      setIsDataInputUnlocked(true);
      setIsInputExpanded(true);
      setShowPasswordModal(false);
      setPasswordError(false);
    } else {
      setPasswordError(true);
    }
  };

  const handleLockDataInput = () => {
    setIsDataInputUnlocked(false);
    setIsInputExpanded(false);
  };

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [resultsData, oddsData, statsData, metricsData] = await Promise.all([
        getAllResults(),
        getAllOdds(),
        getHistoricalStats(),
        getPerformanceMetrics(),
      ]);
      
      setResults(resultsData);
      setOdds(oddsData);
      setHistoricalStats(statsData);
      setPerformanceMetrics(metricsData);
      setTotalResultsCount(resultsData.length);

      // Generate predictions for each odd with calibration
      if (oddsData.length > 0 && resultsData.length > 0) {
        const calibrationFactor = metricsData?.calibration_factor || 1.0;
        
        const newPredictions = oddsData.map(odd => {
          const basePrediction = analyzeMatch(odd, resultsData);
          
          // Apply calibration to probability
          const calibratedProbability = basePrediction.confidence * calibrationFactor;
          
          return {
            ...basePrediction,
            ai_probability_over15: basePrediction.confidence,
            calibrated_probability: Math.min(99, calibratedProbability),
            calibration_applied: calibrationFactor !== 1.0,
          };
        });
        
        setPredictions(newPredictions);
        
        // Store predictions in database for tracking
        for (const pred of newPredictions) {
          if (pred.status !== 'RISKY') {
            await insertPrediction({
              match_date: pred.match.match_date,
              match_time: pred.match.block_time,
              home_team: pred.match.home_team,
              away_team: pred.match.away_team,
              home_odd: pred.match.home_odd,
              draw_odd: pred.match.draw_odd,
              away_odd: pred.match.away_odd,
              goal_line: pred.match.goal_line,
              over_odd: pred.match.over_odd,
              under_odd: pred.match.under_odd,
              ai_prediction: pred.prediction,
              ai_probability_over15: pred.ai_probability_over15,
              ai_confidence_score: pred.confidence,
              ai_status: pred.status,
              calibrated_probability: pred.calibrated_probability,
              calibration_applied: pred.calibration_applied,
            });
          }
        }
      } else {
        setPredictions([]);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    loadShadowMirror();
    loadUniversalScan();
  }, [loadData]);

  const handleResultsUploaded = () => {
    loadData();
    loadShadowMirror();
    loadUniversalScan();
  };

  const handleOddsSubmitted = () => {
    loadData();
    loadShadowMirror();
    loadUniversalScan();
  };

  const loadShadowMirror = async () => {
    setIsShadowMirrorLoading(true);
    try {
      const response = await fetch('/api/shadow-mirror');
      const data = await response.json();
      if (data.success) {
        setShadowMirrorPredictions(data.predictions || []);
        setShadowMirrorSummary(data.summary || null);
      }
    } catch (error) {
      console.error('Error loading shadow mirror:', error);
    } finally {
      setIsShadowMirrorLoading(false);
    }
  };

  const loadUniversalScan = async () => {
    setIsUniversalScanLoading(true);
    try {
      const response = await fetch('/api/universal-scan');
      const data = await response.json();
      if (data.success) {
        setUniversalSignals(data.top_3_signals || []);
        setUniversalScanStatus({
          total_signals: data.global_status?.total_signals || 0,
          production_vacuums: data.global_status?.production_vacuums || 0,
          over_production_peaks: data.global_status?.over_production_peaks || 0,
          global_flush_activated: data.global_status?.global_flush_activated || false,
          current_block_time: data.current_block_time,
          league_snapshots: data.league_snapshots || [],
        });
      }
    } catch (error) {
      console.error('Error loading universal scan:', error);
    } finally {
      setIsUniversalScanLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
      {/* 💚 MATRIX RAIN BORDER EFFECT - TINY FALLING CODE 💚 */}
      {matrixRainElements.map((el, i) => (
        <div
          key={`matrix-${i}`}
          className="fixed pointer-events-none z-50 matrix-rain-container"
          style={{
            [el.position]: '0',
            ...(el.position === 'top' || el.position === 'bottom' ? { left: el.left } : { top: el.top }),
            animation: el.position === 'top' ? `matrixFallDown ${el.speed}s linear infinite` :
                       el.position === 'bottom' ? `matrixFallUp ${el.speed}s linear infinite` :
                       el.position === 'left' ? `matrixFallRight ${el.speed}s linear infinite` :
                       `matrixFallLeft ${el.speed}s linear infinite`,
            animationDelay: `${el.delay}s`,
          }}
        >
          <span className="matrix-char" style={{
            color: '#00ff41',
            textShadow: '0 0 8px #00ff41, 0 0 15px #00ff41, 0 0 25px #00ff41',
            fontSize: '10px',
            fontFamily: "'Courier New', monospace",
            fontWeight: 'bold',
          }}>
            {el.char}
          </span>
        </div>
      ))}

      {/* Matrix ONIMIX Background Effect */}
      {matrixElements.map((el, i) => (
        <div
          key={i}
          className="fixed pointer-events-none select-none opacity-20 matrix-float"
          style={{
            top: el.top,
            left: el.left,
            color: el.color,
            animationDelay: el.delay,
            animationDuration: el.duration,
            fontSize: 'clamp(1rem, 3vw, 2rem)',
            fontWeight: 'bold',
            textShadow: `0 0 10px ${el.color}, 0 0 20px ${el.color}, 0 0 40px ${el.color}`,
            zIndex: 0,
            whiteSpace: 'nowrap',
          }}
        >
          {el.text}
        </div>
      ))}

      {/* Animated Banner */}
      <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 bg-[length:200%_100%] animate-gradient py-4 overflow-hidden">
        <div className="animate-marquee whitespace-nowrap">
          <span className="text-white text-xl font-bold px-4">
            🦅 Welcome to ONIMIX Eagle Eye Pick – Where Data Tech Sees What Others Don&apos;t 🦅
            🦅 Welcome to ONIMIX Eagle Eye Pick – Where Data Tech Sees What Others Don&apos;t 🦅
            🦅 Welcome to ONIMIX Eagle Eye Pick – Where Data Tech Sees What Others Don&apos;t 🦅
          </span>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-8 pb-32">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">
            🦅 ONIMIX Eagle Eye Pick
          </h1>
          <p className="text-slate-400 text-lg">
            AI-Powered Over 1.5 Goals Prediction Engine
          </p>
          <Link 
            href="/over25-structure"
            className="inline-block mt-4 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white font-bold py-2 px-6 rounded-full transition-all transform hover:scale-105"
          >
            🎯 Over 2.5 Structure Analysis →
          </Link>
        </div>

        {/* Collapsible Data Upload Panel */}
        <section className="mb-10">
          <button
            onClick={handleDataInputClick}
            className="w-full bg-slate-800/50 backdrop-blur-sm rounded-2xl p-4 border border-slate-700 hover:border-slate-600 transition-all duration-300 flex items-center justify-between group"
          >
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              📊 Data Input Panel
              {isDataInputUnlocked ? (
                <span className="text-sm font-normal text-green-400">
                  (Unlocked - Click to {isInputExpanded ? 'collapse' : 'expand'})
                </span>
              ) : (
                <span className="text-sm font-normal text-slate-400 group-hover:text-slate-300 transition-colors">
                  (Click to expand)
                </span>
              )}
            </h2>
            <div className="flex items-center gap-3">
              {isDataInputUnlocked && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleLockDataInput(); }}
                  className="text-xl hover:scale-110 transition-transform"
                  title="Lock Data Input"
                >
                  🔒
                </button>
              )}
              <div className={`text-3xl transform transition-transform duration-300 ${isInputExpanded ? 'rotate-180' : ''}`}>
                ⬇️
              </div>
            </div>
          </button>
          
          {isInputExpanded && (
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-b-2xl p-6 border border-t-0 border-slate-700 mt-[-1px] animate-fadeIn">
              <div className="grid md:grid-cols-2 gap-6">
                {/* JSON Upload */}
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-slate-300">
                    📁 Upload Results (JSON/TXT)
                  </h3>
                  <JsonUploader onUploadComplete={handleResultsUploaded} />
                </div>

                {/* Odds Input */}
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-slate-300">
                    📋 Paste Odds (Tab-Separated)
                  </h3>
                  <OddsInput onOddsSubmitted={handleOddsSubmitted} />
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Historical Intelligence Panel */}
        <section className="mb-10">
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              🧠 Historical Intelligence
            </h2>
            {isLoading ? (
              <div className="animate-pulse flex gap-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex-1 h-24 bg-slate-700 rounded-xl" />
                ))}
              </div>
            ) : (
              <HistoricalStatsPanel stats={historicalStats} />
            )}
          </div>
        </section>

        {/* SHADOW MIRROR PANEL - 24-Hour Team Switch Analysis */}
        <section className="mb-10">
          <div className="bg-gradient-to-br from-indigo-900/50 via-purple-900/50 to-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-indigo-500/30">
            <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
              🦅 SHADOW MIRROR - 24H Team Switch Protocol
            </h2>
            <p className="text-indigo-300 text-sm mb-6">
              Multi-league analysis (GER, ITA, SPA) • Bayesian Weighting (70% Mirror, 20% Switch, 10% Form)
            </p>
            
            {isShadowMirrorLoading ? (
              <div className="animate-pulse flex gap-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex-1 h-32 bg-indigo-900/50 rounded-xl" />
                ))}
              </div>
            ) : shadowMirrorPredictions.length > 0 ? (
              <>
                {/* Summary Stats */}
                {shadowMirrorSummary && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                    <div className="bg-indigo-900/30 rounded-xl p-3 text-center">
                      <div className="text-2xl font-bold text-indigo-400">
                        {shadowMirrorSummary.mirror_anchors_found}
                      </div>
                      <div className="text-xs text-indigo-300">Mirror Anchors</div>
                    </div>
                    <div className="bg-red-900/30 rounded-xl p-3 text-center">
                      <div className="text-2xl font-bold text-red-400">
                        {shadowMirrorSummary.deadlocks}
                      </div>
                      <div className="text-xs text-red-300">Deadlocks (0:0, 1:0)</div>
                    </div>
                    <div className="bg-orange-900/30 rounded-xl p-3 text-center">
                      <div className="text-2xl font-bold text-orange-400">
                        {shadowMirrorSummary.blowouts}
                      </div>
                      <div className="text-xs text-orange-300">Blowouts (6+ goals)</div>
                    </div>
                    <div className="bg-green-900/30 rounded-xl p-3 text-center">
                      <div className="text-2xl font-bold text-green-400">
                        {shadowMirrorSummary.validated_signals}
                      </div>
                      <div className="text-xs text-green-300">Validated Signals</div>
                    </div>
                  </div>
                )}

                {/* Signal Type Breakdown */}
                {shadowMirrorSummary?.by_signal_type && (
                  <div className="flex flex-wrap gap-2 mb-6">
                    {shadowMirrorSummary.by_signal_type.gap_fill > 0 && (
                      <span className="bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-sm font-semibold">
                        Gap-Fill: {shadowMirrorSummary.by_signal_type.gap_fill}
                      </span>
                    )}
                    {shadowMirrorSummary.by_signal_type.new_producer > 0 && (
                      <span className="bg-cyan-500/20 text-cyan-400 px-3 py-1 rounded-full text-sm font-semibold">
                        New Producer: {shadowMirrorSummary.by_signal_type.new_producer}
                      </span>
                    )}
                    {shadowMirrorSummary.by_signal_type.bait_switch > 0 && (
                      <span className="bg-red-500/20 text-red-400 px-3 py-1 rounded-full text-sm font-semibold">
                        Bait Switch: {shadowMirrorSummary.by_signal_type.bait_switch}
                      </span>
                    )}
                    {shadowMirrorSummary.by_signal_type.mirror_anchor > 0 && (
                      <span className="bg-purple-500/20 text-purple-400 px-3 py-1 rounded-full text-sm font-semibold">
                        Mirror Anchor: {shadowMirrorSummary.by_signal_type.mirror_anchor}
                      </span>
                    )}
                  </div>
                )}

                {/* Predictions Table */}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-indigo-300 text-sm">
                        <th className="pb-3 pr-4">Time</th>
                        <th className="pb-3 pr-4">League</th>
                        <th className="pb-3 pr-4">Match</th>
                        <th className="pb-3 pr-4">Prediction</th>
                        <th className="pb-3 pr-4">Confidence</th>
                        <th className="pb-3 pr-4">Signal</th>
                        <th className="pb-3 pr-4">Odds</th>
                        <th className="pb-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="text-white">
                      {shadowMirrorPredictions.slice(0, 10).map((pred, idx) => (
                        <tr key={idx} className="border-t border-indigo-800/30 hover:bg-indigo-900/20">
                          <td className="py-3 pr-4 font-mono text-indigo-300">{pred.time}</td>
                          <td className="py-3 pr-4">
                            <span className={`px-2 py-1 rounded text-xs font-bold ${
                              pred.league === 'GER' ? 'bg-red-500/20 text-red-400' :
                              pred.league === 'ITA' ? 'bg-blue-500/20 text-blue-400' :
                              'bg-yellow-500/20 text-yellow-400'
                            }`}>
                              {pred.league}
                            </span>
                          </td>
                          <td className="py-3 pr-4 font-semibold">{pred.match}</td>
                          <td className="py-3 pr-4">
                            <span className={`px-2 py-1 rounded text-sm font-bold ${
                              pred.prediction === 'Over 1.5' 
                                ? 'bg-green-500/20 text-green-400' 
                                : 'bg-orange-500/20 text-orange-400'
                            }`}>
                              {pred.prediction}
                            </span>
                          </td>
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-2 bg-slate-700 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full rounded-full ${
                                    pred.confidence >= 90 ? 'bg-green-400' :
                                    pred.confidence >= 80 ? 'bg-cyan-400' :
                                    'bg-yellow-400'
                                  }`}
                                  style={{ width: `${pred.confidence}%` }}
                                />
                              </div>
                              <span className="text-sm font-bold">{pred.confidence}%</span>
                            </div>
                          </td>
                          <td className="py-3 pr-4">
                            <span className={`px-2 py-1 rounded text-xs ${
                              pred.signal_type === 'Gap-Fill' ? 'bg-blue-500/20 text-blue-400' :
                              pred.signal_type === 'New Producer' ? 'bg-cyan-500/20 text-cyan-400' :
                              pred.signal_type === 'Bait Switch' ? 'bg-red-500/20 text-red-400' :
                              'bg-purple-500/20 text-purple-400'
                            }`}>
                              {pred.signal_type}
                            </span>
                          </td>
                          <td className="py-3 pr-4 font-mono">{pred.odds.toFixed(2)}</td>
                          <td className="py-3">
                            {pred.validated ? (
                              <span className="text-green-400 text-lg">✓</span>
                            ) : (
                              <span className="text-yellow-400 text-lg">⚠</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {shadowMirrorPredictions.length === 0 && (
                  <div className="text-center py-8 text-indigo-300">
                    No shadow mirror signals found. Upload results and odds to generate predictions.
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-indigo-300">
                <p>No shadow mirror signals available.</p>
                <p className="text-sm mt-2">Upload yesterday&apos;s results and today&apos;s odds to generate 24-hour team switch predictions.</p>
              </div>
            )}
          </div>
        </section>

        {/* UNIVERSAL SCAN PANEL - 24H Rolling Multi-League Protocol */}
        <section className="mb-10">
          <div className="bg-gradient-to-br from-emerald-900/50 via-teal-900/50 to-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-emerald-500/30">
            <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
              🌐 UNIVERSAL SCAN - 24H Rolling Multi-League Protocol
            </h2>
            <p className="text-emerald-300 text-sm mb-6">
              Continuous autonomous analysis across GER, ITA, SPA • No block restrictions • Sharp Eye Safety Net
            </p>
            
            {isUniversalScanLoading ? (
              <div className="animate-pulse flex gap-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex-1 h-40 bg-emerald-900/50 rounded-xl" />
                ))}
              </div>
            ) : universalSignals.length > 0 ? (
              <>
                {/* Global Status Summary */}
                {universalScanStatus && (
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
                    <div className="bg-emerald-900/30 rounded-xl p-3 text-center">
                      <div className="text-2xl font-bold text-emerald-400">
                        {universalScanStatus.current_block_time || '--:--'}
                      </div>
                      <div className="text-xs text-emerald-300">Current Block</div>
                    </div>
                    <div className="bg-yellow-900/30 rounded-xl p-3 text-center">
                      <div className="text-2xl font-bold text-yellow-400">
                        {universalScanStatus.production_vacuums}
                      </div>
                      <div className="text-xs text-yellow-300">Production Vacuums</div>
                    </div>
                    <div className="bg-orange-900/30 rounded-xl p-3 text-center">
                      <div className="text-2xl font-bold text-orange-400">
                        {universalScanStatus.over_production_peaks}
                      </div>
                      <div className="text-xs text-orange-300">Over-Production Peaks</div>
                    </div>
                    <div className="bg-cyan-900/30 rounded-xl p-3 text-center">
                      <div className="text-2xl font-bold text-cyan-400">
                        {universalScanStatus.total_signals}
                      </div>
                      <div className="text-xs text-cyan-300">Total Signals</div>
                    </div>
                    <div className={`rounded-xl p-3 text-center ${universalScanStatus.global_flush_activated ? 'bg-red-900/50' : 'bg-slate-700/30'}`}>
                      <div className={`text-2xl font-bold ${universalScanStatus.global_flush_activated ? 'text-red-400' : 'text-slate-400'}`}>
                        {universalScanStatus.global_flush_activated ? '🔴 ACTIVE' : '○ Inactive'}
                      </div>
                      <div className="text-xs text-slate-300">Global Flush</div>
                    </div>
                  </div>
                )}

                {/* League Snapshots */}
                {universalScanStatus?.league_snapshots && universalScanStatus.league_snapshots.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-emerald-300 mb-3">League Snapshots</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {universalScanStatus.league_snapshots.map((snapshot: any) => (
                        <div key={snapshot.league} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                          <div className="flex items-center justify-between mb-2">
                            <span className={`px-2 py-1 rounded text-xs font-bold ${
                              snapshot.league === 'GER' ? 'bg-red-500/20 text-red-400' :
                              snapshot.league === 'ITA' ? 'bg-blue-500/20 text-blue-400' :
                              'bg-yellow-500/20 text-yellow-400'
                            }`}>
                              {snapshot.league}
                            </span>
                            <span className={`text-xs px-2 py-1 rounded ${
                              snapshot.is_production_vacuum ? 'bg-yellow-500/20 text-yellow-400' :
                              snapshot.is_exit_6_active ? 'bg-orange-500/20 text-orange-400' :
                              'bg-slate-700 text-slate-400'
                            }`}>
                              {snapshot.is_production_vacuum ? 'Production Vacuum' : 
                               snapshot.is_exit_6_active ? 'Goal Flush' : 'Neutral'}
                            </span>
                          </div>
                          <div className="text-sm text-slate-300 space-y-1">
                            <div className="flex justify-between">
                              <span>Avg Goals:</span>
                              <span className="font-mono text-white">{snapshot.avg_goals?.toFixed(2) || '0.00'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Over 1.5:</span>
                              <span className="font-mono text-green-400">{snapshot.over_15_rate?.toFixed(1) || '0'}%</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Mirror Anchors:</span>
                              <span className="font-mono text-purple-400">{snapshot.mirror_anchors_count || 0}</span>
                            </div>
                            {snapshot.dry_teams?.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-slate-700">
                                <span className="text-yellow-400">Dry Teams:</span>
                                <span className="text-white ml-2">{snapshot.dry_teams.join(', ')}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* TOP 3 GLOBAL SIGNALS */}
                <div className="mb-4">
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    🎯 Top 3 Global Signals
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {universalSignals.map((signal, idx) => (
                    <div 
                      key={signal.id} 
                      className={`relative overflow-hidden rounded-xl p-4 border-2 ${
                        idx === 0 ? 'border-yellow-400 bg-yellow-900/20' :
                        idx === 1 ? 'border-slate-300 bg-slate-700/30' :
                        'border-amber-600 bg-amber-900/20'
                      }`}
                    >
                      {idx === 0 && (
                        <div className="absolute top-0 right-0 bg-yellow-400 text-slate-900 text-xs font-bold px-2 py-1 rounded-bl-lg">
                          TOP PICK
                        </div>
                      )}
                      <div className="flex items-center gap-2 mb-3">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          signal.league === 'GER' ? 'bg-red-500/20 text-red-400' :
                          signal.league === 'ITA' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {signal.league}
                        </span>
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          signal.signal_type === 'New Producer' ? 'bg-cyan-500/20 text-cyan-400' :
                          signal.signal_type === 'Bait Trap' ? 'bg-red-500/20 text-red-400' :
                          signal.signal_type === 'Global Flush' ? 'bg-orange-500/20 text-orange-400' :
                          signal.signal_type === 'Mirror Debt' ? 'bg-purple-500/20 text-purple-400' :
                          signal.signal_type === 'Exit 6 Cap' ? 'bg-amber-500/20 text-amber-400' :
                          'bg-emerald-500/20 text-emerald-400'
                        }`}>
                          {signal.signal_type}
                        </span>
                      </div>
                      <div className="text-white font-bold mb-2">{signal.match}</div>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-lg font-bold ${
                          signal.prediction === 'Over 1.5' ? 'text-green-400' : 'text-orange-400'
                        }`}>
                          {signal.prediction}
                        </span>
                        <span className="font-mono text-white">@ {signal.odds.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-1">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                            signal.confidence_level === 'HIGH' ? 'bg-green-500/20 text-green-400' :
                            signal.confidence_level === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-slate-500/20 text-slate-400'
                          }`}>
                            {signal.confidence}%
                          </span>
                          {signal.is_sharp_eye_verified && (
                            <span className="text-xs" title="Sharp Eye Verified">👁️</span>
                          )}
                        </div>
                        <span className="text-xs text-slate-400">
                          Target: {signal.target_market}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 line-clamp-2">
                        {signal.reasoning}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-emerald-300">
                <p>No universal scan signals available.</p>
                <p className="text-sm mt-2">Upload results and odds to activate the universal scan protocol.</p>
              </div>
            )}
          </div>
        </section>

        {/* Results Count Display */}
        <section className="mb-10">
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              📊 Results Count
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-700/50 rounded-xl p-4 text-center">
                <div className="text-4xl font-bold text-white">
                  {totalResultsCount}
                </div>
                <div className="text-slate-400 text-sm">Total Results Uploaded</div>
              </div>
            </div>
          </div>
        </section>

        {/* Model Performance Panel */}
        {performanceMetrics && performanceMetrics.total_predictions > 0 && (
          <section className="mb-10">
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                📈 Model Performance
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-slate-700/50 rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold text-white">
                    {performanceMetrics.total_predictions}
                  </div>
                  <div className="text-slate-400 text-sm">Total Predictions</div>
                </div>
                <div className="bg-slate-700/50 rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold text-green-400">
                    {performanceMetrics.total_accuracy.toFixed(1)}%
                  </div>
                  <div className="text-slate-400 text-sm">Accuracy</div>
                </div>
                <div className="bg-slate-700/50 rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold text-blue-400">
                    {performanceMetrics.rolling_50_accuracy.toFixed(1)}%
                  </div>
                  <div className="text-slate-400 text-sm">Last 50 Accuracy</div>
                </div>
                <div className="bg-slate-700/50 rounded-xl p-4 text-center">
                  <div className={`text-3xl font-bold ${performanceMetrics.total_profit_loss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {performanceMetrics.total_profit_loss >= 0 ? '+' : ''}{performanceMetrics.total_profit_loss.toFixed(2)}
                  </div>
                  <div className="text-slate-400 text-sm">ROI (Units)</div>
                </div>
                <div className="bg-slate-700/50 rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold text-purple-400">
                    {performanceMetrics.calibration_factor?.toFixed(3) || '1.000'}
                  </div>
                  <div className="text-slate-400 text-sm">Calibration Factor</div>
                </div>
              </div>
              
              {/* Probability Bands */}
              {performanceMetrics.probability_bands && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold text-slate-300 mb-3">Accuracy by Probability Band</h3>
                  <div className="grid grid-cols-5 gap-2">
                    {Object.entries(performanceMetrics.probability_bands).map(([band, data]) => (
                      <div key={band} className="bg-slate-700/30 rounded-lg p-3 text-center">
                        <div className="text-xs text-slate-500 mb-1">{band}%</div>
                        <div className="text-lg font-bold text-white">
                          {data.total > 0 ? `${data.accuracy.toFixed(0)}%` : '-'}
                        </div>
                        <div className="text-xs text-slate-500">
                          {data.total} pred
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Prediction Panel */}
        <section>
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              🎯 Prediction Output
            </h2>
            {isLoading ? (
              <div className="animate-pulse space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-40 bg-slate-700 rounded-xl" />
                ))}
              </div>
            ) : (
              <PredictionPanel predictions={predictions} />
            )}
          </div>
        </section>
      </main>

      {/* Fixed Footer with Buy Me A Coffee and Cooking Animation */}
      <footer className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-slate-900 via-slate-900/95 to-transparent py-6 px-8 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Left Side - Onimix Cooking Animation */}
          <div className="flex items-center gap-3">
            <div className="cooking-container">
              <span className="text-2xl cooking-emoji-1">🍳</span>
              <span className="text-2xl cooking-emoji-2">🔥</span>
              <span className="text-2xl cooking-emoji-3">⚡</span>
            </div>
            <div className="text-left">
              <div className="text-white font-bold text-lg cooking-text">
                Onimix is cooking...
              </div>
              <div className="text-yellow-400 text-sm font-semibold animate-pulse">
                Wait for it ✨
              </div>
            </div>
          </div>

          {/* Center - Copyright */}
          <div className="hidden md:block text-slate-500 text-sm">
            ONIMIX Eagle Eye Pick © 2026 - SAFE MODE Production Ready
          </div>

          {/* Right Side - Buy Me A Coffee */}
          <a
            href="https://wa.link/7jv61h"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black font-bold py-3 px-6 rounded-full transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-yellow-500/25"
          >
            <span className="text-xl">☕</span>
            <span>Buy Me A Coffee</span>
          </a>
        </div>
      </footer>

      {/* Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-2xl p-8 max-w-md w-full border border-slate-700 shadow-2xl">
            <div className="text-center mb-6">
              <div className="text-5xl mb-4">🔐</div>
              <h3 className="text-2xl font-bold text-white">Data Input Locked</h3>
              <p className="text-slate-400 mt-2">Enter password to access data input panel</p>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => {
                    setPasswordInput(e.target.value);
                    setPasswordError(false);
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
                  placeholder="Enter password..."
                  className={`w-full px-4 py-3 bg-slate-700 border rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 transition-all ${
                    passwordError ? 'border-red-500 focus:ring-red-500' : 'border-slate-600 focus:border-green-500'
                  }`}
                  autoFocus
                />
                {passwordError && (
                  <p className="text-red-400 text-sm mt-2">❌ Incorrect password. Please try again.</p>
                )}
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowPasswordModal(false)}
                  className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePasswordSubmit}
                  className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl transition-colors"
                >
                  Unlock 🔓
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        /* 💚 MATRIX RAIN ANIMATIONS - TINY FALLING CODE 💚 */
        @keyframes matrixFallDown {
          0% { transform: translateY(-20px); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(100vh); opacity: 0; }
        }
        
        @keyframes matrixFallUp {
          0% { transform: translateY(20px); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(-100vh); opacity: 0; }
        }
        
        @keyframes matrixFallRight {
          0% { transform: translateX(-20px); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateX(100vw); opacity: 0; }
        }
        
        @keyframes matrixFallLeft {
          0% { transform: translateX(20px); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateX(-100vw); opacity: 0; }
        }
        
        .matrix-rain-container {
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .matrix-char {
          animation: matrixFlicker 0.15s ease-in-out infinite;
        }
        
        @keyframes matrixFlicker {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }

        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 20s linear infinite;
        }
        .animate-gradient {
          animation: gradient 3s ease infinite;
        }
        @keyframes gradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes matrixFloat {
          0%, 100% { 
            transform: translateY(0) rotate(0deg);
            opacity: 0.1;
          }
          25% { 
            transform: translateY(-20px) rotate(1deg);
            opacity: 0.25;
          }
          50% { 
            transform: translateY(0) rotate(0deg);
            opacity: 0.1;
          }
          75% { 
            transform: translateY(20px) rotate(-1deg);
            opacity: 0.2;
          }
        }
        .matrix-float {
          animation: matrixFloat 8s ease-in-out infinite;
          font-family: 'Courier New', monospace;
        }

        /* Fade In Animation */
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }

        /* Cooking Animation */
        .cooking-container {
          display: flex;
          gap: 4px;
        }
        
        .cooking-emoji-1 {
          animation: cookingBounce1 1s ease-in-out infinite;
        }
        .cooking-emoji-2 {
          animation: cookingBounce2 1s ease-in-out infinite 0.2s;
        }
        .cooking-emoji-3 {
          animation: cookingBounce3 1s ease-in-out infinite 0.4s;
        }
        
        @keyframes cookingBounce1 {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-8px) rotate(10deg); }
        }
        @keyframes cookingBounce2 {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-10px) scale(1.2); }
        }
        @keyframes cookingBounce3 {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-6px) rotate(-10deg); }
        }
        
        .cooking-text {
          background: linear-gradient(90deg, #fff, #00ff41, #00ffff, #ff00ff, #fff);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: cookingGradient 3s linear infinite;
        }
        
        @keyframes cookingGradient {
          0% { background-position: 0% center; }
          100% { background-position: 200% center; }
        }
      `}</style>
    </div>
  );
}
