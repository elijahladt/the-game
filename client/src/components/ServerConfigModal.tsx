import React, { useState } from 'react';
import { X, Server, Globe, Check, AlertCircle, Sparkles } from 'lucide-react';
import { resolveServerUrl, updateServerUrl } from '../services/socket';

interface ServerConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  isConnected: boolean;
}

export const ServerConfigModal: React.FC<ServerConfigModalProps> = ({
  isOpen,
  onClose,
  isConnected,
}) => {
  const currentUrl = resolveServerUrl();
  const [urlInput, setUrlInput] = useState(currentUrl);
  const [saved, setSaved] = useState(false);

  if (!isOpen) return null;

  const isVercelUrl = typeof window !== 'undefined' && urlInput.includes(window.location.hostname);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateServerUrl(urlInput);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
      window.location.reload();
    }, 800);
  };

  const handleReset = () => {
    localStorage.removeItem('quickfire_custom_server_url');
    setUrlInput('http://localhost:3001');
    updateServerUrl('http://localhost:3001');
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
      window.location.reload();
    }, 800);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-pop"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg bg-game-surface border border-slate-700 rounded-2xl shadow-2xl p-6 text-slate-100"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 bg-indigo-500/20 text-indigo-400 rounded-xl">
            <Server className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Multiplayer Connection Status</h3>
            <div className="flex items-center gap-2 mt-0.5 text-xs">
              <span
                className={`w-2 h-2 rounded-full ${
                  isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-indigo-400'
                }`}
              />
              <span className={isConnected ? 'text-emerald-400 font-semibold' : 'text-indigo-300 font-medium'}>
                {isConnected ? 'Connected to Multiplayer Server' : 'Active in In-Browser Engine'}
              </span>
            </div>
          </div>
        </div>

        {/* Informative Notice */}
        {!isConnected && (
          <div className="mb-4 p-3.5 bg-indigo-950/40 rounded-xl border border-indigo-800/60 text-xs text-indigo-200 space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-indigo-300">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>You don't need to connect to play!</span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              Quickfire runs 100% in your browser with questions, escalating rounds, scoring, and AI opponents.
              Close this window and click <strong>QUICK PLAY</strong> to play right now!
            </p>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Multiplayer WebSocket Backend URL
            </label>
            <div className="relative">
              <Globe className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-500" />
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://your-backend.onrender.com"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {isVercelUrl && !isConnected && (
            <div className="p-3 bg-amber-950/50 rounded-xl border border-amber-800 text-xs text-amber-200 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <span>
                <strong>Notice:</strong> <code>{urlInput}</code> is your Vercel static website. Vercel cannot host WebSocket processes. To play live multiplayer with friends across different computers, deploy the backend to Render or Railway (see DEPLOYMENT.md) and paste that URL here.
              </span>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handleReset}
              className="text-xs text-slate-400 hover:text-white underline"
            >
              Reset to Localhost
            </button>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700"
              >
                Close & Play
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 font-semibold text-white text-xs rounded-xl flex items-center gap-1.5 shadow-lg"
              >
                {saved ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : null}
                <span>{saved ? 'Saved!' : 'Save & Connect'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
