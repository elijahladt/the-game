/**
 * Quickfire Independent Progression Rules
 *
 * Formula: requiredCorrectAnswers = 2 + currentRound
 * Round 1 -> 3
 * Round 2 -> 4
 * Round 3 -> 5
 * Round 4 -> 6
 * etc.
 */

export function getRequiredAnswersForRound(round: number): number {
  const r = Math.max(1, Math.floor(round));
  return 2 + r;
}

export function shouldAdvanceRound(currentRound: number, currentRoundCorrectAnswers: number): boolean {
  return currentRoundCorrectAnswers >= getRequiredAnswersForRound(currentRound);
}

export function getNextDifficultyForRound(round: number): 'easy' | 'medium' | 'hard' {
  if (round <= 2) return 'easy';
  if (round <= 5) return 'medium';
  return 'hard';
}
