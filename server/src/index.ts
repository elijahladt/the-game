import path from 'path';
import fs from 'fs';
import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  UsernameSchema,
  RoomCodeSchema,
  AnswerSubmissionSchema,
  MatchSettingsSchema,
} from '@quickfire/shared';
import { QuestionManager } from './game/QuestionManager.js';
import { MatchManager } from './game/MatchManager.js';
import { dbService } from './db/supabase.js';

dotenv.config();

const PORT = process.env.PORT || 3001;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

const httpServer = http.createServer(app);

const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const questionManager = new QuestionManager();

const matchManager = new MatchManager(
  questionManager,
  (room, event, data) => io.to(room).emit(event as any, data),
  (socketId, event, data) => io.to(socketId).emit(event as any, data)
);

// Health & Info Endpoints
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    questionsLoaded: questionManager.getQuestionsCount(),
  });
});

app.get('/api/categories', (req, res) => {
  res.json([
    'General Knowledge',
    'Geography',
    'History',
    'Science',
    'Sports',
    'Mathematics',
    'Gaming',
    'Entertainment',
  ]);
});

// Socket.IO Real-time Multiplayer Handlers
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  // Create Lobby (Quick Play or Private)
  socket.on('lobby:create', (data, callback) => {
    try {
      const username = UsernameSchema.parse(data.username);
      const isPrivate = data.isPrivate ?? true;
      const isTestMode = data.isTestMode ?? false;
      const targetRound = data.targetRound ?? (isTestMode ? 3 : 10);

      const { match, sessionToken, playerId } = matchManager.createMatch(
        username,
        socket.id,
        isPrivate,
        isTestMode,
        { targetRound }
      );

      socket.join(match.roomCode);

      if (callback) {
        callback({
          success: true,
          roomCode: match.roomCode,
          matchId: match.matchId,
          sessionToken,
          playerId,
          match: match.getSummary(),
        });
      }
    } catch (err: any) {
      if (callback) {
        callback({
          success: false,
          error: err?.errors?.[0]?.message || err.message || 'Failed to create lobby',
        });
      }
    }
  });

  // Join Lobby (via room code or Quick Play)
  socket.on('lobby:join', (data, callback) => {
    try {
      const username = UsernameSchema.parse(data.username);
      const roomCode = data.roomCode ? RoomCodeSchema.parse(data.roomCode) : undefined;

      const result = matchManager.joinMatch(username, socket.id, roomCode);

      if (!result.success || !result.match) {
        if (callback) {
          callback({ success: false, error: result.error || 'Failed to join match' });
        }
        return;
      }

      socket.join(result.match.roomCode);

      if (callback) {
        callback({
          success: true,
          roomCode: result.match.roomCode,
          matchId: result.match.matchId,
          sessionToken: result.sessionToken,
          playerId: result.playerId,
          match: result.match.getSummary(),
        });
      }
    } catch (err: any) {
      if (callback) {
        callback({
          success: false,
          error: err?.errors?.[0]?.message || err.message || 'Invalid join parameters',
        });
      }
    }
  });

  // Reconnect
  socket.on('lobby:reconnect', (data, callback) => {
    try {
      const result = matchManager.reconnect(data.sessionToken, socket.id);
      if (!result.success || !result.match) {
        if (callback) callback({ success: false, error: result.error });
        return;
      }

      socket.join(result.match.roomCode);

      if (callback) {
        callback({ success: true, match: result.match.getSummary() });
      }

      socket.emit('player:reconnected', {
        match: result.match.getSummary(),
        sessionToken: data.sessionToken,
      });
    } catch (err: any) {
      if (callback) callback({ success: false, error: err.message });
    }
  });

  // Player Ready Toggle
  socket.on('lobby:ready', (data) => {
    const playerRef = matchManager.getPlayerBySocket(socket.id);
    if (playerRef) {
      playerRef.match.setPlayerReady(playerRef.playerId, !!data.isReady);
    }
  });

  // Host Starts Match
  socket.on('lobby:start', () => {
    const playerRef = matchManager.getPlayerBySocket(socket.id);
    if (playerRef) {
      playerRef.match.startMatch();
    }
  });

  // Add Bot (Test mode / solo practice)
  socket.on('lobby:add_bot', () => {
    const playerRef = matchManager.getPlayerBySocket(socket.id);
    if (playerRef) {
      playerRef.match.addBot();
    }
  });

  // Leave Lobby
  socket.on('lobby:leave', () => {
    const playerRef = matchManager.getPlayerBySocket(socket.id);
    if (playerRef) {
      socket.leave(playerRef.match.roomCode);
      playerRef.match.removePlayer(playerRef.playerId);
    }
  });

  // Submit Answer
  socket.on('question:submit_answer', (data, callback) => {
    try {
      const parsed = AnswerSubmissionSchema.parse(data);
      const playerRef = matchManager.getPlayerBySocket(socket.id);

      if (!playerRef) {
        if (callback) callback({ received: false, error: 'Player session not found' });
        return;
      }

      const result = playerRef.match.submitAnswer(
        playerRef.playerId,
        parsed.instanceId,
        parsed.answer
      );

      if (callback) {
        callback(result);
      }
    } catch (err: any) {
      if (callback) {
        callback({
          received: false,
          error: err?.errors?.[0]?.message || 'Invalid answer format',
        });
      }
    }
  });

  // Anti-Cheat: Focus Lost
  socket.on('anticheat:focus_lost', (data) => {
    const playerRef = matchManager.getPlayerBySocket(socket.id);
    if (playerRef) {
      playerRef.match.registerFocusLoss(playerRef.playerId, data.eventType);
    }
  });

  // Rematch
  socket.on('match:rematch', () => {
    const playerRef = matchManager.getPlayerBySocket(socket.id);
    if (playerRef) {
      playerRef.match.resetForRematch();
    }
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
    matchManager.handleSocketDisconnect(socket.id);
  });
});

// Serve frontend static build if built alongside the server
const clientDistPath = path.resolve(__dirname, '../../client/dist');

if (fs.existsSync(clientDistPath)) {
  console.log(`📦 Serving frontend from ${clientDistPath}`);
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/health') || req.path.startsWith('/socket.io')) {
      return next();
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Boot Server & Load Questions
async function startServer() {
  try {
    const questions = await dbService.getActiveQuestions();
    questionManager.setQuestions(questions);
    console.log(`📚 Loaded ${questions.length} curated questions into Quickfire.`);

    httpServer.listen(PORT, () => {
      console.log(`🚀 Quickfire Authoritative Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start Quickfire server:', err);
    process.exit(1);
  }
}

startServer();

export { app, httpServer, matchManager, questionManager, io };
