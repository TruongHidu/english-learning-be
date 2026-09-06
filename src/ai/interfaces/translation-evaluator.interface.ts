export interface TranslationEvaluationInput {
    referenceAnswer: string;
    userAnswer: string;
}

export interface TranslationEvaluationResult {
    semanticScore: number;
    hasCriticalError: boolean;
    errorTypes: string[];
    reason: string;
}

export interface TranslationEvaluationOptions {
    signal?: AbortSignal;
}

/** Isolated provider boundary for semantic translation grading. */
export interface ITranslationEvaluator {
    evaluate(
        input: TranslationEvaluationInput,
        options?: TranslationEvaluationOptions,
    ): Promise<TranslationEvaluationResult>;
}
