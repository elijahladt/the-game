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
  private players: Record<string, PlayerState>;
  private userId: string;
  private roomCode: string;
  private currentQuestionItem: QuestionBankItem | null = null;
  private events: LocalGameEvents;
  private isCompleted: boolean = false;
  private startedAt: number = 0;
  private botTimers: any[] = [];
  private questionTimer: any = null;
  private usedQuestions: Set<string> = new Set();

  constructor(
    players: Record<string, PlayerState>,
    userId: string,
    targetRound: number = 3,
    roomCode: string = 'SOLO',
    events: LocalGameEvents
  ) {
    this.players = { ...players };
    this.userId = userId;
    this.targetRound = targetRound;
    this.roomCode = roomCode;
    this.events = events;
  }

  public start(): MatchSummary {
    this.startedAt = Date.now();
    this.assignNextQuestion();
    this.emitLeaderboard();
    return this.getSummary();
  }

  private getUserPlayer(): PlayerState {
    return this.players[this.userId];
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
    this.clearBotTimers();

    const user = this.getUserPlayer();
    if (!user) return;

    const qItem = this.pickQuestion(user.currentRound);
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

    user.currentQuestion = clientQ;

    this.events.onQuestionAssigned({
      question: clientQ,
      round: user.currentRound,
      progress: user.roundCorrectAnswers,
      required: getRequiredAnswersForRound(user.currentRound),
    });

    // Timeout
    this.questionTimer = setTimeout(() => {
      if (this.isCompleted) return;
      this.events.onAnswerResult({
        correct: false,
        earnedPoint: false,
        message: 'Time is up! Moving to next question...',
        totalScore: user.totalScore,
        roundProgress: user.roundCorrectAnswers,
        requiredForRound: getRequiredAnswersForRound(user.currentRound),
      });
      this.assignNextQuestion();
    }, this.timeLimitSeconds * 1000);

    // Schedule bots
    this.scheduleBots();
  }

  private clearBotTimers(): void {
    this.botTimers.forEach((t) => clearTimeout(t));
    this.botTimers = [];
  }

  private scheduleBots(): void {
    for (const player of Object.values(this.players)) {
      if (!player.isBot) continue;

      const thinkTime = 5000 + Math.random() * 6000;
      const timer = setTimeout(() => {
        if (this.isCompleted) return;
        // Bot has 60% accuracy
        if (Math.random() < 0.6) {
          player.roundCorrectAnswers += 1;
          player.totalScore += 1;
          const required = getRequiredAnswersForRound(player.currentRound);
          if (player.roundCorrectAnswers >= required) {
            player.currentRound += 1;
            player.roundCorrectAnswers = 0;
            if (player.currentRound > this.targetRound) {
              this.finishMatch(player.id, player.username);
              return;
            }
          }
          this.emitLeaderboard();
        }
      }, thinkTime);

      this.botTimers.push(timer);
    }
  }

  public submitAnswer(answer: string): { correct: boolean; earnedPoint: boolean; message: string } {
    if (this.isCompleted || !this.currentQuestionItem) {
      return { correct: false, earnedPoint: false, message: 'Question inactive' };
    }

    const user = this.getUserPlayer();
    if (!user) {
      return { correct: false, earnedPoint: false, message: 'Player error' };
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
        totalScore: user.totalScore,
        roundProgress: user.roundCorrectAnswers,
        requiredForRound: getRequiredAnswersForRound(user.currentRound),
      });
      return { correct: false, earnedPoint: false, message: 'Incorrect answer. Try again!' };
    }

    // Correct!
    user.correctSubmissions += 1;
    user.totalScore += 1;
    user.roundCorrectAnswers += 1;

    const required = getRequiredAnswersForRound(user.currentRound);
    let roundAdvanced = false;

    if (user.roundCorrectAnswers >= required) {
      user.currentRound += 1;
      user.roundCorrectAnswers = 0;
      roundAdvanced = true;

      if (user.currentRound > this.targetRound) {
        this.finishMatch(user.id, user.username);
        return { correct: true, earnedPoint: true, message: 'Victory! You won the match!' };
      }
    }

    this.events.onAnswerResult({
      correct: true,
      earnedPoint: true,
      canonicalAnswer: this.currentQuestionItem.canonical_answer,
      message: 'Correct! +1 Point',
      roundAdvanced,
      newRound: user.currentRound,
      totalScore: user.totalScore,
      roundProgress: user.roundCorrectAnswers,
      requiredForRound: getRequiredAnswersForRound(user.currentRound),
    });

    this.emitLeaderboard();
    this.assignNextQuestion();

    return { correct: true, earnedPoint: true, message: 'Correct!' };
  }

  private finishMatch(winnerId: string, winnerName: string): void {
    if (this.isCompleted) return;
    this.isCompleted = true;
    clearTimeout(this.questionTimer);
    this.clearBotTimers();

    const durationSeconds = Math.floor((Date.now() - this.startedAt) / 1000);
    const totalAnswered = Object.values(this.players).reduce((acc, p) => acc + p.correctSubmissions, 0);

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
    const list = Object.values(this.players).map((p) => ({
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
      matchId: `local-${this.startedAt}`,
      roomCode: this.roomCode,
      isPrivate: true,
      status: this.isCompleted ? 'completed' : 'in_progress',
      winnerPlayerId: null,
      winnerUsername: null,
      settings: {
        targetRound: this.targetRound,
        questionTimeLimitSeconds: this.timeLimitSeconds,
        minPlayersToStart: 1,
        maxPlayers: 12,
        antiCheatEnabled: false,
        isTestMode: true,
      },
      startedAt: this.startedAt,
      endedAt: null,
      players: this.players,
    };
  }

  public cleanup(): void {
    this.isCompleted = true;
    clearTimeout(this.questionTimer);
    this.clearBotTimers();
  }
}
