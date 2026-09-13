export const REVIEW_MODES = [
  "SMART_REVIEW",
  "QUICK_PRACTICE",
  "TEST_MODE",
] as const;
export type ReviewMode = (typeof REVIEW_MODES)[number];

export const REVIEW_SCOPES = [
  "SMART_QUEUE",
  "DUE_ONLY",
  "WEAK_WORDS",
  "RECENTLY_LEARNED",
  "MISTAKES",
  "BOOKMARKED",
  "MASTERED_CHECK",
  "FREE_REVIEW",
] as const;
export type ReviewScope = (typeof REVIEW_SCOPES)[number];

export const REVIEW_SKILLS = [
  "ADAPTIVE",
  "MEANING",
  "LISTENING",
  "SPELLING",
  "CONTEXT",
] as const;
export type ReviewSkill = (typeof REVIEW_SKILLS)[number];

export const REVIEW_QUESTION_TYPES = [
  "WORD_TO_MEANING",
  "MEANING_TO_WORD",
  "LISTENING_TO_WORD",
  "TYPING_WORD",
  "FILL_IN_BLANK",
] as const;
export type ReviewQuestionType = (typeof REVIEW_QUESTION_TYPES)[number];

export const ANSWER_QUALITIES = [
  "FAIL",
  "RETRY_CORRECT",
  "HARD",
  "GOOD",
  "EASY",
] as const;
export type AnswerQuality = (typeof ANSWER_QUALITIES)[number];

export interface CreateReviewSessionInput {
  mode: ReviewMode;
  scope: ReviewScope;
  selectionMode: "WORD_COUNT" | "TIME";
  wordCount?: number;
  targetMinutes?: number;
  topicIds: string[];
  skillFocus: ReviewSkill;
  intensity: "LIGHT" | "STANDARD" | "DEEP";
  autoPlayAudio: boolean;
  showPhonetic: boolean;
  includeMastered: boolean;
  recentDays?: 1 | 3 | 7;
}

export interface SubmitReviewAnswerInput {
  questionId: string;
  selectedOptionId?: string | null;
  typedAnswer?: string | null;
  responseTimeMs: number;
  usedHint: boolean;
}
