export type QuestionCategory =
  | 'General Knowledge'
  | 'Geography'
  | 'History'
  | 'Science'
  | 'Sports'
  | 'Mathematics'
  | 'Gaming'
  | 'Entertainment';

export type QuestionDifficulty = 'easy' | 'medium' | 'hard';

export interface QuestionBankItem {
  id: string;
  question_text: string;
  canonical_answer: string;
  accepted_answers: string[];
  category: QuestionCategory;
  difficulty: QuestionDifficulty;
  image_url?: string | null;
  image_alt_text?: string | null;
  created_at?: string;
  is_active: boolean;
}

export interface ClientQuestion {
  instanceId: string;
  questionId: string;
  questionText: string;
  category: QuestionCategory;
  difficulty: QuestionDifficulty;
  imageUrl?: string | null;
  imageAltText?: string | null;
  assignedAt: number;
  timeLimitSeconds: number;
  expiresAt: number;
}

export interface QuestionInstance {
  instanceId: string;
  questionId: string;
  questionText: string;
  canonicalAnswer: string;
  acceptedAnswers: string[];
  category: QuestionCategory;
  difficulty: QuestionDifficulty;
  imageUrl?: string | null;
  imageAltText?: string | null;
  assignedToPlayerId: string;
  status: 'active' | 'completed' | 'expired';
  firstCorrectPlayerId?: string | null;
  firstCorrectPlayerName?: string | null;
  firstCorrectSubmittedAt?: number | null;
  assignedAt: number;
  expiresAt: number;
}

export type FocusPenaltyTier = 'none' | 'warning' | 'lockout' | 'point_deduction' | 'disqualified';

export interface FocusViolationConfig {
  firstViolation: 'warning';
  secondViolation: 'lockout';
  secondViolationLockSeconds: number;
  thirdViolation: 'point_deduction';
  thirdViolationDeduction: number;
  fourthViolation: 'disqualified';
  debounceMs: number;
}

export interface PlayerFocusStatus {
  violationsCount: number;
  lastViolationTimestamp: number;
  isLockedOut: boolean;
  lockedUntil: number;
  isDisqualified: boolean;
  penaltyLog: Array<{
    timestamp: number;
    penalty: FocusPenaltyTier;
    reason: string;
  }>;
}

export interface PlayerState {
  id: string;
  socketId: string;
  username: string;
  avatarSeed: string;
  isReady: boolean;
  isHost: boolean;
  isConnected: boolean;
  disconnectedAt?: number | null;
  isBot?: boolean;

  // Progression
  currentRound: number;
  roundCorrectAnswers: number;
  totalScore: number;
  highestRound: number;
  totalSubmissions: number;
  correctSubmissions: number;
  fastestAnswerMs: number;

  // Active question
  currentQuestion?: ClientQuestion | null;

  // Anti-cheat
  focusStatus: PlayerFocusStatus;
}

export type MatchStatus = 'waiting' | 'in_progress' | 'completed' | 'abandoned';

export interface MatchSettings {
  targetRound: number;
  questionTimeLimitSeconds: number;
  minPlayersToStart: number;
  maxPlayers: number;
  antiCheatEnabled: boolean;
  isTestMode: boolean;
}

export interface MatchSummary {
  matchId: string;
  roomCode: string;
  isPrivate: boolean;
  status: MatchStatus;
  winnerPlayerId?: string | null;
  winnerUsername?: string | null;
  settings: MatchSettings;
  startedAt?: number | null;
  endedAt?: number | null;
  players: Record<string, PlayerState>;
}

export interface LeaderboardEntry {
  playerId: string;
  username: string;
  totalScore: number;
  currentRound: number;
  roundProgress: number;
  requiredForRound: number;
  isDisqualified: boolean;
  isConnected: boolean;
  isWinner: boolean;
  rank: number;
}

// Server to Client Events
export interface ServerToClientEvents {
  'lobby:updated': (data: { match: MatchSummary }) => void;
  'match:started': (data: { match: MatchSummary }) => void;
  'question:assigned': (data: { question: ClientQuestion; round: number; progress: number; required: number }) => void;
  'answer:result': (data: {
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
  }) => void;
  'player:advanced': (data: {
    playerId: string;
    username: string;
    newRound: number;
    totalScore: number;
  }) => void;
  'leaderboard:updated': (data: { leaderboard: LeaderboardEntry[] }) => void;
  'anticheat:warning': (data: {
    violationsCount: number;
    penalty: FocusPenaltyTier;
    message: string;
    lockedUntil?: number;
  }) => void;
  'match:completed': (data: {
    winnerId: string;
    winnerName: string;
    finalLeaderboard: LeaderboardEntry[];
    matchStats: {
      durationSeconds: number;
      totalQuestionsAnswered: number;
    };
  }) => void;
  'player:reconnected': (data: { match: MatchSummary; sessionToken: string }) => void;
  'error:message': (data: { code: string; message: string }) => void;
}

// Client to Server Events
export interface ClientToServerEvents {
  'lobby:create': (data: { username: string; isPrivate?: boolean; isTestMode?: boolean; targetRound?: number }, callback: (res: { success: boolean; roomCode?: string; matchId?: string; sessionToken?: string; playerId?: string; match?: MatchSummary; error?: string }) => void) => void;
  'lobby:join': (data: { username: string; roomCode?: string; quickPlay?: boolean }, callback: (res: { success: boolean; roomCode?: string; matchId?: string; sessionToken?: string; playerId?: string; match?: MatchSummary; error?: string }) => void) => void;
  'lobby:reconnect': (data: { sessionToken: string }, callback: (res: { success: boolean; match?: MatchSummary; error?: string }) => void) => void;
  'lobby:ready': (data: { isReady: boolean }) => void;
  'lobby:start': () => void;
  'lobby:add_bot': () => void;
  'lobby:leave': () => void;
  'question:submit_answer': (data: { instanceId: string; answer: string }, callback: (res: { received: boolean; correct?: boolean; earnedPoint?: boolean; error?: string }) => void) => void;
  'anticheat:focus_lost': (data: { eventType: 'blur' | 'visibilitychange'; timestamp: number }) => void;
  'anticheat:focus_regained': (data: { timestamp: number }) => void;
  'match:rematch': () => void;
}
