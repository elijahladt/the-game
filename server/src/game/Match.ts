import {
  MatchSettings,
  MatchStatus,
  MatchSummary,
  PlayerState,
  LeaderboardEntry,
  getRequiredAnswersForRound,
  ClientQuestion,
} from '@quickfire/shared';
import { QuestionManager } from './QuestionManager.js';
import { AntiCheatEngine, DEFAULT_FOCUS_CONFIG } from './AntiCheatEngine.js';

export interface MatchCallbacks {
  onLobbyUpdated: (summary: MatchSummary) => void;
  onMatchStarted: (summary: MatchSummary) => void;
  onQuestionAssigned: (
    socketId: string,
    data: { question: ClientQuestion; round: number; progress: number; required: number }
  ) => void;
  onAnswerResult: (
    socketId: string,
    data: {
      correct: boolean;
      earnedPoint: boolean;
      canonicalAnswer?: string;
      message: string;
      roundAdvanced?: boolean;
      newRound?: number;
      totalScore: number;
      roundProgress: number;
      requiredForRound: number;
      winnerName?: string;
    }
  ) => void;
  onPlayerAdvanced: (data: {
    playerId: string;
    username: string;
    newRound: number;
    totalScore: number;
  }) => void;
  onLeaderboardUpdated: (leaderboard: LeaderboardEntry[]) => void;
  onAntiCheatWarning: (
    socketId: string,
    data: {
      violationsCount: number;
      penalty: string;
      message: string;
      lockedUntil?: number;
    }
  ) => void;
  onMatchCompleted: (data: {
    winnerId: string;
    winnerName: string;
    finalLeaderboard: LeaderboardEntry[];
    matchStats: {
      durationSeconds: number;
      totalQuestionsAnswered: number;
    };
  }) => void;
}

export class Match {
  public readonly matchId: string;
  public readonly roomCode: string;
  public readonly isPrivate: boolean;
  public status: MatchStatus = 'waiting';
  public settings: MatchSettings;

  private players: Map<string, PlayerState> = new Map();
  private hostPlayerId: string;
  private winnerPlayerId: string | null = null;
  private winnerUsername: string | null = null;
  private startedAt: number | null = null;
  private endedAt: number | null = null;

  private questionManager: QuestionManager;
  private antiCheatEngine: AntiCheatEngine;
  private callbacks: MatchCallbacks;

  // Rate-limiting: playerId -> last submission timestamp
  private lastSubmissionTimes: Map<string, number> = new Map();
  // Question timers: playerId -> NodeJS.Timeout
  private questionTimers: Map<string, NodeJS.Timeout> = new Map();
  // Bot loop timers
  private botTimers: Map<string, NodeJS.Timeout> = new Map();

  // Shared active question for all players in this match
  private currentSharedQuestion: ClientQuestion | null = null;
  private currentSharedInstanceId: string | null = null;
  private sharedQuestionTimer: NodeJS.Timeout | null = null;
  private sharedNextTransitionTimer: NodeJS.Timeout | null = null;

  constructor(
    matchId: string,
    roomCode: string,
    hostPlayerId: string,
    hostUsername: string,
    hostSocketId: string,
    isPrivate: boolean = false,
    settings: Partial<MatchSettings> = {},
    questionManager: QuestionManager,
    callbacks: MatchCallbacks
  ) {
    this.matchId = matchId;
    this.roomCode = roomCode;
    this.hostPlayerId = hostPlayerId;
    this.isPrivate = isPrivate;
    this.questionManager = questionManager;
    this.callbacks = callbacks;
    this.antiCheatEngine = new AntiCheatEngine();

    this.settings = {
      targetRound: settings.targetRound ?? 10,
      questionTimeLimitSeconds: settings.questionTimeLimitSeconds ?? 30,
      minPlayersToStart: settings.minPlayersToStart ?? (settings.isTestMode ? 1 : 2),
      maxPlayers: settings.maxPlayers ?? 12,
      antiCheatEnabled: settings.antiCheatEnabled ?? true,
      isTestMode: settings.isTestMode ?? false,
    };

    // Add host as first player
    this.addPlayer(hostPlayerId, hostUsername, hostSocketId, true);
  }

  public getPlayersCount(): number {
    return this.players.size;
  }

