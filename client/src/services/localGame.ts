import type {
  MatchSummary,
  ClientQuestion,
  LeaderboardEntry,
  PlayerState,
  QuestionBankItem,
  QuestionDifficulty,
} from '@quickfire/shared';
import {
  INITIAL_QUESTIONS,
  getNextDifficultyForRound,
  getRequiredAnswersForRound,
  isAnswerCorrect,
} from '@quickfire/shared';

export interface LocalGameEvents {
  onQuestionAssigned: (data: { question: ClientQuestion; round: number; progress: number; required: number }) => void;
  onAnswerResult: (data: {
    correct: boolean;
    earnedPoint: boolean;
    canonicalAnswer?: string;
    message: string;
    roundAdvanced?: boolean;
    newRound?: number;
    totalScore: number;
    roundProgress: number;
    requiredForRound: number;
  }) => void;
  onLeaderboardUpdated: (leaderboard: LeaderboardEntry[]) => void;
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

export class LocalGameEngine {
  private targetRound: number = 3;
  private timeLimitSeconds: number = 30;
  private userPlayer: PlayerState;
  private botPlayer: PlayerState;
  private currentQuestionItem: QuestionBankItem | null = null;
  private events: LocalGameEvents;
  private isCompleted: boolean = false;
  private startedAt: number = 0;
  private botTimer: any = null;
  private questionTimer: any = null;
  private usedQuestions: Set<string> = new Set();

  constructor(username: string, targetRound: number = 3, events: LocalGameEvents) {
    this.targetRound = targetRound;
    this.events = events;

    this.userPlayer = {
      id: 'local-user',
      socketId: 'local-socket',
      username,
      avatarSeed: username.toLowerCase(),
      isReady: true,
      isHost: true,
      isConnected: true,
      currentRound: 1,
      roundCorrectAnswers: 0,
      totalScore: 0,
      highestRound: 1,
      totalSubmissions: 0,
      correctSubmissions: 0,
      fastestAnswerMs: 999999,
      focusStatus: {
        violationsCount: 0,
        lastViolationTimestamp: 0,
        isLockedOut: false,
        lockedUntil: 0,
        isDisqualified: false,
        penaltyLog: [],
      },
    };

    this.botPlayer = {
      id: 'local-bot',
      socketId: 'bot-socket',
      username: 'PixelPro [AI]',
      avatarSeed: 'pixelpro',
      isReady: true,
      isHost: false,
      isConnected: true,
      isBot: true,
      currentRound: 1,
      roundCorrectAnswers: 0,
      totalScore: 0,
      highestRound: 1,
      totalSubmissions: 0,
      correctSubmissions: 0,
      fastestAnswerMs: 999999,
      focusStatus: {
        violationsCount: 0,
        lastViolationTimestamp: 0,
        isLockedOut: false,
        lockedUntil: 0,
        isDisqualified: false,
        penaltyLog: [],
      },
    };
  }

  public start(): MatchSummary {
    this.startedAt = Date.now();
    this.assignNextQuestion();
    this.emitLeaderboard();
    return this.getSummary();
  }

  private pickQuestion(round: number): QuestionBankItem {
    const diff: QuestionDifficulty = getNextDifficultyForRound(round);
    let candidates = INITIAL_QUESTIONS.filter((q) => q.difficulty === diff && !this.usedQuestions.has(q.id));
    if (candidates.length === 0) {
      candidates = INITIAL_QUESTIONS.filter((q) => !this.usedQuestions.has(q.id));
    }
    if (candidates.length === 0) {
      this.usedQuestions.clear();
      candidates = INITIAL_QUESTIONS;
    }
    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    this.usedQuestions.add(chosen.id);
    return chosen;
  }

  private assignNextQuestion(): void {
    if (this.isCompleted) return;
    clearTimeout(this.questionTimer);
    clearTimeout(this.botTimer);

    const qItem = this.pickQuestion(this.userPlayer.currentRound);
    this.currentQuestionItem = qItem;

    const now = Date.now();
    const expiresAt = now + this.timeLimitSeconds * 1000;

    const clientQ: ClientQuestion = {
      instanceId: `local-inst-${Date.now()}`,
      questionId: qItem.id,
      questionText: qItem.question_text,
      category: qItem.category,
      difficulty: qItem.difficulty,
      imageUrl: qItem.image_url ?? null,
      imageAltText: qItem.image_alt_text ?? null,
      assignedAt: now,
      timeLimitSeconds: this.timeLimitSeconds,
      expiresAt,
    };

    this.userPlayer.currentQuestion = clientQ;

    this.events.onQuestionAssigned({
      question: clientQ,
      round: this.userPlayer.currentRound,
      progress: this.userPlayer.roundCorrectAnswers,
      required: getRequiredAnswersForRound(this.userPlayer.currentRound),
    });

    // Timeout
    this.questionTimer = setTimeout(() => {
      if (this.isCompleted) return;
      this.events.onAnswerResult({
        correct: false,
        earnedPoint: false,
        message: 'Time is up! Moving to next question...',
        totalScore: this.userPlayer.totalScore,
        roundProgress: this.userPlayer.roundCorrectAnswers,
        requiredForRound: getRequiredAnswersForRound(this.userPlayer.currentRound),
      });
      this.assignNextQuestion();
    }, this.timeLimitSeconds * 1000);

    // Bot autonomous simulation
    this.scheduleBot();
  }

