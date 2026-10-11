import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import type { LeaderboardEntry } from '@quickfire/shared';
import { Trophy, RotateCcw, Home, Award, Zap, Clock, CheckCircle } from 'lucide-react';
import { sound } from '../utils/sound';

interface ResultsScreenProps {
  winnerId: string;
  winnerName: string;
  currentPlayerId: string;
  leaderboard: LeaderboardEntry[];
  matchStats: {
    durationSeconds: number;
    totalQuestionsAnswered: number;
  };
  onRematch: () => void;
  onReturnHome: () => void;
}

export const ResultsScreen: React.FC<ResultsScreenProps> = ({
  winnerId,
  winnerName,
  currentPlayerId,
  leaderboard,
  matchStats,
  onRematch,
  onReturnHome,
}) => {
  const isMeWinner = winnerId === currentPlayerId;

  useEffect(() => {
    sound.playVictory();

    // Trigger celebratory confetti burst
    try {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });

      const timer = setTimeout(() => {
        confetti({
          particleCount: 80,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
        });
        confetti({
          particleCount: 80,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
        });
      }, 500);

      return () => clearTimeout(timer);
    } catch (e) {
      // ignore
    }
  }, []);

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 max-w-4xl mx-auto w-full">
      {/* Winner Celebration Banner */}
      <div className="text-center mb-8 animate-pop">
        <div className="inline-flex p-4 rounded-3xl bg-amber-500/10 border border-amber-500/30 text-amber-400 mb-4 shadow-xl glow-gold">
          <Trophy className="w-12 h-12 fill-amber-400/20" />
        </div>

        <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight uppercase">
          {isMeWinner ? 'VICTORY IS YOURS!' : `${winnerName} WINS!`}
        </h1>
        <p className="text-slate-400 text-sm md:text-base mt-2">
          {isMeWinner
            ? 'You were the fastest to conquer the target round!'
            : `${winnerName} completed the target round faster than all contenders.`}
        </p>
      </div>

      {/* Match Stats Quick Glance */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full mb-6">
        <div className="p-3.5 bg-game-surface border border-slate-800 rounded-2xl text-center">
          <Clock className="w-5 h-5 text-indigo-400 mx-auto mb-1" />
          <div className="text-[10px] font-mono uppercase text-slate-400 font-bold">Match Time</div>
          <div className="text-lg font-black text-white font-mono">
            {Math.floor(matchStats.durationSeconds / 60)}m {matchStats.durationSeconds % 60}s
          </div>
        </div>

        <div className="p-3.5 bg-game-surface border border-slate-800 rounded-2xl text-center">
          <CheckCircle className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
          <div className="text-[10px] font-mono uppercase text-slate-400 font-bold">Answered</div>
          <div className="text-lg font-black text-white font-mono">
            {matchStats.totalQuestionsAnswered} Qs
          </div>
        </div>

        <div className="p-3.5 bg-game-surface border border-slate-800 rounded-2xl text-center">
          <Award className="w-5 h-5 text-amber-400 mx-auto mb-1" />
          <div className="text-[10px] font-mono uppercase text-slate-400 font-bold">Top Score</div>
          <div className="text-lg font-black text-amber-400 font-mono">
            {leaderboard[0]?.totalScore || 0} PTS
          </div>
        </div>

        <div className="p-3.5 bg-game-surface border border-slate-800 rounded-2xl text-center">
          <Zap className="w-5 h-5 text-violet-400 mx-auto mb-1" />
          <div className="text-[10px] font-mono uppercase text-slate-400 font-bold">Contenders</div>
          <div className="text-lg font-black text-white font-mono">
            {leaderboard.length} Players
          </div>
        </div>
      </div>

      {/* Final Standings Table */}
      <div className="w-full bg-game-surface border border-slate-800 rounded-2xl p-6 shadow-2xl mb-6">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-4 flex items-center gap-2">
          <Award className="w-4 h-4 text-amber-400" />
          Final Match Standings
        </h3>

        <div className="divide-y divide-slate-800/80">
          {leaderboard.map((player) => {
            const isMe = player.playerId === currentPlayerId;
            return (
              <div
                key={player.playerId}
                className={`py-3.5 px-3 flex items-center justify-between rounded-xl transition ${
                  isMe ? 'bg-indigo-950/40 border border-indigo-800/50 font-semibold' : ''
                }`}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center font-mono font-bold text-sm ${
                      player.rank === 1
                        ? 'bg-amber-400 text-slate-950 font-black shadow-lg shadow-amber-400/40'
                        : player.rank === 2
                        ? 'bg-slate-300 text-slate-950'
                        : player.rank === 3
                        ? 'bg-amber-700 text-white'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    #{player.rank}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-base">{player.username}</span>
                      {player.isWinner && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-400 border border-amber-400/40 text-[10px] font-bold uppercase">
                          Winner
                        </span>
                      )}
                      {isMe && <span className="text-xs text-indigo-400 font-mono">(You)</span>}
                    </div>
                    <span className="text-xs text-slate-400 font-mono">
                      Completed Round {player.currentRound - (player.isWinner ? 1 : 0)}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xl font-black font-mono text-amber-400">
                    {player.totalScore} PTS
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    {player.isDisqualified ? (
                      <span className="text-rose-400 font-bold">DISQUALIFIED</span>
                    ) : (
                      'Final Points'
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md">
        <button
          onClick={onRematch}
          className="flex-1 py-3.5 px-6 bg-indigo-600 hover:bg-indigo-500 font-bold text-white rounded-xl shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Play Again</span>
        </button>

        <button
          onClick={onReturnHome}
          className="flex-1 py-3.5 px-6 bg-slate-800 hover:bg-slate-700 border border-slate-700 font-semibold text-slate-200 rounded-xl flex items-center justify-center gap-2 transition"
        >
          <Home className="w-4 h-4" />
          <span>Return Home</span>
        </button>
      </div>
    </div>
  );
};
