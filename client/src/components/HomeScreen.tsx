import React, { useState } from 'react';
import { Play, PlusCircle, LogIn, Sparkles, Zap, ShieldCheck, Trophy, Layers } from 'lucide-react';

interface HomeScreenProps {
  username: string;
  onUsernameChange: (name: string) => void;
  onQuickPlay: () => void;
  onCreateRoom: (isTestMode: boolean, targetRound: number) => void;
  onJoinRoom: (roomCode: string) => void;
  onOpenRules: () => void;
  isLoading: boolean;
  errorMessage: string | null;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  username,
  onUsernameChange,
  onQuickPlay,
  onCreateRoom,
  onJoinRoom,
  onOpenRules,
  isLoading,
  errorMessage,
}) => {
  const [joinCode, setJoinCode] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [targetRound, setTargetRound] = useState(10);
  const [isTestMode, setIsTestMode] = useState(false);

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (joinCode.trim().length === 6) {
      onJoinRoom(joinCode.trim().toUpperCase());
    }
  };

  const handleConfirmCreate = () => {
    setShowCreateModal(false);
    onCreateRoom(isTestMode, targetRound);
  };

  const isNameValid = username.trim().length >= 2;

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 max-w-4xl mx-auto w-full">
      {/* Hero Badge */}
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-6 animate-pulse">
        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
        <span>Real-Time Online Progressive Multiplayer Trivia</span>
      </div>

      {/* Main Title & Tagline */}
      <h1 className="text-4xl md:text-6xl font-black text-center tracking-tight text-white mb-3">
        BE FAST.{' '}
        <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-violet-400 to-amber-400">
          BE FIRST.
        </span>{' '}
        SURVIVE.
      </h1>
      <p className="text-slate-400 text-center max-w-xl text-sm md:text-base mb-8">
        First correct answer takes the point. Advance through escalating rounds independently.
        Can you conquer Round 10 before your rivals?
      </p>

      {/* Error alert if any */}
      {errorMessage && (
        <div className="w-full max-w-md mb-6 p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-sm text-center animate-shake">
          {errorMessage}
        </div>
      )}

      {/* Center Interactive Action Card */}
      <div className="w-full max-w-md bg-game-surface border border-slate-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
        <div className="space-y-4">
          {/* Username Input */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Player Nickname
            </label>
            <div className="relative">
              <input
                type="text"
                value={username}
                onChange={(e) => onUsernameChange(e.target.value)}
                placeholder="Enter nickname (2-16 chars)"
                maxLength={16}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
              />
              <span className="absolute right-3 top-3.5 text-xs text-slate-500 font-mono">
                {username.length}/16
              </span>
            </div>
            {!isNameValid && username.length > 0 && (
              <p className="text-xs text-amber-400 mt-1">Nickname must be at least 2 characters</p>
            )}
          </div>

          {/* Quick Play CTA */}
          <button
            onClick={onQuickPlay}
            disabled={!isNameValid || isLoading}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition transform active:scale-98"
          >
            <Play className="w-5 h-5 fill-white" />
            <span>{isLoading ? 'Connecting...' : 'QUICK PLAY'}</span>
          </button>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-slate-800"></div>
            <span className="flex-shrink mx-3 text-slate-500 text-xs uppercase font-mono">or lobby options</span>
            <div className="flex-grow border-t border-slate-800"></div>
          </div>

          {/* Create Private Lobby Button */}
          <button
            onClick={() => setShowCreateModal(true)}
            disabled={!isNameValid || isLoading}
            className="w-full py-3 px-4 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 disabled:opacity-50 text-slate-200 font-semibold rounded-xl flex items-center justify-center gap-2 transition"
          >
            <PlusCircle className="w-4 h-4 text-indigo-400" />
            <span>Create Private Room</span>
          </button>

          {/* Join via Room Code Input & Button */}
          <form onSubmit={handleJoinSubmit} className="flex gap-2">
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="ROOM CODE (e.g. ABC123)"
              maxLength={6}
              className="flex-1 px-3.5 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 font-mono text-sm tracking-wider uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={!isNameValid || joinCode.trim().length !== 6 || isLoading}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl flex items-center gap-1.5 transition text-sm"
            >
              <LogIn className="w-4 h-4" />
              <span>Join</span>
            </button>
          </form>

          {/* How to Play CTA */}
          <button
            type="button"
            onClick={onOpenRules}
            className="w-full py-2 px-3 text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center justify-center gap-1.5 transition hover:underline"
          >
            <span>Read Rules & Anti-Cheat System</span>
          </button>
        </div>
      </div>

      {/* Feature Highlights Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl w-full mt-10">
        <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 flex items-start gap-3">
          <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
            <Zap className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white">First-Correct Scoring</h4>
            <p className="text-xs text-slate-400 mt-1">
              Atomic server arbitration awards points only to the fastest verified answer.
            </p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 flex items-start gap-3">
          <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
            <Layers className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white">Independent Progression</h4>
            <p className="text-xs text-slate-400 mt-1">
              Never wait on opponents. Advance through difficulty tiers at your personal pace.
            </p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 flex items-start gap-3">
          <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white">Focus Anti-Cheat</h4>
            <p className="text-xs text-slate-400 mt-1">
              Real-time window focus validation locks out alt-tabbing and search engine cheating.
            </p>
          </div>
        </div>
      </div>

      {/* Create Room Customization Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-pop">
          <div className="bg-game-surface border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-400" />
              Configure Match Settings
            </h3>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-2">
                Winning Target Round
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[3, 5, 10].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setTargetRound(r)}
                    className={`py-2 text-sm font-bold rounded-xl border transition ${
                      targetRound === r
                        ? 'bg-indigo-600 border-indigo-500 text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    Round {r}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-1.5">
                {targetRound === 3
                  ? '⚡ Blitz (quick 3-minute game)'
                  : targetRound === 5
                  ? '🎯 Standard match'
                  : '🏆 Full Championship (complete Round 10)'}
              </p>
            </div>

            {/* Local Test Mode Toggle */}
            <div className="p-3.5 bg-slate-900/80 rounded-xl border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-sm font-semibold text-white block">Local Test Mode</span>
                <span className="text-xs text-slate-400 block">
                  Allows starting solo (1 player) and testing gameplay instantly.
                </span>
              </div>
              <input
                type="checkbox"
                checked={isTestMode}
                onChange={(e) => setIsTestMode(e.target.checked)}
                className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
              />
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmCreate}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 font-semibold text-white rounded-xl shadow-lg text-sm"
              >
                Create Room
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
