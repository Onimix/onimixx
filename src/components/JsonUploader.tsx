'use client';

import { useState, useRef } from 'react';
import { insertResults } from '@/lib/supabase';
import { validateSportyJson, timestampToBlockTime, parseScore, parseResultsInput } from '@/lib/analysis';
import type { SportyResponse, ParsedResult, League } from '@/lib/types';

interface JsonUploaderProps {
  onUploadComplete: (count: number) => void;
}

export default function JsonUploader({ onUploadComplete }: JsonUploaderProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [selectedLeague, setSelectedLeague] = useState<League>('GER');
  const inputRef = useRef<HTMLInputElement>(null);

  const processFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsLoading(true);
    setMessage(null);

    let totalProcessed = 0;

    for (const file of Array.from(files)) {
      const isJson = file.name.endsWith('.json');
      const isTxt = file.name.endsWith('.txt');
      
      if (!isJson && !isTxt) {
        setMessage({ type: 'error', text: `File "${file.name}" must be .json or .txt` });
        setIsLoading(false);
        return;
      }

      try {
        const text = await file.text();
        
        if (isTxt) {
          // Parse tab-separated format
          const parseResult = parseResultsInput(text, selectedLeague);
          if (!parseResult.valid) {
            setMessage({ type: 'error', text: parseResult.error || `Invalid format in "${file.name}"` });
            setIsLoading(false);
            return;
          }

          if (parseResult.data && parseResult.data.length > 0) {
            const result = await insertResults(parseResult.data);
            if (result.success) {
              totalProcessed += result.count;
              if (result.duplicates && result.duplicates > 0) {
                console.log(`Skipped ${result.duplicates} duplicate results`);
              }
            } else {
              console.error('Error inserting results:', result.error);
            }
          }
        } else {
          // Parse JSON format
          let jsonData: unknown;

          try {
            jsonData = JSON.parse(text);
          } catch {
            setMessage({ type: 'error', text: `Invalid JSON in file "${file.name}"` });
            setIsLoading(false);
            return;
          }

          const validation = validateSportyJson(jsonData);
          if (!validation.valid) {
            setMessage({ type: 'error', text: validation.error || `Invalid structure in "${file.name}"` });
            setIsLoading(false);
            return;
          }

          const sportyData = jsonData as SportyResponse;
          const parsedResults: ParsedResult[] = [];

          for (const tournament of sportyData.data.tournaments) {
            for (const match of tournament.events) {
              // Only process completed matches
              if (match.matchStatus !== 'End') continue;

              const { homeGoals, awayGoals } = parseScore(match.setScore);
              const totalGoals = homeGoals + awayGoals;

              parsedResults.push({
                league: selectedLeague,
                block_time: timestampToBlockTime(match.estimateStartTime),
                home_team: match.homeTeamName,
                away_team: match.awayTeamName,
                home_goals: homeGoals,
                away_goals: awayGoals,
                total_goals: totalGoals,
                over_15: totalGoals >= 2,
                over_25: totalGoals >= 3,
              });
            }
          }

          if (parsedResults.length > 0) {
            const result = await insertResults(parsedResults);
            if (result.success) {
              totalProcessed += result.count;
              if (result.duplicates && result.duplicates > 0) {
                console.log(`Skipped ${result.duplicates} duplicate results`);
              }
            } else {
              console.error('Error inserting results:', result.error);
            }
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setMessage({ type: 'error', text: `Error processing "${file.name}": ${errorMessage}` });
        setIsLoading(false);
        return;
      }
    }

    setIsLoading(false);

    if (totalProcessed > 0) {
      setMessage({ type: 'success', text: `Successfully inserted ${totalProcessed} new matches!` });
      onUploadComplete(totalProcessed);
    } else {
      setMessage({ type: 'error', text: 'No new matches found. All results may already exist in the database.' });
    }
  };

  const handlePaste = async () => {
    if (!pasteText.trim()) {
      setMessage({ type: 'error', text: 'Please paste some data first' });
      return;
    }

    setIsLoading(true);
    setMessage(null);

    const parseResult = parseResultsInput(pasteText, selectedLeague);
    if (!parseResult.valid) {
      setMessage({ type: 'error', text: parseResult.error || 'Invalid format' });
      setIsLoading(false);
      return;
    }

    if (parseResult.data && parseResult.data.length > 0) {
      const result = await insertResults(parseResult.data);
      if (result.success) {
        let message = `Successfully inserted ${result.count} matches!`;
        if (result.duplicates && result.duplicates > 0) {
          message += ` (${result.duplicates} duplicates skipped)`;
        }
        setMessage({ type: 'success', text: message });
        onUploadComplete(result.count);
        setPasteText('');
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to insert results' });
      }
    } else {
      setMessage({ type: 'error', text: 'No valid matches found' });
    }

    setIsLoading(false);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(e.target.files);
  };

  const handleClick = () => {
    inputRef.current?.click();
  };

  return (
    <div className="w-full">
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-200 ${
          dragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".json,.txt"
          multiple
          onChange={handleChange}
          className="hidden"
        />
        <div className="space-y-2">
          <div className="text-4xl">📁</div>
          <div className="text-lg font-medium text-gray-700">
            {isLoading ? 'Processing...' : 'Drop files here or click to upload'}
          </div>
          <div className="text-sm text-gray-500">
            Accepts .json (Sporty format) or .txt (tab-separated)
          </div>
        </div>
      </div>

      {message && (
        <div
          className={`mt-4 p-3 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-100 text-green-800 border border-green-200'
              : 'bg-red-100 text-red-800 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Paste Input Section */}
      <div className="mt-6">
        <div className="flex items-center gap-4 mb-2">
          <div className="text-sm font-medium text-gray-700">Or paste results directly:</div>
          <select
            value={selectedLeague}
            onChange={(e) => setSelectedLeague(e.target.value as League)}
            className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="GER">🇩🇪 Germany</option>
            <option value="ITA">🇮🇹 Italy</option>
            <option value="SPA">🇪🇸 Spain</option>
          </select>
        </div>
        <div className="text-xs text-gray-500 mb-2">Format: Date[tab]Time[tab]TeamA Goal-Goal TeamB (one per line)</div>
        <textarea
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          placeholder="26/01/2026	08:24	LEV 0-2 HSV
26/01/2026	08:24	MAI 4-0 SCF
26/01/2026	08:24	STP 0-0 SGE"
          className="w-full h-32 p-3 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <button
          onClick={handlePaste}
          disabled={isLoading || !pasteText.trim()}
          className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Processing...' : 'Paste Results'}
        </button>
      </div>
    </div>
  );
}
