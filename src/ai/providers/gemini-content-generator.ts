import { AppError } from "../../errors/app-error.js";
import type {
    AiGenerationRequestOptions,
    AiQuestionPromptInput,
    AiVocabularyPromptInput,
    IAiContentGenerator,
} from "../interfaces/ai-content-generator.interface.js";

interface GeminiContentGeneratorOptions {
    apiKey?: string;
    modelName?: string;
    timeoutMs?: number;
    fetchImpl?: typeof fetch;
}

interface UnknownRecord {
    [key: string]: unknown;
}

const isRecord = (value: unknown): value is UnknownRecord =>
    typeof value === "object" && value !== null && !Array.isArray(value);

const isAbortError = (error: unknown): boolean =>
    error instanceof Error && error.name === "AbortError";

/** Gemini adapter. It never supplies hard-coded content when the provider fails. */
export class GeminiContentGenerator implements IAiContentGenerator {
    private readonly apiKey: string;
    private readonly modelName: string;
    private readonly timeoutMs: number;
    private readonly fetchImpl: typeof fetch;

    constructor(options: GeminiContentGeneratorOptions = {}) {
        this.apiKey = options.apiKey ?? process.env.GEMINI_API_KEY ?? "";
        this.modelName = options.modelName ?? process.env.AI_MODEL ?? "gemini-2.0-flash";
        const configuredTimeout = options.timeoutMs ?? Number(process.env.AI_TIMEOUT_MS ?? 30_000);
        this.timeoutMs = Number.isFinite(configuredTimeout) && configuredTimeout > 0
            ? configuredTimeout
            : 30_000;
        this.fetchImpl = options.fetchImpl ?? fetch;
    }

    async generateVocabularies(
        input: AiVocabularyPromptInput,
        options?: AiGenerationRequestOptions,
    ): Promise<unknown> {
        const prompt = this.buildVocabularyPrompt(input);
        return this.generateJson(prompt, options?.signal);
    }

    async generateQuestions(
        input: AiQuestionPromptInput,
        options?: AiGenerationRequestOptions,
    ): Promise<unknown> {
        const prompt = this.buildQuestionPrompt(input);
        return this.generateJson(prompt, options?.signal);
    }

