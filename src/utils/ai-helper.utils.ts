import type { VocabularyDifficulty } from "../types/vocabulary.types.js";
import type { QuestionType } from "../types/question.types.js";

export function mapLevelToDifficulty(level: string): VocabularyDifficulty {
    switch (level) {
        case "A1":
        case "A2":
            return "EASY";
        case "B1":
        case "B2":
            return "MEDIUM";
        case "C1":
        case "C2":
            return "HARD";
        default:
            return "EASY";
    }
}

export function normalizeQuestionType(typeStr: string): QuestionType {
    const upper = typeStr.toUpperCase();
    if (upper === "FILL_IN_BLANK" || upper === "FILL_BLANK") return "FILL_BLANK";
    if (upper === "REORDER" || upper === "ORDER_SENTENCE") return "ORDER_SENTENCE";
    if (upper === "MATCHING") return "MATCHING";
    if (upper === "TRANSLATION") return "TRANSLATION";
    if (upper === "LISTENING") return "LISTENING";
    return "MULTIPLE_CHOICE";
}
