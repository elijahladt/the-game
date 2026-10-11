import { randomUUID } from 'crypto';
import {
  MatchSettings,
  MatchSummary,
  PlayerState,
  LeaderboardEntry,
  ClientQuestion,
} from '@quickfire/shared';
import { Match, MatchCallbacks } from './Match.js';
import { QuestionManager } from './QuestionManager.js';
import { dbService } from '../db/supabase.js';

interface SessionData {
  sessionToken: string;
  matchId: string;
  playerId: string;
  username: string;
}

export class MatchManager {
  private matches: Map<string, Match> = new Map(); // matchId -> Match
  private roomCodeToMatchId: Map<string, string> = new Map(); // roomCode -> matchId
  private sessions: Map<string, SessionData> = new Map(); // sessionToken -> SessionData
  private socketToPlayer: Map<string, { matchId: string; playerId: string }> = new Map();
  private questionManager: QuestionManager;

  // Broadcast callback to Socket.IO server
  private broadcastToRoom: (room: string, event: string, data: any) => void;
  private sendToSocket: (socketId: string, event: string, data: any) => void;

  constructor(
    questionManager: QuestionManager,
    broadcastToRoom: (room: string, event: string, data: any) => void,
    sendToSocket: (socketId: string, event: string, data: any) => void
  ) {
    this.questionManager = questionManager;
    this.broadcastToRoom = broadcastToRoom;
    this.sendToSocket = sendToSocket;
  }

