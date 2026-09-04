import type {
    AiGenerationRequestOptions,
    AiQuestionPromptInput,
    AiVocabularyPromptInput,
    IAiContentGenerator,
} from "../../src/ai/interfaces/ai-content-generator.interface.js";
import { AppError } from "../../src/errors/app-error.js";

export interface FakeAiContentGeneratorOptions {
    vocabularies?: unknown;
    questions?: unknown;
    error?: Error;
    waitForQuestionAbort?: boolean;
}

export class FakeAiContentGenerator implements IAiContentGenerator {
    public vocabularyCalls = 0;
    public questionCalls = 0;
    public lastVocabularyInput: AiVocabularyPromptInput | null = null;
    public lastQuestionInput: AiQuestionPromptInput | null = null;

    constructor(private readonly options: FakeAiContentGeneratorOptions = {}) {}

    async generateVocabularies(input: AiVocabularyPromptInput): Promise<unknown> {
        this.vocabularyCalls += 1;
        this.lastVocabularyInput = input;
        if (this.options.error) throw this.options.error;
        return this.options.vocabularies ?? [];
    }

    async generateQuestions(
        input: AiQuestionPromptInput,
        requestOptions?: AiGenerationRequestOptions,
    ): Promise<unknown> {
        this.questionCalls += 1;
        this.lastQuestionInput = input;
        if (this.options.error) throw this.options.error;
        if (this.options.waitForQuestionAbort) {
            return new Promise<never>((_resolve, reject) => {
                const rejectCanceled = (): void => reject(new AppError(
                    "AI_GENERATION_CANCELED",
                    "Yêu cầu tạo nội dung AI đã bị hủy",
                    499,
                ));
                if (requestOptions?.signal?.aborted) rejectCanceled();
                else requestOptions?.signal?.addEventListener("abort", rejectCanceled, { once: true });
            });
        }
        return this.options.questions ?? [];
    }
}
