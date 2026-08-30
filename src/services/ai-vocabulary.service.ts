import { Types } from "mongoose";
import { AppError } from "../errors/app-error.js";
import { VocabularyModel } from "../models/vocabulary.model.js";
import { TopicModel } from "../models/topic.model.js";
import { LessonModel } from "../models/lesson.model.js";
import type { VocabularyDifficulty } from "../types/vocabulary.types.js";
import {
    VOCAB_DATABASE,
    mapLevelToDifficulty,
    safeParseJsonArray,
    type VocabSeed,
} from "../utils/ai-helper.utils.js";

export interface GenerateVocabulariesInput {
    topicId: string;
    lessonId?: string;
    level: "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
    quantity: number;
}

export class AiVocabularyService {
    /**
     * AI Generate Vocabularies via Gemini REST API / OpenAI API / Smart Fallback
     */
    async generateVocabularies(input: GenerateVocabulariesInput) {
        const { topicId, lessonId, level, quantity } = input;

        if (!Types.ObjectId.isValid(topicId)) {
            throw new AppError("INVALID_TOPIC_ID", "ID chủ đề không hợp lệ", 400);
        }

        const topic = await TopicModel.findById(topicId).exec();
        if (!topic) {
            throw new AppError("TOPIC_NOT_FOUND", "Không tìm thấy chủ đề", 404);
        }

        let lessonName = "";
        if (lessonId && Types.ObjectId.isValid(lessonId)) {
            const lesson = await LessonModel.findById(lessonId).exec();
            if (lesson) lessonName = lesson.name;
        }

        const contextTopic = lessonName ? `${topic.name} - ${lessonName}` : topic.name;
        const difficulty = mapLevelToDifficulty(level);

        // Fetch existing words for deduplication
        const existingVocabs = await VocabularyModel.find(
            { topicId: new Types.ObjectId(topicId) },
            { word: 1 }
        ).exec();
        const existingWords = new Set(existingVocabs.map((v) => v.word.trim().toLowerCase()));

        let generatedItems: Array<VocabSeed> = [];
        const promptContext = lessonName ? `Lesson: "${lessonName}" (under Topic: "${topic.name}")` : `Topic: "${topic.name}"`;

        if (process.env.GEMINI_API_KEY) {
            generatedItems = await this.callGeminiForVocabularies(promptContext, level, quantity * 2, existingWords);
        } else if (process.env.OPENAI_API_KEY) {
            generatedItems = await this.callOpenAIForVocabularies(promptContext, level, quantity * 2, existingWords);
        } else {
            generatedItems = this.generateFallbackVocabularies(promptContext, level, quantity * 2, existingWords);
        }

        const uniqueNewItems = generatedItems.filter(
            (item) => item.word && !existingWords.has(item.word.trim().toLowerCase())
        );

        let finalItems = uniqueNewItems.slice(0, quantity);

        if (finalItems.length < quantity) {
            const fallbackPool = this.generateFallbackVocabularies(promptContext, level, quantity * 3, existingWords);
            for (const fbItem of fallbackPool) {
                if (finalItems.length >= quantity) break;
                const wLower = fbItem.word.trim().toLowerCase();
                if (!existingWords.has(wLower) && !finalItems.some((x) => x.word.trim().toLowerCase() === wLower)) {
                    finalItems.push(fbItem);
                }
            }
        }

        if (finalItems.length === 0) {
            throw new AppError(
                "DUPLICATE_VOCABULARIES",
                "Tất cả từ vựng này đã tồn tại trong bài. Vui lòng chọn bài khác hoặc thử lại.",
                400
            );
        }

        const vocabDocs = finalItems.map((item) => ({
            topicId: new Types.ObjectId(topicId),
            word: item.word.trim(),
            meaning: item.meaning.trim(),
            phonetic: item.phonetic?.trim() || "/.../",
            partOfSpeech: item.partOfSpeech?.trim() || "noun",
            example: item.example?.trim() || `Example with ${item.word}`,
            exampleMeaning: item.exampleMeaning?.trim() || `Ví dụ với từ ${item.word}`,
            difficulty,
            status: "DRAFT" as const,
            createdByAi: true,
        }));

        const inserted = await VocabularyModel.insertMany(vocabDocs);

        return {
            topicId,
            topicName: topic.name,
            level,
            difficulty,
            count: inserted.length,
            vocabularies: inserted.map((v) => ({
                id: v._id.toString(),
                word: v.word,
                meaning: v.meaning,
                phonetic: v.phonetic,
                partOfSpeech: v.partOfSpeech,
                example: v.example,
                exampleMeaning: v.exampleMeaning,
                difficulty: v.difficulty,
                status: v.status,
                createdByAi: v.createdByAi,
            })),
        };
    }

    /**
     * Bulk Publish Vocabularies
     */
    async bulkPublishVocabularies(ids: string[]): Promise<{ modifiedCount: number }> {
        const validObjIds = ids.filter((id) => Types.ObjectId.isValid(id)).map((id) => new Types.ObjectId(id));
        if (validObjIds.length === 0) return { modifiedCount: 0 };

        const result = await VocabularyModel.updateMany(
            { _id: { $in: validObjIds } },
            { $set: { status: "PUBLISHED" } }
        ).exec();

        return { modifiedCount: result.modifiedCount };
    }