  private generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    do {
      code = '';
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    } while (this.roomCodeToMatchId.has(code));
    return code;
  }

  private cleanupSocketOldMatches(socketId: string): void {
    const existing = this.socketToPlayer.get(socketId);
    if (existing) {
      const oldMatch = this.matches.get(existing.matchId);
      if (oldMatch) {
        oldMatch.removePlayer(existing.playerId);
        if (oldMatch.getPlayersCount() === 0) {
          oldMatch.cleanup();
          this.matches.delete(oldMatch.matchId);
          this.roomCodeToMatchId.delete(oldMatch.roomCode);
        }
      }
      this.socketToPlayer.delete(socketId);
    }
  }

  public createMatch(
    hostUsername: string,
    hostSocketId: string,
    isPrivate: boolean = true,
    isTestMode: boolean = false,
    settings: Partial<MatchSettings> = {}
  ): { match: Match; sessionToken: string; playerId: string } {
    // Clean up any lingering match or profile for this socket
    this.cleanupSocketOldMatches(hostSocketId);

    const matchId = randomUUID();
    const roomCode = this.generateRoomCode();
    const playerId = randomUUID();
    const sessionToken = randomUUID();

    const callbacks: MatchCallbacks = {
      onLobbyUpdated: (summary: MatchSummary) => {
        this.broadcastToRoom(roomCode, 'lobby:updated', { match: summary });
      },
      onMatchStarted: (summary: MatchSummary) => {
        this.broadcastToRoom(roomCode, 'match:started', { match: summary });
      },
      onQuestionAssigned: (socketId: string, data) => {
        this.sendToSocket(socketId, 'question:assigned', data);
      },
      onAnswerResult: (socketId: string, data) => {
        this.sendToSocket(socketId, 'answer:result', data);
      },
      onPlayerAdvanced: (data) => {
        this.broadcastToRoom(roomCode, 'player:advanced', data);
      },
      onLeaderboardUpdated: (leaderboard: LeaderboardEntry[]) => {
        this.broadcastToRoom(roomCode, 'leaderboard:updated', { leaderboard });
      },
      onAntiCheatWarning: (socketId: string, data) => {
        this.sendToSocket(socketId, 'anticheat:warning', data);
      },
      onMatchCompleted: (data) => {
        this.broadcastToRoom(roomCode, 'match:completed', data);
        const match = this.matches.get(matchId);
        if (match) {
          dbService.saveMatch(match.getSummary());
        }
      },
    };

    const match = new Match(
      matchId,
      roomCode,
      playerId,
      hostUsername,
      hostSocketId,
      isPrivate,
      { ...settings, isTestMode },
      this.questionManager,
      callbacks
    );

    this.matches.set(matchId, match);
    this.roomCodeToMatchId.set(roomCode, matchId);
    this.sessions.set(sessionToken, {
      sessionToken,
      matchId,
      playerId,
      username: hostUsername,
    });
    this.socketToPlayer.set(hostSocketId, { matchId, playerId });

    return { match, sessionToken, playerId };
  }

  public joinMatch(
    username: string,
    socketId: string,
    roomCode?: string
  ): { success: boolean; match?: Match; sessionToken?: string; playerId?: string; error?: string } {
    // Clean up any lingering match or profile for this socket
    this.cleanupSocketOldMatches(socketId);

    let targetMatchId: string | undefined;

    if (roomCode) {
      const code = roomCode.trim().toUpperCase();
      targetMatchId = this.roomCodeToMatchId.get(code);
      if (!targetMatchId) {
        return { success: false, error: 'Room code not found' };
      }
    } else {
      // Quick Play: find open waiting public match
      for (const m of this.matches.values()) {
        if (!m.isPrivate && m.status === 'waiting') {
          targetMatchId = m.matchId;
          break;
        }
      }

      // If no open public match exists, create one
      if (!targetMatchId) {
        const created = this.createMatch(username, socketId, false, false);
        return {
          success: true,
          match: created.match,
          sessionToken: created.sessionToken,
          playerId: created.playerId,
        };
      }
    }

    const match = this.matches.get(targetMatchId);
    if (!match) {
      return { success: false, error: 'Match no longer exists' };
    }

    if (match.status !== 'waiting') {
      return { success: false, error: 'Match has already started' };
    }

    const playerId = randomUUID();
    const sessionToken = randomUUID();

    const added = match.addPlayer(playerId, username, socketId, false, false);
    if (!added) {
      return { success: false, error: 'Lobby is full' };
    }

    this.sessions.set(sessionToken, {
      sessionToken,
      matchId: match.matchId,
      playerId,
      username,
    });
    this.socketToPlayer.set(socketId, { matchId: match.matchId, playerId });

    return { success: true, match, sessionToken, playerId };
  }

  public reconnect(
    sessionToken: string,
    newSocketId: string
  ): { success: boolean; match?: Match; player?: PlayerState; error?: string } {
    const session = this.sessions.get(sessionToken);
    if (!session) {
      return { success: false, error: 'Session token invalid or expired' };
    }

    const match = this.matches.get(session.matchId);
    if (!match) {
      return { success: false, error: 'Match has ended' };
    }

    const player = match.handleReconnect(session.playerId, newSocketId);
    if (!player) {
      return { success: false, error: 'Player record not found in match' };
    }

    this.socketToPlayer.set(newSocketId, { matchId: match.matchId, playerId: player.id });

    return { success: true, match, player };
  }

  public handleSocketDisconnect(socketId: string): void {
    const ref = this.socketToPlayer.get(socketId);
    if (!ref) return;

    this.socketToPlayer.delete(socketId);
    const match = this.matches.get(ref.matchId);
    if (match) {
      match.handleDisconnect(ref.playerId);
    }
  }

  public getPlayerBySocket(socketId: string): { match: Match; playerId: string } | null {
    const ref = this.socketToPlayer.get(socketId);
    if (!ref) return null;
    const match = this.matches.get(ref.matchId);
    if (!match) return null;
    return { match, playerId: ref.playerId };
  }

  public getMatchById(matchId: string): Match | undefined {
    return this.matches.get(matchId);
  }

  public getMatchByCode(roomCode: string): Match | undefined {
    const matchId = this.roomCodeToMatchId.get(roomCode.trim().toUpperCase());
    return matchId ? this.matches.get(matchId) : undefined;
  }
}