  public addPlayer(
    playerId: string,
    username: string,
    socketId: string,
    isHost: boolean = false,
    isBot: boolean = false
  ): boolean {
    if (this.players.size >= this.settings.maxPlayers && !this.players.has(playerId)) {
      return false;
    }

    // Clean up any stale/duplicate player with the same username or socket in this room
    for (const [existingId, p] of this.players.entries()) {
      if (
        p.username.trim().toLowerCase() === username.trim().toLowerCase() ||
        p.socketId === socketId
      ) {
        this.clearBotTimer(existingId);
        this.clearPlayerQuestionTimer(existingId);
        this.players.delete(existingId);
        break;
      }
    }

    const player: PlayerState = {
      id: playerId,
      socketId,
      username,
      avatarSeed: username.toLowerCase().replace(/[^a-z0-9]/g, '') || 'player',
      isReady: isHost || isBot, // host and bots ready by default
      isHost,
      isConnected: true,
      isBot,
      currentRound: 1,
      roundCorrectAnswers: 0,
      totalScore: 0,
      highestRound: 1,
      totalSubmissions: 0,
      correctSubmissions: 0,
      fastestAnswerMs: 999999,
      currentQuestion: this.currentSharedQuestion,
      focusStatus: this.antiCheatEngine.createInitialPlayerStatus(),
    };

    this.players.set(playerId, player);
    this.callbacks.onLobbyUpdated(this.getSummary());
    return true;
  }

  public removePlayer(playerId: string): void {
    const player = this.players.get(playerId);
    if (!player) return;

    this.clearPlayerQuestionTimer(playerId);
    this.clearBotTimer(playerId);
    this.players.delete(playerId);

    if (this.players.size === 0) {
      this.status = 'abandoned';
      return;
    }

    // Pass host if needed
    if (this.hostPlayerId === playerId) {
      const remainingHuman = Array.from(this.players.values()).find((p) => !p.isBot);
      if (remainingHuman) {
        this.hostPlayerId = remainingHuman.id;
        remainingHuman.isHost = true;
      } else {
        const next = this.players.values().next().value;
        if (next) {
          this.hostPlayerId = next.id;
          next.isHost = true;
        }
      }
    }

    this.callbacks.onLobbyUpdated(this.getSummary());
    if (this.status === 'in_progress') {
      this.callbacks.onLeaderboardUpdated(this.getLeaderboard());
      this.checkCompletion();
    }
  }

  public setPlayerReady(playerId: string, isReady: boolean): void {
    const player = this.players.get(playerId);
    if (player && this.status === 'waiting') {
      player.isReady = isReady;
      this.callbacks.onLobbyUpdated(this.getSummary());
    }
  }

  public addBot(): boolean {
    if (this.status !== 'waiting' || this.players.size >= this.settings.maxPlayers) {
      return false;
    }

    const botNumber = Array.from(this.players.values()).filter((p) => p.isBot).length + 1;
    const botId = `bot-${Date.now()}-${botNumber}`;
    const botNames = ['PixelPro', 'TriviaBot', 'BrainyNova', 'QuizWhiz', 'SpeedyFox'];
    const botName = botNames[(botNumber - 1) % botNames.length] + ` [AI]`;

    return this.addPlayer(botId, botName, `socket-${botId}`, false, true);
  }

  public canStart(): boolean {
    if (this.status !== 'waiting') return false;
    const count = this.players.size;
    if (this.settings.isTestMode) {
      return count >= 1;
    }
    return count >= this.settings.minPlayersToStart;
  }

  public startMatch(): boolean {
    if (!this.canStart()) return false;

    this.status = 'in_progress';
    this.startedAt = Date.now();

    const summary = this.getSummary();
    this.callbacks.onMatchStarted(summary);
    this.callbacks.onLeaderboardUpdated(this.getLeaderboard());

    // Assign the shared initial question to all players simultaneously
    this.assignSharedNextQuestion();

    return true;
  }

  public assignNextQuestion(_playerId?: string): void {
    this.assignSharedNextQuestion();
  }

