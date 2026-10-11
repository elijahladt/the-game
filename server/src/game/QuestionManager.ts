import { randomUUID } from 'crypto';
import {
  QuestionBankItem,
  QuestionInstance,
  ClientQuestion,
  QuestionDifficulty,
  getNextDifficultyForRound,
  isAnswerCorrect,
} from '@quickfire/shared';

export class QuestionManager {
  private questions: QuestionBankItem[] = [];
  // matchId -> Set of used questionIds
  private matchUsedQuestions: Map<string, Set<string>> = new Map();
  // instanceId -> QuestionInstance
  private activeInstances: Map<string, QuestionInstance> = new Map();

  constructor(initialQuestions: QuestionBankItem[] = []) {
    this.questions = [...initialQuestions];
  }

  public setQuestions(questions: QuestionBankItem[]): void {
    this.questions = [...questions];
  }

  public getQuestionsCount(): number {
    return this.questions.length;
  }

  /**
   * Select a question for a player based on their current round difficulty,
   * avoiding recent repetition within the match.
   */
  public createQuestionInstance(
    matchId: string,
    playerId: string,
    round: number,
    timeLimitSeconds: number = 30
  ): { instance: QuestionInstance; clientQuestion: ClientQuestion } {
    const targetDifficulty: QuestionDifficulty = getNextDifficultyForRound(round);

    if (!this.matchUsedQuestions.has(matchId)) {
      this.matchUsedQuestions.set(matchId, new Set());
    }
    const usedSet = this.matchUsedQuestions.get(matchId)!;

    // Filter by difficulty and active
    let candidates = this.questions.filter(
      (q) => q.is_active && q.difficulty === targetDifficulty && !usedSet.has(q.id)
    );

    // If no unused questions for this difficulty, try any difficulty that hasn't been used yet
    if (candidates.length === 0) {
      candidates = this.questions.filter((q) => q.is_active && !usedSet.has(q.id));
    }

    // If STILL no unused questions in the entire pool, safely recycle used questions
    if (candidates.length === 0) {
      usedSet.clear();
      candidates = this.questions.filter((q) => q.is_active && q.difficulty === targetDifficulty);
      if (candidates.length === 0) {
        candidates = this.questions.filter((q) => q.is_active);
      }
    }

    // If still empty (e.g. no questions loaded at all), provide a fallback
    const selectedQuestion: QuestionBankItem =
      candidates.length > 0
        ? candidates[Math.floor(Math.random() * candidates.length)]
        : {
            id: 'fallback-' + Date.now(),
            question_text: 'What is 1 + 1?',
            canonical_answer: '2',
            accepted_answers: ['two'],
            category: 'Mathematics',
            difficulty: 'easy',
            is_active: true,
          };

    usedSet.add(selectedQuestion.id);

    const instanceId = randomUUID();
    const now = Date.now();
    const expiresAt = now + timeLimitSeconds * 1000;

    const instance: QuestionInstance = {
      instanceId,
      questionId: selectedQuestion.id,
      questionText: selectedQuestion.question_text,
      canonicalAnswer: selectedQuestion.canonical_answer,
      acceptedAnswers: selectedQuestion.accepted_answers,
      category: selectedQuestion.category,
      difficulty: selectedQuestion.difficulty,
      imageUrl: selectedQuestion.image_url ?? null,
      imageAltText: selectedQuestion.image_alt_text ?? null,
      assignedToPlayerId: playerId,
      status: 'active',
      firstCorrectPlayerId: null,
      firstCorrectPlayerName: null,
      firstCorrectSubmittedAt: null,
      assignedAt: now,
      expiresAt,
    };

    this.activeInstances.set(instanceId, instance);

    const clientQuestion: ClientQuestion = {
      instanceId,
      questionId: selectedQuestion.id,
      questionText: selectedQuestion.question_text,
      category: selectedQuestion.category,
      difficulty: selectedQuestion.difficulty,
      imageUrl: selectedQuestion.image_url ?? null,
      imageAltText: selectedQuestion.image_alt_text ?? null,
      assignedAt: now,
      timeLimitSeconds,
      expiresAt,
    };

    return { instance, clientQuestion };
  }

  public getInstance(instanceId: string): QuestionInstance | undefined {
    return this.activeInstances.get(instanceId);
  }

  /**
   * ATOMIC ANSWER EVALUATION & FIRST-CORRECT-ANSWER SCORING
   *
   * Only the FIRST eligible correct submission for this question instance
   * earns the point. Subsequent submissions receive awarded = false.
   */
  public submitAnswer(
    instanceId: string,
    playerId: string,
    playerName: string,
    submittedAnswer: string
  ): {
    success: boolean;
    correct: boolean;
    awardedPoint: boolean;
    canonicalAnswer?: string;
    message: string;
  } {
    const instance = this.activeInstances.get(instanceId);

    if (!instance) {
      return {
        success: false,
        correct: false,
        awardedPoint: false,
        message: 'Question instance not found or expired',
      };
    }

    // Check expiration
    if (Date.now() > instance.expiresAt && instance.status === 'active') {
      instance.status = 'expired';
      return {
        success: false,
        correct: false,
        awardedPoint: false,
        message: 'Question time has expired',
      };
    }

    // Check if question was already won by someone else
    if (instance.status === 'completed') {
      return {
        success: true,
        correct: false,
        awardedPoint: false,
        message: `Question already won by ${instance.firstCorrectPlayerName ?? 'another player'}`,
      };
    }

    // Evaluate answer correctness
    const correct = isAnswerCorrect(
      submittedAnswer,
      instance.canonicalAnswer,
      instance.acceptedAnswers
    );

    if (!correct) {
      return {
        success: true,
        correct: false,
        awardedPoint: false,
        message: 'Incorrect answer. Try again!',
      };
    }

    // ATOMIC FIRST-CORRECT AWARD
    // In JavaScript single-threaded event loop, this synchronous check-and-set
    // guarantees atomic point distribution without race conditions.
    if (instance.status === 'active') {
      instance.status = 'completed';
      instance.firstCorrectPlayerId = playerId;
      instance.firstCorrectPlayerName = playerName;
      instance.firstCorrectSubmittedAt = Date.now();

      return {
        success: true,
        correct: true,
        awardedPoint: true,
        canonicalAnswer: instance.canonicalAnswer,
        message: 'Correct! You won the point!',
      };
    }

    // In case of any concurrent status update
    return {
      success: true,
      correct: true,
      awardedPoint: false,
      canonicalAnswer: instance.canonicalAnswer,
      message: 'Correct, but another player answered first!',
    };
  }

  public expireInstance(instanceId: string): void {
    const instance = this.activeInstances.get(instanceId);
    if (instance && instance.status === 'active') {
      instance.status = 'expired';
    }
  }

  public cleanMatch(matchId: string): void {
    this.matchUsedQuestions.delete(matchId);
  }
}
