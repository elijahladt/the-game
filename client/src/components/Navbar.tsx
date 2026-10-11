import React, { useState } from 'react';
import { Zap, Volume2, VolumeX, HelpCircle, Settings } from 'lucide-react';
import { sound } from '../utils/sound';

interface NavbarProps {
  isConnected: boolean;
  onOpenRules: () => void;
  onOpenServerConfig: () => void;
  roomCode?: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  isConnected,
  onOpenRules,
  onOpenServerConfig,
  roomCode,
}) => {
  const [isMuted, setIsMuted] = useState(sound.getIsMuted());

  const handleToggleSound = () => {
    const muted = sound.toggleMute();
    setIsMuted(muted);
  };

  return (
    <header className="w-full border-b border-slate-800/80 bg-game-surface/80 backdrop-blur-md sticky top-0 z-40 px-4 py-3">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        {/* Brand Logo */}
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-gradient-to-tr from-indigo-600 to-violet-500 rounded-xl shadow-md text-white shadow-indigo-500/20">
            <Zap className="w-5 h-5 fill-amber-300 text-amber-300" />
          </div>
          <div>
            <span className="text-xl font-black tracking-wider text-white font-mono uppercase bg-clip-text text-transparent bg-gradient-to-r from-white via-indigo-200 to-indigo-400">
              QUICKFIRE
            </span>
            <span className="hidden sm:inline-block ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800/60 uppercase tracking-widest">
              Live Trivia
            </span>
          </div>
        </div>

        {/* Room Code Indicator if present */}
        {roomCode && (
          <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-slate-900 border border-slate-700/60 rounded-xl font-mono text-sm">
            <span className="text-slate-400 text-xs">ROOM:</span>
            <span className="font-bold text-indigo-400 tracking-wider">{roomCode}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Mode Pill & Server Settings trigger */}
          <button
            onClick={onOpenServerConfig}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition cursor-pointer hover:opacity-90 ${
              isConnected
                ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60'
                : 'bg-indigo-950/60 text-indigo-300 border-indigo-800/60'
            }`}
            title="Click to view Multiplayer Connection Settings"
          >
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-indigo-400'}`} />
            <span>{isConnected ? 'ONLINE MULTIPLAYER' : 'IN-BROWSER MODE'}</span>
            <Settings className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
          </button>

          {/* Sound Toggle */}
          <button
            onClick={handleToggleSound}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition border border-slate-700/60"
            title={isMuted ? 'Unmute SFX' : 'Mute SFX'}
            aria-label="Sound Toggle"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-indigo-300" />}
          </button>

          {/* Rules Modal Trigger */}
          <button
            onClick={onOpenRules}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 hover:text-white transition border border-indigo-500/30 text-xs font-semibold"
          >
            <HelpCircle className="w-4 h-4" />
            <span className="hidden sm:inline">Rules</span>
          </button>
        </div>
      </div>
    </header>
  );
};