  public assignSharedNextQuestion(): void {
    if (this.status !== 'in_progress') return;

    if (this.sharedQuestionTimer) {
      clearTimeout(this.sharedQuestionTimer);
      this.sharedQuestionTimer = null;
    }
    if (this.sharedNextTransitionTimer) {
      clearTimeout(this.sharedNextTransitionTimer);
      this.sharedNextTransitionTimer = null;
    }

    // Clear all bot timers
    for (const timer of this.botTimers.values()) clearTimeout(timer);
    this.botTimers.clear();

    // Use current highest round among active players for question difficulty
    let targetRound = 1;
    for (const p of this.players.values()) {
      if (!p.focusStatus.isDisqualified && p.currentRound > targetRound) {
        targetRound = p.currentRound;
      }
    }

    const { instance, clientQuestion } = this.questionManager.createQuestionInstance(
      this.matchId,
      'shared',
      targetRound,
      this.settings.questionTimeLimitSeconds
    );

    this.currentSharedQuestion = clientQuestion;
    this.currentSharedInstanceId = instance.instanceId;

    // Assign identical question to all players simultaneously
    for (const player of this.players.values()) {
      if (player.focusStatus.isDisqualified) continue;
      player.currentQuestion = clientQuestion;

      if (!player.isBot) {
        this.callbacks.onQuestionAssigned(player.socketId, {
          question: clientQuestion,
          round: player.currentRound,
          progress: player.roundCorrectAnswers,
          required: getRequiredAnswersForRound(player.currentRound),
        });
      } else {
        this.scheduleBotAnswer(player, instance.instanceId, instance.canonicalAnswer);
      }
    }

    // Set shared question timer
    this.sharedQuestionTimer = setTimeout(() => {
      this.handleSharedQuestionTimeout(instance.instanceId);
    }, this.settings.questionTimeLimitSeconds * 1000);
  }

  private handleSharedQuestionTimeout(instanceId: string): void {
    if (this.status !== 'in_progress' || this.currentSharedInstanceId !== instanceId) return;

    if (this.sharedQuestionTimer) {
      clearTimeout(this.sharedQuestionTimer);
      this.sharedQuestionTimer = null;
    }

    for (const timer of this.botTimers.values()) clearTimeout(timer);
    this.botTimers.clear();

    const instance = this.questionManager.getInstance(instanceId);
    this.questionManager.expireInstance(instanceId);

    // Notify all human players that time is up
    for (const player of this.players.values()) {
      if (!player.isBot && !player.focusStatus.isDisqualified) {
        this.callbacks.onAnswerResult(player.socketId, {
          correct: false,
          earnedPoint: false,
          canonicalAnswer: instance?.canonicalAnswer,
          message: 'Time is up! Moving to the next question...',
          totalScore: player.totalScore,
          roundProgress: player.roundCorrectAnswers,
          requiredForRound: getRequiredAnswersForRound(player.currentRound),
        });
      }
    }

    // Advance everyone together to next question
    if (this.settings.isTestMode) {
      this.assignSharedNextQuestion();
    } else {
      this.sharedNextTransitionTimer = setTimeout(() => {
        if (this.status === 'in_progress') {
          this.assignSharedNextQuestion();
        }
      }, 1000);
    }
  }

