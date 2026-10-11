import React, { useState } from 'react';
import { X, Server, Globe, Check, AlertCircle } from 'lucide-react';
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
        className="relative w-full max-w-md bg-game-surface border border-slate-700 rounded-2xl shadow-2xl p-6 text-slate-100"
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
            <h3 className="text-lg font-bold text-white">Multiplayer Server Settings</h3>
            <div className="flex items-center gap-1.5 mt-0.5 text-xs">
              <span
                className={`w-2 h-2 rounded-full ${
                  isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
                }`}
              />
              <span className={isConnected ? 'text-emerald-400 font-semibold' : 'text-rose-400'}>
                {isConnected ? 'Connected to Server' : 'Disconnected / Connecting'}
              </span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Authoritative Server URL
            </label>
            <div className="relative">
              <Globe className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-500" />
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://your-backend.up.railway.app"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {!isConnected && (
            <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 text-xs text-slate-400 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <span>
                When deployed on Vercel, the frontend runs as static SPA. Set this to your deployed WebSocket backend (e.g. Railway or Render) or set the <code>VITE_SERVER_URL</code> environment variable in your Vercel Project Settings.
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
                className="px-3.5 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl"
              >
                Cancel
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
