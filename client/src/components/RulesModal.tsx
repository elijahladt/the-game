import React from 'react';
import { X, ShieldAlert, Award, TrendingUp, Trophy } from 'lucide-react';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RulesModal: React.FC<RulesModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-pop"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl bg-game-surface border border-slate-700/80 rounded-2xl shadow-2xl p-6 md:p-8 text-slate-100 max-h-[90vh] overflow-y-auto"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 bg-indigo-500/20 text-indigo-400 rounded-xl">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white">How to Play Quickfire</h2>
            <p className="text-sm text-slate-400">Rules, Progression & Anti-Cheat System</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Rule 1: First-Correct Scoring */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
            <div className="flex items-center gap-2.5 text-amber-400 font-semibold mb-1.5">
              <Award className="w-5 h-5" />
              <span>1. First-Correct-Answer Scoring</span>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              Quickfire is all about speed and precision! On any given question, only the <strong>very first player</strong> to submit the correct answer earns a point. Simultaneous submissions are arbitrated by authoritative server receipt order.
            </p>
            <p className="text-xs text-slate-400 mt-2">
              • Incorrect submissions earn 0 points, but you can retry as many times as you like while time remains.
            </p>
          </div>

          {/* Rule 2: Independent Progression */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
            <div className="flex items-center gap-2.5 text-indigo-400 font-semibold mb-1.5">
              <TrendingUp className="w-5 h-5" />
              <span>2. Independent Round Progression</span>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              Players advance through rounds <strong>at their own pace</strong>! You don't have to wait for other players. Each round demands more correct answers:
            </p>
            <div className="grid grid-cols-3 gap-2 mt-3 text-center text-xs font-mono">
              <div className="p-2 bg-slate-800/60 rounded-lg">Round 1: <strong className="text-indigo-300">3 answers</strong></div>
              <div className="p-2 bg-slate-800/60 rounded-lg">Round 2: <strong className="text-indigo-300">4 answers</strong></div>
              <div className="p-2 bg-slate-800/60 rounded-lg">Round N: <strong className="text-indigo-300">2 + N</strong></div>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              At the beginning of each round, your progress counter resets to zero while question difficulty increases.
            </p>
          </div>

          {/* Rule 3: Winning Condition */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
            <div className="flex items-center gap-2.5 text-emerald-400 font-semibold mb-1.5">
              <Trophy className="w-5 h-5" />
              <span>3. Winning Condition</span>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              The match is won immediately by the <strong>first player to conquer Round 10</strong> (or the custom target round configured in private lobbies)!
            </p>
          </div>

          {/* Rule 4: Anti-Cheat Focus System */}
          <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-900/40">
            <div className="flex items-center gap-2.5 text-rose-400 font-semibold mb-1.5">
              <ShieldAlert className="w-5 h-5" />
              <span>4. Anti-Cheat Browser Focus Detection</span>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              To keep trivia fair and prevent alt-tabbing to search engines, tab-switching during an active question triggers graduated server-side penalties:
            </p>
            <ul className="text-xs text-slate-300 mt-2.5 space-y-1.5 list-disc list-inside">
              <li><strong className="text-amber-400">1st Violation:</strong> Warning banner only.</li>
              <li><strong className="text-orange-400">2nd Violation:</strong> 5-second answer submission lockout.</li>
              <li><strong className="text-rose-400">3rd Violation:</strong> Deduction of 1 earned point.</li>
              <li><strong className="text-red-500">4th Violation:</strong> Disqualification from the match.</li>
            </ul>
            <p className="text-xs text-slate-400 mt-2">
              *Focus detection is active only during active questions (never in lobbies or results screens) and includes debouncing for accidental events.
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 font-medium text-white rounded-xl shadow-lg transition"
          >
            Got it, Let's Play!
          </button>
        </div>
      </div>
    </div>
  );
};
