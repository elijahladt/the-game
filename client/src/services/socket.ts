import { io, Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@quickfire/shared';

export const SESSION_STORAGE_KEY = 'quickfire_session_token';
export const SERVER_URL_STORAGE_KEY = 'quickfire_custom_server_url';

export function resolveServerUrl(): string {
  try {
    const custom = localStorage.getItem(SERVER_URL_STORAGE_KEY);
    if (custom && custom.trim()) return custom.trim();
  } catch {}

  if (import.meta.env.VITE_SERVER_URL) {
    return import.meta.env.VITE_SERVER_URL;
  }

  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:3001';
  }

  // Fallback to origin
  return typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001';
}

export let socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(resolveServerUrl(), {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 15,
  reconnectionDelay: 1000,
});

export function updateServerUrl(newUrl: string): void {
  try {
    localStorage.setItem(SERVER_URL_STORAGE_KEY, newUrl.trim());
    socket.disconnect();
    socket = io(newUrl.trim(), {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 15,
      reconnectionDelay: 1000,
    });
  } catch {}
}

export function saveSessionToken(token: string): void {
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, token);
  } catch {}
}

export function getSavedSessionToken(): string | null {
  try {
    return localStorage.getItem(SESSION_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function clearSessionToken(): void {
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {}
}