    /**
     * Bulk Delete Vocabularies
     */
    async bulkDeleteVocabularies(ids: string[]): Promise<{ deletedCount: number }> {
        const validObjIds = ids.filter((id) => Types.ObjectId.isValid(id)).map((id) => new Types.ObjectId(id));
        if (validObjIds.length === 0) return { deletedCount: 0 };

        const result = await VocabularyModel.deleteMany({ _id: { $in: validObjIds } }).exec();
        return { deletedCount: result.deletedCount };
    }

    private async callGeminiForVocabularies(contextDescription: string, level: string, quantity: number, existingWords?: Set<string>): Promise<VocabSeed[]> {
        try {
            const excludeList = existingWords && existingWords.size > 0
                ? Array.from(existingWords).slice(0, 50).join(", ")
                : "";
            const excludeInstruction = excludeList
                ? `\nCRITICAL EXCLUSION RULE: Do NOT generate any of the following existing words: [${excludeList}]. You MUST generate BRAND NEW, DIFFERENT words.`
                : "";

            const prompt = `Generate ${quantity} real English vocabulary words directly and specifically relevant to ${contextDescription} at CEFR level ${level}.${excludeInstruction}
Ensure every single word is closely tied to the specific lesson context and meaning.
Return ONLY a valid JSON array matching this exact structure:
[
  {
    "word": "father",
    "meaning": "bố, cha",
    "phonetic": "/ˈfɑː.ðər/",
    "partOfSpeech": "noun",
    "example": "My father is a doctor.",
    "exampleMeaning": "Bố tôi là một bác sĩ."
  }
]`;
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { responseMimeType: "application/json" },
                }),
            });
            const data: any = await res.json();
            const parts = data.candidates?.[0]?.content?.parts || [];
            const text = parts.map((p: any) => p.text).filter(Boolean).join("");
            return safeParseJsonArray(text);
        } catch (e) {
            console.error("Gemini API error, falling back to smart generator:", e);
            return this.generateFallbackVocabularies(contextDescription, level, quantity, existingWords);
        }
    }

    private async callOpenAIForVocabularies(topicName: string, level: string, quantity: number, existingWords?: Set<string>): Promise<VocabSeed[]> {
        try {
            const excludeList = existingWords && existingWords.size > 0
                ? Array.from(existingWords).slice(0, 50).join(", ")
                : "";
            const prompt = `Generate ${quantity} real English vocabulary words for topic "${topicName}" at level ${level} in JSON array. Do not use: [${excludeList}].`;
            const res = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                },
                body: JSON.stringify({
                    model: "gpt-4o-mini",
                    messages: [{ role: "user", content: prompt }],
                }),
            });
            const data: any = await res.json();
            const text = data.choices?.[0]?.message?.content || "";
            return safeParseJsonArray(text);
        } catch (e) {
            return this.generateFallbackVocabularies(topicName, level, quantity, existingWords);
        }
    }

    private generateFallbackVocabularies(contextName: string, _level: string, quantity: number, existingWords?: Set<string>): VocabSeed[] {
        const nameLower = contextName.toLowerCase();

        let primaryPool: VocabSeed[] = VOCAB_DATABASE.daily || [];
        if (nameLower.includes("chào") || nameLower.includes("greet") || nameLower.includes("giao tiếp")) {
            primaryPool = VOCAB_DATABASE.greeting || [];
        } else if (nameLower.includes("ăn") || nameLower.includes("thực") || nameLower.includes("food")) {
            primaryPool = VOCAB_DATABASE.food || [];
        } else if (nameLower.includes("du lịch") || nameLower.includes("đi") || nameLower.includes("travel")) {
            primaryPool = VOCAB_DATABASE.travel || [];
        }

        const allPools = [
            ...primaryPool,
            ...(VOCAB_DATABASE.greeting || []),
            ...(VOCAB_DATABASE.food || []),
            ...(VOCAB_DATABASE.travel || []),
            ...(VOCAB_DATABASE.daily || []),
        ];

        const defaultItem: VocabSeed = {
            word: "welcome",
            meaning: "chào mừng",
            phonetic: "/ˈwel.kəm/",
            partOfSpeech: "interjection",
            example: "Welcome to our class!",
            exampleMeaning: "Chào mừng bạn đến với lớp học của chúng tôi!"
        };

        const results: VocabSeed[] = [];
        const seenWords = new Set<string>();

        for (let i = 0; i < allPools.length && results.length < quantity; i++) {
            const item = allPools[i] ?? defaultItem;
            const wordKey = item.word.trim().toLowerCase();
            if (!seenWords.has(wordKey) && (!existingWords || !existingWords.has(wordKey))) {
                seenWords.add(wordKey);
                results.push({
                    word: item.word,
                    meaning: item.meaning,
                    phonetic: item.phonetic,
                    partOfSpeech: item.partOfSpeech,
                    example: item.example,
                    exampleMeaning: item.exampleMeaning,
                });
            }
        }

        return results;
    }
}
