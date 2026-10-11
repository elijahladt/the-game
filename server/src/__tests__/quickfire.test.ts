import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  isAnswerCorrect,
  normalizeAnswer,
  getRequiredAnswersForRound,
  QuestionBankItem,
} from '@quickfire/shared';
import { QuestionManager } from '../game/QuestionManager.js';
import { AntiCheatEngine } from '../game/AntiCheatEngine.js';
import { Match } from '../game/Match.js';
import { MatchManager } from '../game/MatchManager.js';

const mockQuestions: QuestionBankItem[] = [
  {
    id: 'q1',
    question_text: 'What is the capital of France?',
    canonical_answer: 'Paris',
    accepted_answers: ['the city of paris'],
    category: 'Geography',
    difficulty: 'easy',
    is_active: true,
  },
  {
    id: 'q2',
    question_text: 'What is 5 plus 5?',
    canonical_answer: '10',
    accepted_answers: ['ten'],
    category: 'Mathematics',
    difficulty: 'easy',
    is_active: true,
  },
  {
    id: 'q3',
    question_text: 'Who painted the Mona Lisa?',
    canonical_answer: 'Leonardo da Vinci',
    accepted_answers: ['da vinci', 'leonardo'],
    category: 'General Knowledge',
    difficulty: 'medium',
    is_active: true,
  },
  {
    id: 'q4',
    question_text: 'What is the speed of sound in dry air at 20°C in m/s?',
    canonical_answer: '343',
    accepted_answers: ['343 m/s'],
    category: 'Science',
    difficulty: 'hard',
    is_active: true,
  },
];