  public submitAnswer(
    playerId: string,
    instanceId: string,
    answer: string
  ): { received: boolean; correct?: boolean; earnedPoint?: boolean; error?: string } {
    const player = this.players.get(playerId);
    if (!player) {
      return { received: false, error: 'Player not in match' };
    }

    if (this.status !== 'in_progress') {
      return { received: false, error: 'Match is not in progress' };
    }

    // Anti-cheat verification
    if (this.settings.antiCheatEnabled) {
      const check = this.antiCheatEngine.canSubmitAnswer(player.focusStatus);
      if (!check.allowed) {
        return { received: false, error: check.reason };
      }
    }

    // Rate-limiting: prevent spamming submissions faster than 350ms (disabled in test mode)
    const now = Date.now();
    const lastSub = this.lastSubmissionTimes.get(playerId) || 0;
    const rateLimitMs = this.settings.isTestMode ? 0 : 350;
    if (rateLimitMs > 0 && now - lastSub < rateLimitMs) {
      return { received: false, error: 'Submission rate limit reached. Please wait a moment.' };
    }
    this.lastSubmissionTimes.set(playerId, now);

    player.totalSubmissions += 1;

    // Authoritative atomic answer evaluation
    const evalResult = this.questionManager.submitAnswer(
      instanceId,
      playerId,
      player.username,
      answer
    );

    if (!evalResult.correct) {
      this.callbacks.onAnswerResult(player.socketId, {
        correct: false,
        earnedPoint: false,
        message: evalResult.message,
        totalScore: player.totalScore,
        roundProgress: player.roundCorrectAnswers,
        requiredForRound: getRequiredAnswersForRound(player.currentRound),
      });

      return { received: true, correct: false, earnedPoint: false };
    }

    // Answer was correct!
    if (evalResult.awardedPoint) {
      // First player to answer correctly wins the point!
      if (this.sharedQuestionTimer) {
        clearTimeout(this.sharedQuestionTimer);
        this.sharedQuestionTimer = null;
      }
      for (const timer of this.botTimers.values()) clearTimeout(timer);
      this.botTimers.clear();

      player.correctSubmissions += 1;
      player.totalScore += 1;
      player.roundCorrectAnswers += 1;

      // Calculate latency
      if (player.currentQuestion) {
        const timeTaken = now - player.currentQuestion.assignedAt;
        if (timeTaken < player.fastestAnswerMs) {
          player.fastestAnswerMs = timeTaken;
        }
      }

      // Check Round Advancement
      const required = getRequiredAnswersForRound(player.currentRound);
      let roundAdvanced = false;

      if (player.roundCorrectAnswers >= required) {
        player.currentRound += 1;
        player.roundCorrectAnswers = 0; // Reset progress at beginning of each round
        player.highestRound = Math.max(player.highestRound, player.currentRound);
        roundAdvanced = true;

        this.callbacks.onPlayerAdvanced({
          playerId: player.id,
          username: player.username,
          newRound: player.currentRound,
          totalScore: player.totalScore,
        });

        // Check Match Winning Condition
        if (player.currentRound > this.settings.targetRound) {
          this.winnerPlayerId = player.id;
          this.winnerUsername = player.username;

          // Notify winner
          if (!player.isBot) {
            this.callbacks.onAnswerResult(player.socketId, {
              correct: true,
              earnedPoint: true,
              canonicalAnswer: evalResult.canonicalAnswer,
              message: 'Correct! You won the match!',
              roundAdvanced,
              newRound: player.currentRound,
              totalScore: player.totalScore,
              roundProgress: player.roundCorrectAnswers,
              requiredForRound: getRequiredAnswersForRound(player.currentRound),
              winnerName: player.username,
            });
          }

          // Notify all other players
          for (const other of this.players.values()) {
            if (other.id !== player.id && !other.isBot) {
              this.callbacks.onAnswerResult(other.socketId, {
                correct: false,
                earnedPoint: false,
                canonicalAnswer: evalResult.canonicalAnswer,
                message: `${player.username} answered correctly first and won the match!`,
                totalScore: other.totalScore,
                roundProgress: other.roundCorrectAnswers,
                requiredForRound: getRequiredAnswersForRound(other.currentRound),
                winnerName: player.username,
              });
            }
          }

          this.callbacks.onLeaderboardUpdated(this.getLeaderboard());
          this.completeMatch();
          return { received: true, correct: true, earnedPoint: true };
        }
      }

      // Notify winning player
      if (!player.isBot) {
        this.callbacks.onAnswerResult(player.socketId, {
          correct: true,
          earnedPoint: true,
          canonicalAnswer: evalResult.canonicalAnswer,
          message: 'Correct! +1 Point',
          roundAdvanced,
          newRound: player.currentRound,
          totalScore: player.totalScore,
          roundProgress: player.roundCorrectAnswers,
          requiredForRound: getRequiredAnswersForRound(player.currentRound),
          winnerName: player.username,
        });
      }

      // Notify all other players
      for (const other of this.players.values()) {
        if (other.id !== player.id && !other.isBot) {
          this.callbacks.onAnswerResult(other.socketId, {
            correct: false,
            earnedPoint: false,
            canonicalAnswer: evalResult.canonicalAnswer,
            message: `${player.username} answered correctly first! (+1 Point)`,
            totalScore: other.totalScore,
            roundProgress: other.roundCorrectAnswers,
            requiredForRound: getRequiredAnswersForRound(other.currentRound),
            winnerName: player.username,
          });
        }
      }

      this.callbacks.onLeaderboardUpdated(this.getLeaderboard());

      // Advance everyone to the next question
      if (this.settings.isTestMode) {
        this.assignSharedNextQuestion();
      } else {
        this.sharedNextTransitionTimer = setTimeout(() => {
          if (this.status === 'in_progress') {
            this.assignSharedNextQuestion();
          }
        }, 1000);
      }

      return { received: true, correct: true, earnedPoint: true };
    } else {
      // Correct, but point already awarded to someone else (or expired)
      this.callbacks.onAnswerResult(player.socketId, {
        correct: true,
        earnedPoint: false,
        canonicalAnswer: evalResult.canonicalAnswer,
        message: evalResult.message,
        totalScore: player.totalScore,
        roundProgress: player.roundCorrectAnswers,
        requiredForRound: getRequiredAnswersForRound(player.currentRound),
      });

      return { received: true, correct: true, earnedPoint: false };
    }
  }

