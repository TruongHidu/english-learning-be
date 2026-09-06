const DEFAULT_TRANSLATION_MIN_SCORE = 0.85;
const DEFAULT_TRANSLATION_TIMEOUT_MS = 5_000;
const MIN_TRANSLATION_TIMEOUT_MS = 100;
const MAX_TRANSLATION_TIMEOUT_MS = 120_000;

export function parseTranslationGradingEnabled(value: string | undefined): boolean {
    return value?.trim().toLowerCase() === "true";
}

export function parseTranslationMinScore(value: string | undefined): number {
    if (!value?.trim()) return DEFAULT_TRANSLATION_MIN_SCORE;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 && parsed <= 1
        ? parsed
        : DEFAULT_TRANSLATION_MIN_SCORE;
}

export function parseTranslationTimeoutMs(value: string | undefined): number {
    if (!value?.trim()) return DEFAULT_TRANSLATION_TIMEOUT_MS;
    const parsed = Number(value);
    return Number.isInteger(parsed)
        && parsed >= MIN_TRANSLATION_TIMEOUT_MS
        && parsed <= MAX_TRANSLATION_TIMEOUT_MS
        ? parsed
        : DEFAULT_TRANSLATION_TIMEOUT_MS;
}

export const TRANSLATION_GRADING_ENABLED = parseTranslationGradingEnabled(
    process.env.AI_TRANSLATION_GRADING_ENABLED,
);
export const TRANSLATION_MIN_SCORE = parseTranslationMinScore(
    process.env.AI_TRANSLATION_MIN_SCORE,
);
export const TRANSLATION_TIMEOUT_MS = parseTranslationTimeoutMs(
    process.env.AI_TRANSLATION_TIMEOUT_MS,
);