describe('QUICKFIRE Automated Verification Suite', () => {
  let qm: QuestionManager;
  let matchCallbacks: any;

  beforeEach(() => {
    qm = new QuestionManager(mockQuestions);
    matchCallbacks = {
      onLobbyUpdated: vi.fn(),
      onMatchStarted: vi.fn(),
      onQuestionAssigned: vi.fn(),
      onAnswerResult: vi.fn(),
      onPlayerAdvanced: vi.fn(),
      onLeaderboardUpdated: vi.fn(),
      onAntiCheatWarning: vi.fn(),
      onMatchCompleted: vi.fn(),
    };
  });

  // 1. Two players submitting the correct answer nearly simultaneously
  it('Requirement 1: Two players submitting the correct answer nearly simultaneously - server receipt order determines winner', () => {
    const { instance } = qm.createQuestionInstance('match-1', 'p1', 1);

    const res1 = qm.submitAnswer(instance.instanceId, 'p1', 'Alice', instance.canonicalAnswer);
    const res2 = qm.submitAnswer(instance.instanceId, 'p2', 'Bob', instance.canonicalAnswer);

    expect(res1.correct).toBe(true);
    expect(res1.awardedPoint).toBe(true);
    expect(instance.firstCorrectPlayerId).toBe('p1');
    expect(instance.firstCorrectPlayerName).toBe('Alice');
  });

  // 2. Only one point being awarded for a shared question instance
  it('Requirement 2: Only one point is awarded for a shared question instance', () => {
    const { instance } = qm.createQuestionInstance('match-1', 'p1', 1);

    const res1 = qm.submitAnswer(instance.instanceId, 'p1', 'Alice', instance.canonicalAnswer);
    const res2 = qm.submitAnswer(instance.instanceId, 'p2', 'Bob', instance.canonicalAnswer);

    expect(res1.awardedPoint).toBe(true);
    expect(res2.awardedPoint).toBe(false);
    expect(res2.message).toContain('already won');
  });

  // 3. Incorrect answers awarding no points
  it('Requirement 3: Incorrect answers award no points and allow retry', () => {
    const { instance } = qm.createQuestionInstance('match-1', 'p1', 1);

    const res = qm.submitAnswer(instance.instanceId, 'p1', 'Alice', 'CompletelyIncorrectAnswerXYZ');
    expect(res.correct).toBe(false);
    expect(res.awardedPoint).toBe(false);

    // Question instance must still be active for a retry
    expect(instance.status).toBe('active');

    // Subsequent correct answer succeeds
    const retry = qm.submitAnswer(instance.instanceId, 'p1', 'Alice', instance.canonicalAnswer);
    expect(retry.correct).toBe(true);
    expect(retry.awardedPoint).toBe(true);
  });

  // 4. Alternative accepted answers
  it('Requirement 4: Alternative accepted answers and punctuation normalization', () => {
    expect(isAnswerCorrect('ten', '10', ['ten'])).toBe(true);
    expect(isAnswerCorrect('   10.  ', '10', ['ten'])).toBe(true);
    expect(isAnswerCorrect('da vinci', 'Leonardo da Vinci', ['da vinci', 'leonardo'])).toBe(true);
    expect(isAnswerCorrect('Leonardo', 'Leonardo da Vinci', ['da vinci', 'leonardo'])).toBe(true);
    expect(isAnswerCorrect('Wrong Answer', 'Leonardo da Vinci', ['da vinci'])).toBe(false);
  });

  // 5. Round 1 requiring 3 correct answers
  it('Requirement 5: Round 1 requires 3 correct answers', () => {
    expect(getRequiredAnswersForRound(1)).toBe(3);
  });

  // 6. Round 2 requiring 4 correct answers
  it('Requirement 6: Round 2 requires 4 correct answers', () => {
    expect(getRequiredAnswersForRound(2)).toBe(4);
  });

  // 7. Round requirements increasing by one each round
  it('Requirement 7: Round requirements increase by one each round: 2 + round', () => {
    for (let r = 1; r <= 10; r++) {
      expect(getRequiredAnswersForRound(r)).toBe(2 + r);
    }
  });

  // 8. One player advancing without changing another player's state
  it('Requirement 8: Independent progression - Player A advances without blocking or changing Player B', () => {
    const match = new Match(
      'match-indep',
      'INDEP1',
      'pA',
      'PlayerA',
      'sock-A',
      true,
      { isTestMode: true, targetRound: 5 },
      qm,
      matchCallbacks
    );

    match.addPlayer('pB', 'PlayerB', 'sock-B');
    match.startMatch();

    const summaryBefore = match.getSummary();
    const pA = summaryBefore.players['pA'];
    const pB = summaryBefore.players['pB'];

    expect(pA.currentRound).toBe(1);
    expect(pB.currentRound).toBe(1);

    // Answer 3 questions for Player A to finish Round 1 (requires 3 answers)
    for (let i = 0; i < 3; i++) {
      const qInstanceId = match.getSummary().players['pA'].currentQuestion!.instanceId;
      const qInstance = qm.getInstance(qInstanceId)!;
      match.submitAnswer('pA', qInstanceId, qInstance.canonicalAnswer);
    }

    const summaryAfter = match.getSummary();
    // Player A should now be in Round 2 with progress reset to 0
    expect(summaryAfter.players['pA'].currentRound).toBe(2);
    expect(summaryAfter.players['pA'].roundCorrectAnswers).toBe(0);
    expect(summaryAfter.players['pA'].totalScore).toBe(3);

    // Player B should STILL be in Round 1 with 0 score, unaffected!
    expect(summaryAfter.players['pB'].currentRound).toBe(1);
    expect(summaryAfter.players['pB'].roundCorrectAnswers).toBe(0);
    expect(summaryAfter.players['pB'].totalScore).toBe(0);
  });

  // 9. Questions being assigned according to each player's current round
  it('Requirement 9: Questions assigned according to current round difficulty', () => {
    // Round 1-2: easy, Round 3-5: medium, Round 6+: hard
    const { instance: qRound1 } = qm.createQuestionInstance('match-1', 'p1', 1);
    expect(qRound1.difficulty).toBe('easy');

    const { instance: qRound4 } = qm.createQuestionInstance('match-1', 'p1', 4);
    expect(qRound4.difficulty).toBe('medium');

    const { instance: qRound7 } = qm.createQuestionInstance('match-1', 'p1', 7);
    expect(qRound7.difficulty).toBe('hard');
  });

  // 10. Duplicate submissions not awarding duplicate points
  it('Requirement 10: Duplicate submissions do not award duplicate points', () => {
    const { instance } = qm.createQuestionInstance('match-1', 'p1', 1);

    const first = qm.submitAnswer(instance.instanceId, 'p1', 'Alice', instance.canonicalAnswer);
    expect(first.awardedPoint).toBe(true);

    const second = qm.submitAnswer(instance.instanceId, 'p1', 'Alice', instance.canonicalAnswer);
    expect(second.awardedPoint).toBe(false);
  });

  // 11. Question timeout handling
  it('Requirement 11: Question timeout handling marks instance expired', () => {
    const { instance } = qm.createQuestionInstance('match-1', 'p1', 1, 0); // 0s limit = immediately expired
    instance.expiresAt = Date.now() - 1000;

    const res = qm.submitAnswer(instance.instanceId, 'p1', 'Alice', instance.canonicalAnswer);
    expect(res.awardedPoint).toBe(false);
    expect(res.message).toContain('expired');
  });

  // 12. Reconnection restoring the correct state
  it('Requirement 12: Reconnection restores the player session and state', () => {
    const mm = new MatchManager(
      qm,
      () => {},
      () => {}
    );

    const { match, sessionToken, playerId } = mm.createMatch('Alice', 'sock-original', true, true);
    match.startMatch();

    // Alice answers 1 question
    const qInstanceId = match.getSummary().players[playerId].currentQuestion!.instanceId;
    const qInstance = qm.getInstance(qInstanceId)!;
    match.submitAnswer(playerId, qInstanceId, qInstance.canonicalAnswer);

    // Alice disconnects
    mm.handleSocketDisconnect('sock-original');
    expect(match.getSummary().players[playerId].isConnected).toBe(false);

    // Alice reconnects with new socket
    const rec = mm.reconnect(sessionToken, 'sock-reconnected');
    expect(rec.success).toBe(true);
    expect(rec.player?.isConnected).toBe(true);
    expect(rec.player?.totalScore).toBe(1);
    expect(rec.player?.socketId).toBe('sock-reconnected');
  });

  // 13. Duplicate focus events not causing duplicate penalties
  it('Requirement 13: Duplicate blur/visibilitychange events within debounce grace period are deduplicated', () => {
    const engine = new AntiCheatEngine({ debounceMs: 1500 });
    const status = engine.createInitialPlayerStatus();

    const t0 = 10000;
    // First focus loss
    const v1 = engine.registerFocusLoss(status, 'blur', t0);
    expect(v1).not.toBeNull();
    expect(v1?.violationsCount).toBe(1);
    expect(v1?.penalty).toBe('warning');

    // Immediate visibilitychange 50ms later (same tab switch event)
    const v2 = engine.registerFocusLoss(status, 'visibilitychange', t0 + 50);
    expect(v2).toBeNull(); // Deduplicated!
    expect(status.violationsCount).toBe(1);
  });

  // 14. Focus-loss penalties being enforced server-side
  it('Requirement 14: Graduated server-side anti-cheat penalties: warning -> lockout -> point deduction -> disqualification', () => {
    const engine = new AntiCheatEngine({ debounceMs: 100 });
    const status = engine.createInitialPlayerStatus();

    let t = 10000;
    // Violation 1: Warning
    const v1 = engine.registerFocusLoss(status, 'blur', t);
    expect(v1?.penalty).toBe('warning');
    expect(engine.canSubmitAnswer(status, t).allowed).toBe(true);

    // Violation 2: Lockout (5s)
    t += 200;
    const v2 = engine.registerFocusLoss(status, 'blur', t);
    expect(v2?.penalty).toBe('lockout');
    expect(engine.canSubmitAnswer(status, t).allowed).toBe(false);
    expect(engine.canSubmitAnswer(status, t + 6000).allowed).toBe(true); // after lock expires

    // Violation 3: Point deduction
    t += 7000;
    const v3 = engine.registerFocusLoss(status, 'blur', t);
    expect(v3?.penalty).toBe('point_deduction');
    expect(v3?.deduction).toBe(1);

    // Violation 4: Disqualification
    t += 200;
    const v4 = engine.registerFocusLoss(status, 'blur', t);
    expect(v4?.penalty).toBe('disqualified');
    expect(status.isDisqualified).toBe(true);
    expect(engine.canSubmitAnswer(status, t).allowed).toBe(false);
  });

  // 15. Match completion and winner selection
  it('Requirement 15: Match completion triggers when target round is completed', () => {
    const match = new Match(
      'match-win',
      'WINNER',
      'p1',
      'Alice',
      'sock-1',
      true,
      { isTestMode: true, targetRound: 1 }, // Target is completing Round 1
      qm,
      matchCallbacks
    );

    match.startMatch();

    // Round 1 requires 3 correct answers
    for (let i = 0; i < 3; i++) {
      const qInstanceId = match.getSummary().players['p1'].currentQuestion!.instanceId;
      const qInstance = qm.getInstance(qInstanceId)!;
      match.submitAnswer('p1', qInstanceId, qInstance.canonicalAnswer);
    }

    expect(match.status).toBe('completed');
    expect(match.getSummary().winnerUsername).toBe('Alice');
    expect(matchCallbacks.onMatchCompleted).toHaveBeenCalled();
  });

  // 16. Private-room join codes
  it('Requirement 16: Private room generates 6-character room code and allows joining', () => {
    const mm = new MatchManager(
      qm,
      () => {},
      () => {}
    );

    const { match, playerId } = mm.createMatch('Host', 'sock-host', true, false);
    expect(match.roomCode.length).toBe(6);

    const joinRes = mm.joinMatch('Joiner', 'sock-joiner', match.roomCode);
    expect(joinRes.success).toBe(true);
    expect(joinRes.match?.matchId).toBe(match.matchId);

    // Invalid code returns error
    const failRes = mm.joinMatch('Stranger', 'sock-stranger', 'INVALID');
    expect(failRes.success).toBe(false);
    expect(failRes.error).toContain('not found');
  });

  // 17. Disconnections and abandoned matches
  it('Requirement 17: Disconnections update player status and abandoned matches handle cleanup', () => {
    const match = new Match(
      'match-disc',
      'DISC12',
      'p1',
      'Alice',
      'sock-1',
      true,
      { isTestMode: true },
      qm,
      matchCallbacks
    );

    match.handleDisconnect('p1');
    expect(match.getSummary().players['p1'].isConnected).toBe(false);

    // When sole player leaves
    match.removePlayer('p1');
    expect(match.status).toBe('abandoned');
  });
});
