import React, { useState, useEffect, useRef } from 'react';
import type {
  ClientQuestion,
  LeaderboardEntry,
} from '@quickfire/shared';
import {
  Clock,
  Send,
  Trophy,
  ShieldAlert,
  Flame,
  CheckCircle2,
  XCircle,
  Lock,
} from 'lucide-react';
import { sound } from '../utils/sound';

interface GameplayScreenProps {
  question: ClientQuestion | null;
  round: number;
  progress: number;
  required: number;
  totalScore: number;
  leaderboard: LeaderboardEntry[];
  currentPlayerId: string;
  violationsCount: number;
  isLockedOut: boolean;
  lockedUntil: number;
  isDisqualified: boolean;
  onSubmitAnswer: (instanceId: string, answer: string) => Promise<{ correct?: boolean; earnedPoint?: boolean; error?: string }>;
  answerFeedback: {
    status: 'idle' | 'correct' | 'incorrect' | 'expired';
    message: string;
    earnedPoint?: boolean;
    canonical?: string;
  };
}

export const GameplayScreen: React.FC<GameplayScreenProps> = ({
  question,
  round,
  progress,
  required,
  totalScore,
  leaderboard,
  currentPlayerId,
  violationsCount,
  isLockedOut,
  lockedUntil,
  isDisqualified,
  onSubmitAnswer,
  answerFeedback,
}) => {
  const [answerInput, setAnswerInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(30);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input automatically whenever new question arrives
  useEffect(() => {
    setAnswerInput('');
    if (inputRef.current && !isLockedOut && !isDisqualified) {
      inputRef.current.focus();
    }
  }, [question?.instanceId, isLockedOut, isDisqualified]);

  // Question countdown timer
  useEffect(() => {
    if (!question) return;

    const updateTimer = () => {
      const now = Date.now();
      const left = Math.max(0, Math.ceil((question.expiresAt - now) / 1000));
      setSecondsRemaining(left);

      // Play tick on last 5 seconds
      if (left <= 5 && left > 0) {
        sound.playTick();
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 500);
    return () => clearInterval(interval);
  }, [question?.instanceId, question?.expiresAt]);

  // Lockout countdown timer
  useEffect(() => {
    if (!isLockedOut) {
      setLockoutRemaining(0);
      return;
    }

    const updateLockout = () => {
      const now = Date.now();
      const left = Math.max(0, Math.ceil((lockedUntil - now) / 1000));
      setLockoutRemaining(left);
    };

    updateLockout();
    const interval = setInterval(updateLockout, 250);
    return () => clearInterval(interval);
  }, [isLockedOut, lockedUntil]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question || !answerInput.trim() || isSubmitting || isLockedOut || isDisqualified) {
      return;
    }

    const currentAnswer = answerInput.trim();
    setIsSubmitting(true);

    try {
      const res = await onSubmitAnswer(question.instanceId, currentAnswer);
      if (res.correct) {
        setAnswerInput('');
      }
    } finally {
      setIsSubmitting(false);
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  };

  const timerPercent = question
    ? Math.max(0, Math.min(100, (secondsRemaining / question.timeLimitSeconds) * 100))
    : 100;

  const progressPercent = Math.min(100, (progress / required) * 100);

  return (
    <div className="flex-1 max-w-6xl w-full mx-auto px-4 py-4 md:py-6 flex flex-col">
      {/* Top Status & Progression HUD */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {/* Current Round HUD */}
        <div className="p-3 bg-game-surface border border-slate-800 rounded-2xl flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl">
            <Flame className="w-5 h-5 text-indigo-400 fill-indigo-400/20" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-mono font-bold text-slate-400">Current Round</div>
            <div className="text-xl font-black text-white font-mono">ROUND {round}</div>
          </div>
        </div>

        {/* Round Progress Bar HUD */}
        <div className="p-3 bg-game-surface border border-slate-800 rounded-2xl flex flex-col justify-center">
          <div className="flex justify-between items-center mb-1 text-xs">
            <span className="text-[10px] uppercase font-mono font-bold text-slate-400">Round Goal</span>
            <span className="font-mono font-bold text-indigo-300">
              {progress} / {required}
            </span>
          </div>
          <div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden border border-slate-800">
            <div
              className="bg-gradient-to-r from-indigo-500 to-violet-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Total Points HUD */}
        <div className="p-3 bg-game-surface border border-slate-800 rounded-2xl flex items-center gap-3">
          <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl">
            <Trophy className="w-5 h-5 text-amber-400 fill-amber-400/20" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-mono font-bold text-slate-400">Total Score</div>
            <div className="text-xl font-black text-amber-400 font-mono">{totalScore} PTS</div>
          </div>
        </div>

        {/* Question Timer HUD */}
        <div className="p-3 bg-game-surface border border-slate-800 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl ${
                secondsRemaining <= 5
                  ? 'bg-rose-500/20 text-rose-400 animate-pulse'
                  : 'bg-slate-800 text-slate-300'
              }`}
            >
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-mono font-bold text-slate-400">Timer</div>
              <div
                className={`text-xl font-black font-mono ${
                  secondsRemaining <= 5 ? 'text-rose-400' : 'text-white'
                }`}
              >
                {secondsRemaining}s
              </div>
            </div>
          </div>

          {/* Mini circular progress indicator */}
          <div className="w-8 h-8 rounded-full border-2 border-slate-800 flex items-center justify-center relative overflow-hidden">
            <div
              className={`absolute bottom-0 w-full transition-all duration-500 ${
                secondsRemaining <= 5 ? 'bg-rose-500' : 'bg-indigo-500'
              }`}
              style={{ height: `${timerPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Anti-Cheat / Lockout Warning Banner */}
      {isDisqualified && (
        <div className="mb-4 p-4 rounded-xl bg-rose-950/80 border border-rose-600 text-white flex items-center gap-3 animate-shake">
          <ShieldAlert className="w-6 h-6 text-rose-400 flex-shrink-0" />
          <div>
            <h4 className="font-bold text-sm">Disqualified for Anti-Cheat Violation</h4>
            <p className="text-xs text-rose-200">
              Multiple browser focus loss events were detected. You may spectate the remainder of the match.
            </p>
          </div>
        </div>
      )}

      {isLockedOut && !isDisqualified && (
        <div className="mb-4 p-3.5 rounded-xl bg-orange-950/80 border border-orange-500 text-white flex items-center gap-3 animate-shake">
          <Lock className="w-5 h-5 text-orange-400 flex-shrink-0 animate-bounce" />
          <div className="flex-1">
            <h4 className="font-bold text-xs uppercase tracking-wider text-orange-300">
              Focus Loss Penalty Active
            </h4>
            <p className="text-xs text-slate-200">
              Answer submission locked for <strong>{lockoutRemaining} seconds</strong> due to tab switching. Keep focus on the game window!
            </p>
          </div>
        </div>
      )}

      {/* Main Grid: Question Arena & Live Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
        {/* Question & Answer Column (2 spans on desktop) */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="bg-game-surface border border-slate-800 rounded-2xl p-6 md:p-8 flex-1 flex flex-col justify-between shadow-2xl relative overflow-hidden">
            {/* Category & Difficulty Tag Bar */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-bold uppercase tracking-wider">
                  {question?.category || 'General Knowledge'}
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border ${
                    question?.difficulty === 'easy'
                      ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800'
                      : question?.difficulty === 'medium'
                      ? 'bg-amber-950/60 text-amber-400 border-amber-800'
                      : 'bg-rose-950/60 text-rose-400 border-rose-800'
                  }`}
                >
                  {question?.difficulty || 'Normal'}
                </span>
              </div>

              {/* Focus warning count pill */}
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-semibold border ${
                  violationsCount === 0
                    ? 'bg-slate-900 text-slate-400 border-slate-800'
                    : 'bg-amber-950/80 text-amber-400 border-amber-800'
                }`}
                title="Focus Loss Violations Counter"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Violations: {violationsCount}/4</span>
              </div>
            </div>

            {/* Question Content */}
            <div className="my-auto py-4">
              {/* Optional Question Image */}
              {question?.imageUrl && (
                <div className="mb-5 max-w-md mx-auto rounded-xl overflow-hidden border border-slate-700 bg-slate-900 shadow-xl max-h-56">
                  <img
                    src={question.imageUrl}
                    alt={question.imageAltText || 'Question visual hint'}
                    className="w-full h-56 object-cover hover:scale-105 transition duration-300"
                    loading="eager"
                  />
                </div>
              )}

              {/* Question Text */}
              <h2 className="text-xl md:text-3xl font-extrabold text-white text-center leading-snug tracking-tight">
                {question?.questionText || 'Loading next question...'}
              </h2>
            </div>

            {/* Live Feedback Banner */}
            {answerFeedback.status !== 'idle' && (
              <div
                className={`mb-4 p-3 rounded-xl border text-sm font-semibold flex items-center justify-center gap-2 animate-pop ${
                  answerFeedback.status === 'correct'
                    ? 'bg-emerald-950/80 border-emerald-600 text-emerald-300 glow-correct'
                    : answerFeedback.status === 'expired'
                    ? 'bg-slate-900 border-slate-700 text-slate-300'
                    : 'bg-rose-950/80 border-rose-600 text-rose-300 animate-shake'
                }`}
              >
                {answerFeedback.status === 'correct' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                ) : answerFeedback.status === 'expired' ? (
                  <Clock className="w-5 h-5 text-slate-400" />
                ) : (
                  <XCircle className="w-5 h-5 text-rose-400" />
                )}
                <span>{answerFeedback.message}</span>
              </div>
            )}

            {/* Answer Input Field & Submit Button */}
            <form onSubmit={handleSubmit} className="mt-4">
              <div className="relative flex items-center">
                <input
                  ref={inputRef}
                  type="text"
                  value={answerInput}
                  onChange={(e) => setAnswerInput(e.target.value)}
                  disabled={isSubmitting || isLockedOut || isDisqualified}
                  placeholder={
                    isDisqualified
                      ? 'Disqualified from this match'
                      : isLockedOut
                      ? `Locked out (${lockoutRemaining}s remaining)...`
                      : 'Type your answer here and press Enter...'
                  }
                  className="w-full py-4 pl-5 pr-32 bg-slate-900 border-2 border-indigo-500/50 rounded-2xl text-white text-lg font-medium placeholder-slate-500 focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/20 disabled:opacity-50 transition shadow-inner"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck="false"
                />

                <button
                  type="submit"
                  disabled={
                    !answerInput.trim() ||
                    isSubmitting ||
                    isLockedOut ||
                    isDisqualified
                  }
                  className="absolute right-2.5 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-40 disabled:cursor-not-allowed font-bold text-white rounded-xl shadow-lg transition flex items-center gap-1.5 active:scale-95"
                >
                  <Send className="w-4 h-4" />
                  <span className="hidden sm:inline">Submit</span>
                </button>
              </div>

              <p className="text-center text-[11px] text-slate-500 mt-2">
                Press <strong>Enter</strong> to submit. Spelling counts, but capitalization & harmless punctuation are ignored.
              </p>
            </form>
          </div>
        </div>

        {/* Live Leaderboard Column */}
        <div className="bg-game-surface border border-slate-800 rounded-2xl p-5 shadow-2xl flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              <h3 className="font-bold text-sm uppercase tracking-wider text-white">Live Leaderboard</h3>
            </div>
            <span className="text-[10px] font-mono text-indigo-400 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-800">
              FIRST TO WIN
            </span>
          </div>

          <div className="divide-y divide-slate-800/60 overflow-y-auto max-h-[460px] flex-1 mt-2">
            {leaderboard.map((entry) => {
              const isMe = entry.playerId === currentPlayerId;
              return (
                <div
                  key={entry.playerId}
                  className={`py-3 px-2 flex items-center justify-between rounded-xl transition ${
                    isMe ? 'bg-indigo-950/40 border border-indigo-800/40 font-semibold' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Rank Badge */}
                    <div
                      className={`w-6 h-6 rounded-lg flex items-center justify-center font-mono font-bold text-xs ${
                        entry.rank === 1
                          ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/30'
                          : entry.rank === 2
                          ? 'bg-slate-300 text-slate-950'
                          : entry.rank === 3
                          ? 'bg-amber-700 text-white'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {entry.rank}
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm text-white max-w-[110px] truncate">
                          {entry.username}
                        </span>
                        {isMe && <span className="text-[10px] text-indigo-400 font-mono">(You)</span>}
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                        <span className="text-indigo-300">Rnd {entry.currentRound}</span>
                        <span>•</span>
                        <span>{entry.roundProgress}/{entry.requiredForRound}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-black font-mono text-base text-amber-400">
                      {entry.totalScore}
                    </div>
                    <div className="text-[10px] uppercase font-mono text-slate-500">
                      {entry.isDisqualified ? (
                        <span className="text-rose-400">DQ</span>
                      ) : !entry.isConnected ? (
                        <span className="text-slate-500">Offline</span>
                      ) : (
                        'Points'
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-3 border-t border-slate-800 text-center">
            <p className="text-[11px] text-slate-500">
              Players progress independently. Round advances immediately on goal completion.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
