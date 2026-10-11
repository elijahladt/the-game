import React, { useState } from 'react';
import type { MatchSummary, PlayerState } from '@quickfire/shared';
import {
  Users,
  Copy,
  Check,
  Crown,
  Bot,
  LogOut,
  Flame,
} from 'lucide-react';

interface LobbyScreenProps {
  match: MatchSummary;
  currentPlayerId: string;
  onToggleReady: (ready: boolean) => void;
  onStartMatch: () => void;
  onAddBot: () => void;
  onLeaveLobby: () => void;
}

export const LobbyScreen: React.FC<LobbyScreenProps> = ({
  match,
  currentPlayerId,
  onToggleReady,
  onStartMatch,
  onAddBot,
  onLeaveLobby,
}) => {
  const [copied, setCopied] = useState(false);

  const playersList: PlayerState[] = Object.values(match.players);
  const me = match.players[currentPlayerId];
  const isHost = me?.isHost;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(match.roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const minPlayers = match.settings.minPlayersToStart;
  const canStart = match.settings.isTestMode ? playersList.length >= 1 : playersList.length >= minPlayers;

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 max-w-4xl mx-auto w-full">
      {/* Lobby Header Card */}
      <div className="w-full bg-game-surface border border-slate-800 rounded-2xl p-6 shadow-2xl mb-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-mono px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                {match.isPrivate ? 'Private Room' : 'Public Lobby'}
              </span>
              {match.settings.isTestMode && (
                <span className="text-xs uppercase font-mono px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">
                  Local Test Mode
                </span>
              )}
            </div>
            <h2 className="text-2xl font-black text-white mt-1">QUICKFIRE LOBBY</h2>
            <p className="text-xs text-slate-400">
              Goal: First to finish <strong>Round {match.settings.targetRound}</strong> wins the match!
            </p>
          </div>

          {/* Room Code Badge with Copy button */}
          <div className="flex items-center gap-3 bg-slate-900 border border-slate-700/80 rounded-2xl px-5 py-3">
            <div>
              <div className="text-[10px] uppercase font-mono text-slate-500 font-bold">Invite Code</div>
              <div className="text-2xl font-black tracking-widest font-mono text-indigo-400">
                {match.roomCode}
              </div>
            </div>
            <button
              onClick={handleCopyCode}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
              title="Copy Room Code"
            >
              {copied ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Players List Grid */}
        <div className="py-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-300">
              <Users className="w-4 h-4 text-indigo-400" />
              <span>
                Players in Arena ({playersList.length}/{match.settings.maxPlayers})
              </span>
            </div>
            {isHost && playersList.length < match.settings.maxPlayers && (
              <button
                onClick={onAddBot}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 border border-slate-700 transition"
              >
                <Bot className="w-3.5 h-3.5 text-indigo-400" />
                <span>+ Add AI Opponent</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {playersList.map((player) => (
              <div
                key={player.id}
                className={`p-3.5 rounded-xl border flex items-center justify-between transition ${
                  player.id === currentPlayerId
                    ? 'bg-indigo-950/40 border-indigo-600/60 shadow-lg shadow-indigo-950/50'
                    : 'bg-slate-900/60 border-slate-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-slate-800 to-indigo-950 border border-slate-700 flex items-center justify-center font-bold text-base text-indigo-300">
                    {player.isBot ? (
                      <Bot className="w-5 h-5 text-indigo-400" />
                    ) : (
                      player.username.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-sm text-white max-w-[120px] truncate">
                        {player.username}
                      </span>
                      {player.isHost && (
                        <span title="Host">
                          <Crown className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {player.id === currentPlayerId ? 'You' : player.isBot ? 'Simulated AI' : 'Contender'}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  {player.isReady ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-bold uppercase tracking-wider">
                      <Check className="w-3 h-3" /> Ready
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 text-[10px] font-bold uppercase tracking-wider">
                      Waiting
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Lobby Actions Bar */}
        <div className="border-t border-slate-800/80 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <button
            onClick={onLeaveLobby}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 transition flex items-center justify-center gap-2 text-sm font-semibold"
          >
            <LogOut className="w-4 h-4" />
            <span>Leave Lobby</span>
          </button>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {/* Non-host Ready Toggle */}
            {!isHost && (
              <button
                onClick={() => onToggleReady(!me?.isReady)}
                className={`flex-1 sm:flex-none px-6 py-2.5 font-bold rounded-xl text-sm transition ${
                  me?.isReady
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30'
                }`}
              >
                {me?.isReady ? 'Ready! (Click to Unready)' : 'Ready Up'}
              </button>
            )}

            {/* Host Start Button */}
            {isHost && (
              <button
                onClick={onStartMatch}
                disabled={!canStart}
                className="flex-1 sm:flex-none px-8 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 disabled:cursor-not-allowed font-black text-slate-950 rounded-xl shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 tracking-wide transition transform active:scale-98 text-sm"
              >
                <Flame className="w-5 h-5 fill-slate-950" />
                <span>START MATCH</span>
              </button>
            )}
          </div>
        </div>

        {isHost && !canStart && (
          <p className="text-center text-xs text-amber-400 mt-3">
            Waiting for at least {minPlayers} players to join before match can start. (Or add an AI Opponent!)
          </p>
        )}
      </div>
    </div>
  );
};
