/**
 * Answer Normalization and Matching Engine
 *
 * Rules:
 * - Normalize capitalization and harmless punctuation
 * - Trim whitespace and collapse internal spaces
 * - Strip leading articles ('a', 'an', 'the') when appropriate
 * - Support explicitly configured alternative answers
 * - Do not use overly permissive matching that accepts unrelated answers
 */

export function normalizeAnswer(input: string): string {
  if (!input) return '';

  return (
    input
      .trim()
      // Normalize Unicode (e.g. café -> cafe)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      // Remove surrounding/internal harmless punctuation: quotes, periods, commas, exclamation marks, question marks, hyphens to spaces
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, ' ')
      // Collapse multiple whitespace
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/**
 * Remove leading articles: 'the ', 'a ', 'an '
 */
export function stripLeadingArticles(normalized: string): string {
  if (normalized.startsWith('the ')) return normalized.slice(4).trim();
  if (normalized.startsWith('a ')) return normalized.slice(2).trim();
  if (normalized.startsWith('an ')) return normalized.slice(3).trim();
  return normalized;
}

/**
 * Check if a player's submission matches either the canonical answer
 * or any accepted alternative answers.
 */
export function isAnswerCorrect(
  submission: string,
  canonicalAnswer: string,
  acceptedAnswers: string[] = []
): boolean {
  const cleanSubmission = normalizeAnswer(submission);
  if (!cleanSubmission) return false;

  const candidateAnswers = [canonicalAnswer, ...acceptedAnswers];

  for (const candidate of candidateAnswers) {
    const cleanCandidate = normalizeAnswer(candidate);
    if (!cleanCandidate) continue;

    // Exact normalized match
    if (cleanSubmission === cleanCandidate) {
      return true;
    }

    // Article-stripped match (e.g., "The Eiffel Tower" vs "Eiffel Tower")
    const subNoArticle = stripLeadingArticles(cleanSubmission);
    const candNoArticle = stripLeadingArticles(cleanCandidate);

    if (subNoArticle.length > 0 && subNoArticle === candNoArticle) {
      return true;
    }

    // Number words conversion if simple (e.g. "three" vs "3")
    if (normalizeNumberEquivalence(cleanSubmission) === normalizeNumberEquivalence(cleanCandidate)) {
      return true;
    }
  }

  return false;
}

const NUMBER_WORDS: Record<string, string> = {
  zero: '0',
  one: '1',
  two: '2',
  three: '3',
  four: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  nine: '9',
  ten: '10',
  eleven: '11',
  twelve: '12',
};

function normalizeNumberEquivalence(val: string): string {
  return NUMBER_WORDS[val] ?? val;
}