    private async generateJson(prompt: string, externalSignal?: AbortSignal): Promise<unknown> {
        if (!this.apiKey.trim()) {
            throw new AppError(
                "AI_PROVIDER_NOT_CONFIGURED",
                "AI provider chưa được cấu hình API key",
                503,
            );
        }

        if (externalSignal?.aborted) {
            throw new AppError("AI_GENERATION_CANCELED", "Yêu cầu tạo nội dung AI đã bị hủy", 499);
        }

        const controller = new AbortController();
        let timedOut = false;
        const abortFromClient = (): void => controller.abort();
        externalSignal?.addEventListener("abort", abortFromClient, { once: true });
        const timeout = setTimeout(() => {
            timedOut = true;
            controller.abort();
        }, this.timeoutMs);

        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.modelName)}:generateContent`;
            const response = await this.fetchImpl(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-goog-api-key": this.apiKey,
                },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { responseMimeType: "application/json" },
                }),
                signal: controller.signal,
            });

            const responseText = await response.text();
            if (!response.ok) {
                throw new AppError(
                    "AI_PROVIDER_ERROR",
                    `AI provider trả về lỗi HTTP ${response.status}`,
                    502,
                );
            }

            const responseBody = this.parseResponseBody(responseText);
            const generatedText = this.extractGeneratedText(responseBody);
            if (!generatedText) {
                throw new AppError(
                    "AI_PROVIDER_INVALID_RESPONSE",
                    "AI provider trả về dữ liệu không hợp lệ",
                    502,
                );
            }

            return this.parseGeneratedJson(generatedText);
        } catch (error: unknown) {
            if (error instanceof AppError) throw error;
            if (isAbortError(error)) {
                if (externalSignal?.aborted && !timedOut) {
                    throw new AppError(
                        "AI_GENERATION_CANCELED",
                        "Yêu cầu tạo nội dung AI đã bị hủy",
                        499,
                    );
                }
                throw new AppError(
                    "AI_PROVIDER_TIMEOUT",
                    "AI provider phản hồi quá thời gian cho phép",
                    504,
                );
            }
            throw new AppError(
                "AI_PROVIDER_ERROR",
                "Không thể kết nối AI provider",
                502,
            );
        } finally {
            clearTimeout(timeout);
            externalSignal?.removeEventListener("abort", abortFromClient);
        }
    }

    private parseResponseBody(responseText: string): unknown {
        try {
            return JSON.parse(responseText) as unknown;
        } catch (_error: unknown) {
            throw new AppError(
                "AI_PROVIDER_INVALID_RESPONSE",
                "AI provider trả về dữ liệu không hợp lệ",
                502,
            );
        }
    }

    private extractGeneratedText(body: unknown): string | null {
        if (!isRecord(body) || !Array.isArray(body.candidates)) return null;
        const firstCandidate = body.candidates[0];
        if (!isRecord(firstCandidate) || !isRecord(firstCandidate.content)) return null;
        const parts = firstCandidate.content.parts;
        if (!Array.isArray(parts)) return null;

        const texts = parts
            .filter(isRecord)
            .map((part) => part.text)
            .filter((text): text is string => typeof text === "string" && text.trim().length > 0);
        return texts.length > 0 ? texts.join("") : null;
    }

    private parseGeneratedJson(text: string): unknown {
        const cleaned = text
            .trim()
            .replace(/^```(?:json)?\s*/i, "")
            .replace(/\s*```$/i, "")
            .trim();

        try {
            return JSON.parse(cleaned) as unknown;
        } catch (_error: unknown) {
            throw new AppError(
                "AI_OUTPUT_INVALID",
                "AI trả về JSON không hợp lệ",
                502,
            );
        }
    }

    private buildVocabularyPrompt(input: AiVocabularyPromptInput): string {
        const excludedWords = input.excludeWords.length > 0
            ? `Không được lặp lại các từ sau: ${input.excludeWords.slice(0, 100).join(", ")}.`
            : "Không được lặp lại từ trong danh sách hiện có.";

        const additionalRequirements = input.requirements
            ? `Yêu cầu bổ sung của quản trị viên: ${input.requirements}`
            : "";

        return `Bạn là giáo viên tiếng Anh. Hãy tạo ${input.quantity} từ vựng mới, phù hợp chủ đề "${input.topicName}"${input.lessonName ? ` và bài "${input.lessonName}"` : ""}, trình độ CEFR ${input.level}.
${excludedWords}
${additionalRequirements}
Chỉ trả về một JSON array, không markdown, theo đúng schema:
[{"word":"...","meaning":"...","phonetic":"...","partOfSpeech":"...","example":"...","exampleMeaning":"..."}]
Mọi trường chuỗi phải có nội dung ngắn gọn và chính xác.`;
    }

    private buildQuestionPrompt(input: AiQuestionPromptInput): string {
        const vocabularyContext = input.vocabularies
            .slice(0, 100)
            .map((vocabulary) =>
                `ID=${vocabulary.id}; word="${vocabulary.word}"; meaning="${vocabulary.meaning}"; example="${vocabulary.example ?? ""}"`,
            )
            .join("\n");

        const additionalRequirements = input.requirements
            ? `Yêu cầu bổ sung của quản trị viên: ${input.requirements}`
            : "";

        return `Bạn là giáo viên tiếng Anh. Hãy tạo ${input.quantity} câu hỏi cho chủ đề "${input.topicName}"${input.lessonName ? ` và bài "${input.lessonName}"` : ""}, độ khó ${input.difficulty}.
Chỉ dùng chính xác các loại được yêu cầu: ${input.questionTypes.join(", ")}.
Chỉ dùng đúng vocabulary ID xuất hiện trong danh sách dưới đây; không tự tạo hoặc thay đổi ID.
Các từ vựng mục tiêu:
${vocabularyContext}
${additionalRequirements}
Chỉ trả về một JSON array, không markdown. Mỗi phần tử phải có type và đúng schema:
Mọi phần tử phải có difficulty là ${input.difficulty}.
MULTIPLE_CHOICE: {type, vocabularyId, content, instruction, correctAnswer, options:[{content,isCorrect,orderIndex}], explanation, difficulty}; options có đúng một isCorrect=true và không trùng content.
MATCHING: {type, vocabularyId, content, instruction, matchingPairs:[{vocabularyId,leftValue,rightValue,orderIndex}], explanation, difficulty}; các cặp không trùng.
FILL_BLANK: {type, vocabularyId, content có _____, instruction, correctAnswer, explanation, difficulty}.
ORDER_SENTENCE: {type, vocabularyId, content, instruction, correctAnswer là chuỗi câu hoàn chỉnh, options:[{content là từng token,isCorrect:true,orderIndex}], explanation, difficulty}; multiset token trong options phải khớp correctAnswer, kể cả từ lặp.
TRANSLATION: {type, vocabularyId, content là câu tiếng Anh tự nhiên có dùng từ vựng mục tiêu, instruction:"Dịch câu sau sang tiếng Việt.", correctAnswer là bản dịch tiếng Việt tự nhiên và chính xác, explanation, difficulty}; chỉ tạo dạng này khi TRANSLATION được yêu cầu và không thêm options hoặc matchingPairs.
Không trả LISTENING hoặc bất kỳ loại nào ngoài danh sách được yêu cầu.`;
    }
}