  private scheduleBot(): void {
    const thinkTime = 5000 + Math.random() * 6000;
    this.botTimer = setTimeout(() => {
      if (this.isCompleted) return;
      // Bot has a 65% chance of getting a correct answer
      if (Math.random() < 0.65) {
        this.botPlayer.roundCorrectAnswers += 1;
        this.botPlayer.totalScore += 1;
        const required = getRequiredAnswersForRound(this.botPlayer.currentRound);
        if (this.botPlayer.roundCorrectAnswers >= required) {
          this.botPlayer.currentRound += 1;
          this.botPlayer.roundCorrectAnswers = 0;
          if (this.botPlayer.currentRound > this.targetRound) {
            this.finishMatch(this.botPlayer.id, this.botPlayer.username);
            return;
          }
        }
        this.emitLeaderboard();
      }
    }, thinkTime);
  }

  public submitAnswer(answer: string): { correct: boolean; earnedPoint: boolean; message: string } {
    if (this.isCompleted || !this.currentQuestionItem) {
      return { correct: false, earnedPoint: false, message: 'Question inactive' };
    }

    const correct = isAnswerCorrect(
      answer,
      this.currentQuestionItem.canonical_answer,
      this.currentQuestionItem.accepted_answers
    );

    if (!correct) {
      this.events.onAnswerResult({
        correct: false,
        earnedPoint: false,
        message: 'Incorrect answer. Try again!',
        totalScore: this.userPlayer.totalScore,
        roundProgress: this.userPlayer.roundCorrectAnswers,
        requiredForRound: getRequiredAnswersForRound(this.userPlayer.currentRound),
      });
      return { correct: false, earnedPoint: false, message: 'Incorrect answer. Try again!' };
    }

    // Correct!
    this.userPlayer.correctSubmissions += 1;
    this.userPlayer.totalScore += 1;
    this.userPlayer.roundCorrectAnswers += 1;

    const required = getRequiredAnswersForRound(this.userPlayer.currentRound);
    let roundAdvanced = false;

    if (this.userPlayer.roundCorrectAnswers >= required) {
      this.userPlayer.currentRound += 1;
      this.userPlayer.roundCorrectAnswers = 0;
      roundAdvanced = true;

      if (this.userPlayer.currentRound > this.targetRound) {
        this.finishMatch(this.userPlayer.id, this.userPlayer.username);
        return { correct: true, earnedPoint: true, message: 'Victory! You won the match!' };
      }
    }

    this.events.onAnswerResult({
      correct: true,
      earnedPoint: true,
      canonicalAnswer: this.currentQuestionItem.canonical_answer,
      message: 'Correct! +1 Point',
      roundAdvanced,
      newRound: this.userPlayer.currentRound,
      totalScore: this.userPlayer.totalScore,
      roundProgress: this.userPlayer.roundCorrectAnswers,
      requiredForRound: getRequiredAnswersForRound(this.userPlayer.currentRound),
    });

    this.emitLeaderboard();
    this.assignNextQuestion();

    return { correct: true, earnedPoint: true, message: 'Correct!' };
  }

  private finishMatch(winnerId: string, winnerName: string): void {
    if (this.isCompleted) return;
    this.isCompleted = true;
    clearTimeout(this.questionTimer);
    clearTimeout(this.botTimer);

    const durationSeconds = Math.floor((Date.now() - this.startedAt) / 1000);
    const totalAnswered = this.userPlayer.correctSubmissions + this.botPlayer.correctSubmissions;

    this.events.onMatchCompleted({
      winnerId,
      winnerName,
      finalLeaderboard: this.getLeaderboard(winnerId),
      matchStats: {
        durationSeconds,
        totalQuestionsAnswered: totalAnswered,
      },
    });
  }

  public getLeaderboard(winnerId?: string): LeaderboardEntry[] {
    const list = [this.userPlayer, this.botPlayer].map((p) => ({
      playerId: p.id,
      username: p.username,
      totalScore: p.totalScore,
      currentRound: p.currentRound,
      roundProgress: p.roundCorrectAnswers,
      requiredForRound: getRequiredAnswersForRound(p.currentRound),
      isDisqualified: false,
      isConnected: true,
      isWinner: p.id === winnerId,
      rank: 1,
    }));

    list.sort((a, b) => {
      if (b.currentRound !== a.currentRound) return b.currentRound - a.currentRound;
      if (b.roundProgress !== a.roundProgress) return b.roundProgress - a.roundProgress;
      return b.totalScore - a.totalScore;
    });

    list.forEach((e, i) => (e.rank = i + 1));
    return list;
  }

  private emitLeaderboard(): void {
    this.events.onLeaderboardUpdated(this.getLeaderboard());
  }

  public getSummary(): MatchSummary {
    return {
      matchId: 'local-match',
      roomCode: 'SOLO',
      isPrivate: true,
      status: this.isCompleted ? 'completed' : 'in_progress',
      winnerPlayerId: null,
      winnerUsername: null,
      settings: {
        targetRound: this.targetRound,
        questionTimeLimitSeconds: this.timeLimitSeconds,
        minPlayersToStart: 1,
        maxPlayers: 2,
        antiCheatEnabled: false,
        isTestMode: true,
      },
      startedAt: this.startedAt,
      endedAt: null,
      players: {
        [this.userPlayer.id]: this.userPlayer,
        [this.botPlayer.id]: this.botPlayer,
      },
    };
  }

  public cleanup(): void {
    this.isCompleted = true;
    clearTimeout(this.questionTimer);
    clearTimeout(this.botTimer);
  }
}