  public registerFocusLoss(playerId: string, eventType: 'blur' | 'visibilitychange'): void {
    if (!this.settings.antiCheatEnabled || this.status !== 'in_progress') {
      return;
    }

    const player = this.players.get(playerId);
    if (!player || player.isBot || !player.currentQuestion) {
      return; // Only register during an active question
    }

    const violation = this.antiCheatEngine.registerFocusLoss(player.focusStatus, eventType);
    if (!violation) return; // Debounced

    // Point deduction penalty
    if (violation.deduction && violation.deduction > 0) {
      player.totalScore = Math.max(0, player.totalScore - violation.deduction);
      this.callbacks.onLeaderboardUpdated(this.getLeaderboard());
    }

    // Disqualification penalty
    if (violation.penalty === 'disqualified') {
      this.clearPlayerQuestionTimer(playerId);
      player.currentQuestion = null;
      this.callbacks.onLeaderboardUpdated(this.getLeaderboard());
      this.checkCompletion();
    }

    this.callbacks.onAntiCheatWarning(player.socketId, {
      violationsCount: violation.violationsCount,
      penalty: violation.penalty,
      message: violation.message,
      lockedUntil: violation.lockedUntil,
    });
  }

  private completeMatch(): void {
    if (this.status === 'completed') return;

    this.status = 'completed';
    this.endedAt = Date.now();

    // Clear all active timers
    for (const timer of this.questionTimers.values()) clearTimeout(timer);
    this.questionTimers.clear();
    for (const timer of this.botTimers.values()) clearTimeout(timer);
    this.botTimers.clear();

    const durationSeconds = this.startedAt ? Math.floor((this.endedAt - this.startedAt) / 1000) : 0;
    const totalQuestionsAnswered = Array.from(this.players.values()).reduce(
      (sum, p) => sum + p.correctSubmissions,
      0
    );

    this.callbacks.onMatchCompleted({
      winnerId: this.winnerPlayerId || '',
      winnerName: this.winnerUsername || 'Unknown',
      finalLeaderboard: this.getLeaderboard(),
      matchStats: {
        durationSeconds,
        totalQuestionsAnswered,
      },
    });
  }

  private checkCompletion(): void {
    // If all human players are disqualified, end match
    const activeHumans = Array.from(this.players.values()).filter(
      (p) => !p.isBot && !p.focusStatus.isDisqualified
    );

    if (activeHumans.length === 0 && this.status === 'in_progress') {
      this.completeMatch();
    }
  }

  public handleDisconnect(playerId: string): void {
    const player = this.players.get(playerId);
    if (player) {
      player.isConnected = false;
      player.disconnectedAt = Date.now();
      this.callbacks.onLeaderboardUpdated(this.getLeaderboard());
    }
  }

  public handleReconnect(playerId: string, newSocketId: string): PlayerState | null {
    const player = this.players.get(playerId);
    if (!player) return null;

    player.isConnected = true;
    player.socketId = newSocketId;
    player.disconnectedAt = null;

    this.callbacks.onLeaderboardUpdated(this.getLeaderboard());

    // If game in progress and player has question, re-send current question
    if (this.status === 'in_progress' && player.currentQuestion) {
      this.callbacks.onQuestionAssigned(player.socketId, {
        question: player.currentQuestion,
        round: player.currentRound,
        progress: player.roundCorrectAnswers,
        required: getRequiredAnswersForRound(player.currentRound),
      });
    }

    return player;
  }

