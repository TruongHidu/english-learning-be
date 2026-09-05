import { createHash } from "node:crypto";

export const normalizeQuestionContent = (value: string): string =>
    value
        .normalize("NFKC")
        .trim()
        .toLocaleLowerCase("en-US")
        .replace(/\s+/g, " ")
        .replace(/\s+([,.;:!?])/g, "$1")
        .replace(/([([{])\s+/g, "$1")
        .replace(/\s+([)\]}])/g, "$1");

export const buildQuestionDedupeKey = (
    topicId: string,
    type: string,
    content: string,
): string => createHash("sha256")
    .update(`${topicId}\u0000${type}\u0000${normalizeQuestionContent(content)}`)
    .digest("hex");

export const sentenceTokens = (value: string | string[]): string[] => {
    const parts = Array.isArray(value) ? value : value.trim().split(/\s+/);
    return parts
        .map((part) => normalizeQuestionContent(part))
        .filter((part) => part.length > 0);
};

export const haveSameTokenMultiset = (
    left: string | string[],
    right: string | string[],
): boolean => {
    const count = (tokens: string[]): Map<string, number> => {
        const result = new Map<string, number>();
        for (const token of tokens) result.set(token, (result.get(token) ?? 0) + 1);
        return result;
    };
    const leftCounts = count(sentenceTokens(left));
    const rightCounts = count(sentenceTokens(right));
    if (leftCounts.size !== rightCounts.size) return false;
    return Array.from(leftCounts.entries()).every(
        ([token, total]) => rightCounts.get(token) === total,
    );
};