  public resetForRematch(): void {
    if (this.status !== 'completed') return;

    this.status = 'waiting';
    this.startedAt = null;
    this.endedAt = null;
    this.winnerPlayerId = null;
    this.winnerUsername = null;

    for (const player of this.players.values()) {
      player.isReady = player.isHost || !!player.isBot;
      player.currentRound = 1;
      player.roundCorrectAnswers = 0;
      player.totalScore = 0;
      player.highestRound = 1;
      player.totalSubmissions = 0;
      player.correctSubmissions = 0;
      player.fastestAnswerMs = 999999;
      player.currentQuestion = null;
      player.focusStatus = this.antiCheatEngine.createInitialPlayerStatus();
    }

    this.callbacks.onLobbyUpdated(this.getSummary());
  }

  private scheduleBotAnswer(
    bot: PlayerState,
    instanceId: string,
    canonicalAnswer: string
  ): void {
    // Bot thinks for 4 to 9 seconds, with 75% accuracy
    const thinkTime = 4000 + Math.random() * 5000;
    const isCorrect = Math.random() < 0.75;

    const timer = setTimeout(() => {
      if (this.status !== 'in_progress') return;
      const answer = isCorrect ? canonicalAnswer : 'incorrect guess';
      this.submitAnswer(bot.id, instanceId, answer);
    }, thinkTime);

    this.botTimers.set(bot.id, timer);
  }

  private clearPlayerQuestionTimer(playerId: string): void {
    const t = this.questionTimers.get(playerId);
    if (t) {
      clearTimeout(t);
      this.questionTimers.delete(playerId);
    }
  }

  private clearBotTimer(playerId: string): void {
    const t = this.botTimers.get(playerId);
    if (t) {
      clearTimeout(t);
      this.botTimers.delete(playerId);
    }
  }

  public getLeaderboard(): LeaderboardEntry[] {
    const entries = Array.from(this.players.values()).map((p) => ({
      playerId: p.id,
      username: p.username,
      totalScore: p.totalScore,
      currentRound: p.currentRound,
      roundProgress: p.roundCorrectAnswers,
      requiredForRound: getRequiredAnswersForRound(p.currentRound),
      isDisqualified: p.focusStatus.isDisqualified,
      isConnected: p.isConnected,
      isWinner: p.id === this.winnerPlayerId,
      rank: 1,
    }));

    // Sort by highest round descending, then total score descending, then fastest answer
    entries.sort((a, b) => {
      if (a.isDisqualified && !b.isDisqualified) return 1;
      if (!a.isDisqualified && b.isDisqualified) return -1;
      if (b.currentRound !== a.currentRound) return b.currentRound - a.currentRound;
      if (b.roundProgress !== a.roundProgress) return b.roundProgress - a.roundProgress;
      return b.totalScore - a.totalScore;
    });

    entries.forEach((e, idx) => {
      e.rank = idx + 1;
    });

    return entries;
  }

  public getSummary(): MatchSummary {
    const playersObj: Record<string, PlayerState> = {};
    for (const [id, player] of this.players.entries()) {
      playersObj[id] = player;
    }

    return {
      matchId: this.matchId,
      roomCode: this.roomCode,
      isPrivate: this.isPrivate,
      status: this.status,
      winnerPlayerId: this.winnerPlayerId,
      winnerUsername: this.winnerUsername,
      settings: this.settings,
      startedAt: this.startedAt,
      endedAt: this.endedAt,
      players: playersObj,
    };
  }

  public cleanup(): void {
    if (this.sharedQuestionTimer) {
      clearTimeout(this.sharedQuestionTimer);
      this.sharedQuestionTimer = null;
    }
    if (this.sharedNextTransitionTimer) {
      clearTimeout(this.sharedNextTransitionTimer);
      this.sharedNextTransitionTimer = null;
    }
    for (const timer of this.questionTimers.values()) clearTimeout(timer);
    this.questionTimers.clear();
    for (const timer of this.botTimers.values()) clearTimeout(timer);
    this.botTimers.clear();
    this.questionManager.cleanMatch(this.matchId);
  }
}
