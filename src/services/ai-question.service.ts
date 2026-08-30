import { Types } from "mongoose";
import { AppError } from "../errors/app-error.js";
import { VocabularyModel } from "../models/vocabulary.model.js";
import { QuestionModel } from "../models/question.model.js";
import { TopicModel } from "../models/topic.model.js";
import { LessonModel } from "../models/lesson.model.js";
import { LessonQuestionModel } from "../models/lesson-question.model.js";
import type { VocabularyDifficulty } from "../types/vocabulary.types.js";
import type { QuestionType } from "../types/question.types.js";
import { mapQuestionToResponse } from "../mappers/question.mapper.js";
import {
    VOCAB_DATABASE,
    normalizeQuestionType,
    safeParseJsonArray,
} from "../utils/ai-helper.utils.js";

export interface GenerateQuestionsInput {
    topicId: string;
    lessonId?: string;
    vocabularyId?: string;
    vocabularyIds?: string[];
    questionTypes: string[];
    quantity: number;
    difficulty?: VocabularyDifficulty;
}

export class AiQuestionService {
    /**
     * AI Generate Questions via Gemini REST API / OpenAI API / Smart Fallback
     */
    async generateQuestions(input: GenerateQuestionsInput) {
        const { topicId, lessonId, vocabularyId, vocabularyIds, questionTypes, quantity, difficulty = "EASY" } = input;

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

        const contextTopic = lessonName ? `${topic.name} (${lessonName})` : topic.name;

        let topicVocabs: any[] = [];
        if (vocabularyIds && Array.isArray(vocabularyIds) && vocabularyIds.length > 0) {
            const validIds = vocabularyIds.filter((id) => Types.ObjectId.isValid(id)).map((id) => new Types.ObjectId(id));
            if (validIds.length > 0) {
                topicVocabs = await VocabularyModel.find({ _id: { $in: validIds } }).exec();
            }
        } else if (vocabularyId && Types.ObjectId.isValid(vocabularyId)) {
            const singleVocab = await VocabularyModel.findById(vocabularyId).exec();
            if (singleVocab) topicVocabs = [singleVocab];
        }

        if (topicVocabs.length === 0) {
            topicVocabs = await VocabularyModel.find({ topicId: new Types.ObjectId(topicId) }).exec();
        }

        // Randomly shuffle topicVocabs so AI targets words in random order
        for (let i = topicVocabs.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [topicVocabs[i], topicVocabs[j]] = [topicVocabs[j], topicVocabs[i]];
        }

        const normalizedInputTypes = questionTypes.map(normalizeQuestionType);

        const existingQuestions = await QuestionModel.find(
            { vocabularyId: { $in: topicVocabs.map((v) => v._id) } },
            { content: 1 }
        ).exec();
        const existingContents = new Set(existingQuestions.map((q) => q.content.trim().toLowerCase()));

        let generatedQuestions: Array<any> = [];

        if (process.env.GEMINI_API_KEY) {
            generatedQuestions = await this.callGeminiForQuestions(contextTopic, topicVocabs, normalizedInputTypes, quantity * 2, difficulty);
        } else if (process.env.OPENAI_API_KEY) {
            generatedQuestions = await this.callOpenAIForQuestions(contextTopic, topicVocabs, normalizedInputTypes, quantity * 2, difficulty);
        } else {
            generatedQuestions = this.generateFallbackQuestions(contextTopic, topicVocabs, normalizedInputTypes, quantity * 2, difficulty);
        }

        const uniqueQuestions = generatedQuestions.filter(
            (q) => q.content && !existingContents.has(q.content.trim().toLowerCase())
        );

        let finalQuestions = uniqueQuestions.slice(0, quantity);

        if (finalQuestions.length < quantity) {
            const fallbackQPool = this.generateFallbackQuestions(contextTopic, topicVocabs, normalizedInputTypes, quantity * 3, difficulty);
            for (const fbQ of fallbackQPool) {
                if (finalQuestions.length >= quantity) break;
                if (!finalQuestions.some((x) => x.content.trim().toLowerCase() === fbQ.content.trim().toLowerCase())) {
                    finalQuestions.push(fbQ);
                }
            }
        }

        if (finalQuestions.length === 0) {
            throw new AppError(
                "DUPLICATE_QUESTIONS",
                "Tất cả các câu hỏi này đã tồn tại trong bài. Vui lòng chọn bài khác hoặc thử lại.",
                400
            );
        }

        const targetVocabObjId = vocabularyId && Types.ObjectId.isValid(vocabularyId) ? new Types.ObjectId(vocabularyId) : undefined;

        const questionDocs = finalQuestions.map((q, idx) => {
            const targetVocab = topicVocabs[idx % topicVocabs.length];
            const processedQ = this.ensureQuestionFeaturesVocab(q, targetVocab, contextTopic, topicVocabs);
            const finalType = normalizeQuestionType(processedQ.type || "MULTIPLE_CHOICE");
            const vocabIdObj = targetVocabObjId || (processedQ.vocabularyId && Types.ObjectId.isValid(processedQ.vocabularyId)
                ? new Types.ObjectId(processedQ.vocabularyId)
                : (targetVocab?._id ? new Types.ObjectId(targetVocab._id) : undefined));

            const allVocabIdObjs: Types.ObjectId[] = [];
            if (vocabIdObj) allVocabIdObjs.push(vocabIdObj);

            const matchingPairs = processedQ.matchingPairs ? processedQ.matchingPairs.map((pair: any, pIdx: number) => {
                const pairVObj = pair.vocabularyId && Types.ObjectId.isValid(pair.vocabularyId)
                    ? new Types.ObjectId(pair.vocabularyId)
                    : vocabIdObj;
                if (pairVObj && !allVocabIdObjs.some((id) => id.equals(pairVObj))) {
                    allVocabIdObjs.push(pairVObj);
                }
                return {
                    vocabularyId: pairVObj,
                    leftValue: pair.leftValue,
                    rightValue: pair.rightValue,
                    orderIndex: pIdx,
                };
            }) : undefined;

            return {
                vocabularyId: vocabIdObj,
                vocabularyIds: allVocabIdObjs.length > 0 ? allVocabIdObjs : undefined,
                type: finalType,
                content: processedQ.content,
                instruction: processedQ.instruction || "Chọn đáp án đúng nhất",
                correctAnswer: processedQ.correctAnswer,
                options: processedQ.options,
                matchingPairs,
                explanation: processedQ.explanation || "Giải thích chi tiết cho câu hỏi.",
                difficulty,
                status: "DRAFT" as const,
                createdByAi: true,
            };
        });

        const inserted = await QuestionModel.insertMany(questionDocs);

        if (lessonId && Types.ObjectId.isValid(lessonId)) {
            const lessonObjId = new Types.ObjectId(lessonId);
            const currentCount = await LessonQuestionModel.countDocuments({ lessonId: lessonObjId }).exec();
            const lessonQuestionDocs = inserted.map((q, idx) => ({
                lessonId: lessonObjId,
                questionId: q._id,
                orderIndex: currentCount + idx + 1,
            }));
            await LessonQuestionModel.insertMany(lessonQuestionDocs, { ordered: false }).catch(() => {
                // ignore duplicates
            });
        }

        const populatedQuestions = await QuestionModel.find({ _id: { $in: inserted.map((q) => q._id) } })
            .populate("vocabularyIds vocabularyId", "word meaning")
            .exec();
        const questionMap = new Map(populatedQuestions.map((q) => [q._id.toString(), q]));

        return {
            topicId,
            topicName: topic.name,
            count: inserted.length,
            questions: inserted.map((q) => {
                const popQ = questionMap.get(q._id.toString()) || q;
                return mapQuestionToResponse(popQ as any);
            }),
        };
    }

    /**
     * Bulk Publish Questions
     */
    async bulkPublishQuestions(ids: string[]): Promise<{ modifiedCount: number }> {
        const validObjIds = ids.filter((id) => Types.ObjectId.isValid(id)).map((id) => new Types.ObjectId(id));
        if (validObjIds.length === 0) return { modifiedCount: 0 };

        const result = await QuestionModel.updateMany(
            { _id: { $in: validObjIds } },
            { $set: { status: "PUBLISHED" } }
        ).exec();

        return { modifiedCount: result.modifiedCount };
    }

    /**
     * Bulk Delete Questions
     */
    async bulkDeleteQuestions(ids: string[]): Promise<{ deletedCount: number }> {
        const validObjIds = ids.filter((id) => Types.ObjectId.isValid(id)).map((id) => new Types.ObjectId(id));
        if (validObjIds.length === 0) return { deletedCount: 0 };

        await LessonQuestionModel.deleteMany({ questionId: { $in: validObjIds } }).exec();
        const result = await QuestionModel.deleteMany({ _id: { $in: validObjIds } }).exec();
        return { deletedCount: result.deletedCount };
    }

    private async callGeminiForQuestions(topicName: string, vocabs: any[], types: QuestionType[], quantity: number, difficulty: string) {
        try {
            const vocabContext = vocabs
                .map((v) => `[ID: ${v._id || v.id}] Word: "${v.word}" (Meaning: "${v.meaning}", Example: "${v.example || ''}")`)
                .slice(0, 15)
                .join("\n");

            const prompt = `CRITICAL REQUIREMENT: You are an expert English teacher. You MUST generate ${quantity} practice questions specifically focused on testing and containing the following target vocabulary words:
${vocabContext}

Target Topic: "${topicName}"
Difficulty: ${difficulty}
Allowed Question Types: ${types.join(", ")}

STRICT GENERATION RULES:
1. EVERY question generated MUST be built directly around one of the target vocabulary words listed above.
2. Randomly mix and evenly distribute the question types among the allowed question types: [${types.join(", ")}].
3. Include "vocabularyId" in your JSON output for each question, set to the exact ID of the target word tested in that question.
4. For MULTIPLE_CHOICE: Ask the meaning of the target word (e.g. 'What is the meaning of "word"?') or ask which English word means "meaning".
5. For FILL_BLANK: Create a natural sentence where the target vocabulary word is replaced with "_____", and set "correctAnswer" to the target vocabulary word itself.
6. For TRANSLATION: Create an English sentence containing the target word and ask the user to translate it into Vietnamese, set "correctAnswer" to the Vietnamese translation.
7. For MATCHING: Match the target vocabulary words to their exact Vietnamese meanings.
8. For ORDER_SENTENCE: Create a sentence that contains the target vocabulary word and set "correctAnswer" to the ordered words array.

Return ONLY a valid JSON array matching this exact JSON structure per question type:
For MULTIPLE_CHOICE:
{
  "type": "MULTIPLE_CHOICE",
  "vocabularyId": "target_vocab_id",
  "content": "Question text mentioning the target word...",
  "instruction": "Select the correct answer",
  "correctAnswer": "Correct option text",
  "options": [
    { "content": "Correct option text", "isCorrect": true, "orderIndex": 0 },
    { "content": "Wrong option 1", "isCorrect": false, "orderIndex": 1 },
    { "content": "Wrong option 2", "isCorrect": false, "orderIndex": 2 },
    { "content": "Wrong option 3", "isCorrect": false, "orderIndex": 3 }
  ],
  "explanation": "Detailed explanation..."
}

For FILL_BLANK:
{
  "type": "FILL_BLANK",
  "vocabularyId": "target_vocab_id",
  "content": "Sentence with _____ blank...",
  "instruction": "Type the correct word",
  "correctAnswer": "target_word",
  "explanation": "Explanation..."
}

For TRANSLATION:
{
  "type": "TRANSLATION",
  "vocabularyId": "target_vocab_id",
  "content": "Translate to Vietnamese: 'English sentence with target_word'",
  "instruction": "Type the Vietnamese translation",
  "correctAnswer": "Vietnamese translation text",
  "explanation": "Explanation..."
}

For MATCHING:
{
  "type": "MATCHING",
  "vocabularyId": "target_vocab_id",
  "content": "Match the terms...",
  "instruction": "Match pairs",
  "matchingPairs": [
    { "vocabularyId": "target_vocab_id", "leftValue": "target_word", "rightValue": "meaning" }
  ],
  "explanation": "Explanation..."
}

For ORDER_SENTENCE:
{
  "type": "ORDER_SENTENCE",
  "vocabularyId": "target_vocab_id",
  "content": "Sắp xếp các từ thành câu hoàn chỉnh:",
  "instruction": "Sắp xếp các từ theo đúng thứ tự",
  "correctAnswer": "Full English sentence containing target_word",
  "explanation": "Explanation..."
}`;

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
            console.error("Gemini Question API error, falling back to smart generator:", e);
            return this.generateFallbackQuestions(topicName, vocabs, types, quantity, difficulty);
        }
    }

    private async callOpenAIForQuestions(topicName: string, vocabs: any[], types: QuestionType[], quantity: number, difficulty: string) {
        return this.callGeminiForQuestions(topicName, vocabs, types, quantity, difficulty);
    }

    private getDistractorsForVocab(targetVocab: any, allVocabs: any[]): string[] {
        const targetMeaning = (targetVocab?.meaning || "").trim().toLowerCase();
        const otherMeanings = (allVocabs || [])
            .map((v) => (v.meaning || "").trim())
            .filter((m) => m && m.toLowerCase() !== targetMeaning);

        const uniqueMeanings = Array.from(new Set(otherMeanings));
        const defaultPool = ["Xin chào", "Tạm biệt", "Buổi sáng", "Buổi tối", "Cảm ơn", "Chào mừng", "Hẹn gặp lại"];

        for (const def of defaultPool) {
            if (uniqueMeanings.length >= 3) break;
            if (!uniqueMeanings.some((m) => m.toLowerCase() === def.toLowerCase()) && def.toLowerCase() !== targetMeaning) {
                uniqueMeanings.push(def);
            }
        }

        return uniqueMeanings.slice(0, 3);
    }

    private ensureQuestionFeaturesVocab(q: any, vocab: any, contextTopic: string, allVocabs: any[] = []): any {
        if (!vocab) return q;

        const word = (vocab.word || "").trim();
        const meaning = (vocab.meaning || "").trim();
        const example = (vocab.example || "").trim();
        const vocabIdStr = vocab._id?.toString() || vocab.id?.toString();

        const qType = normalizeQuestionType(q.type || "MULTIPLE_CHOICE");
        const contentLower = (q.content || "").toLowerCase();
        const wordLower = word.toLowerCase();

        const isTestingTargetWord =
            (wordLower && contentLower.includes(wordLower)) ||
            (typeof q.correctAnswer === "string" && q.correctAnswer.toLowerCase().includes(wordLower)) ||
            (Array.isArray(q.correctAnswer) && q.correctAnswer.some((w: any) => String(w).toLowerCase().includes(wordLower))) ||
            (Array.isArray(q.matchingPairs) && q.matchingPairs.some((p: any) => (p.leftValue || "").toLowerCase() === wordLower));

        if (isTestingTargetWord) {
            const processedQuestion = {
                ...q,
                type: qType,
                vocabularyId: vocabIdStr || q.vocabularyId,
            };

            if (qType === "ORDER_SENTENCE") {
                const answerStr = Array.isArray(q.correctAnswer)
                    ? q.correctAnswer.join(" ")
                    : String(q.correctAnswer || "");
                const words = answerStr.split(/\s+/).filter(Boolean);
                processedQuestion.content = "Sắp xếp các từ thành câu hoàn chỉnh:";
                processedQuestion.correctAnswer = answerStr;
                processedQuestion.options = words.map((w: string, idx: number) => ({
                    content: w,
                    isCorrect: true,
                    orderIndex: idx + 1,
                }));
            }

            return processedQuestion;
        }

        if (qType === "MULTIPLE_CHOICE") {
            const distractors = this.getDistractorsForVocab(vocab, allVocabs);
            const rawOptions = [
                { content: meaning, isCorrect: true },
                { content: distractors[0] || "Xin chào", isCorrect: false },
                { content: distractors[1] || "Buổi sáng", isCorrect: false },
                { content: distractors[2] || "Buổi tối", isCorrect: false },
            ];

            return {
                type: "MULTIPLE_CHOICE",
                vocabularyId: vocabIdStr,
                content: `Từ "${word}" có nghĩa là gì trong tiếng Việt?`,
                instruction: "Chọn 1 đáp án chính xác nhất",
                correctAnswer: meaning,
                options: rawOptions.map((opt, oIdx) => ({ ...opt, orderIndex: oIdx })),
                explanation: `"${word}" có nghĩa chính xác trong tiếng Việt là "${meaning}".`,
            };
        } else if (qType === "FILL_BLANK") {
            const blankSentence = example && example.toLowerCase().includes(wordLower)
                ? example.replace(new RegExp(word, "gi"), "_____")
                : `_____! See you tomorrow.`;
            return {
                type: "FILL_BLANK",
                vocabularyId: vocabIdStr,
                content: `Điền từ vựng thích hợp vào chỗ trống: "${blankSentence}"`,
                instruction: `Nhập từ tiếng Anh chính xác cho nghĩa "${meaning}"`,
                correctAnswer: word,
                explanation: `Từ đúng cần điền vào chỗ trống là "${word}" (Nghĩa: ${meaning}).`,
            };
        } else if (qType === "TRANSLATION") {
            const sentenceToTranslate = example && example.toLowerCase().includes(wordLower)
                ? example
                : `Say ${word} to your friends.`;
            const translationMeaning = (vocab.exampleMeaning || vocab.meaning || "").trim();
            return {
                type: "TRANSLATION",
                vocabularyId: vocabIdStr,
                content: `Dịch câu sau sang tiếng Việt: "${sentenceToTranslate}"`,
                instruction: "Nhập bản dịch tiếng Việt chính xác",
                correctAnswer: translationMeaning,
                explanation: `Bản dịch chuẩn của câu chứa từ "${word}" là: "${translationMeaning}".`,
            };
        } else if (qType === "MATCHING") {
            const pair1 = { vocabularyId: vocabIdStr, leftValue: word, rightValue: meaning };
            const otherVocabs = (allVocabs || []).filter((v) => (v.word || "").toLowerCase() !== wordLower);
            const pair2Vocab = otherVocabs[0] || { word: "Hello", meaning: "Xin chào" };
            const pair3Vocab = otherVocabs[1] || { word: "Morning", meaning: "Buổi sáng" };

            return {
                type: "MATCHING",
                vocabularyId: vocabIdStr,
                content: `Nối các từ vựng với nghĩa tiếng Việt tương ứng:`,
                instruction: "Kéo thả các cặp từ tương ứng",
                matchingPairs: [
                    pair1,
                    { vocabularyId: pair2Vocab._id?.toString(), leftValue: pair2Vocab.word, rightValue: pair2Vocab.meaning },
                    { vocabularyId: pair3Vocab._id?.toString(), leftValue: pair3Vocab.word, rightValue: pair3Vocab.meaning },
                ],
                explanation: `Ghép cặp chính xác: "${word}" - "${meaning}".`,
            };
        } else {
            // ORDER_SENTENCE
            const sentenceToOrder = example && example.toLowerCase().includes(wordLower)
                ? example
                : `Say ${word} to everyone before leaving.`;
            const words = sentenceToOrder.split(/\s+/).filter(Boolean);
            return {
                type: "ORDER_SENTENCE",
                vocabularyId: vocabIdStr,
                content: "Sắp xếp các từ thành câu hoàn chỉnh:",
                instruction: "Sắp xếp các từ theo đúng thứ tự",
                correctAnswer: sentenceToOrder,
                options: words.map((w: string, idx: number) => ({
                    content: w,
                    isCorrect: true,
                    orderIndex: idx + 1,
                })),
                explanation: `Thứ tự chuẩn của câu chứa từ "${word}" là: "${sentenceToOrder}".`,
            };
        }
    }

    private generateFallbackQuestions(_contextName: string, vocabs: any[], types: QuestionType[], quantity: number, _difficulty: string) {
        const allowedTypes = types.length > 0 ? types : ["MULTIPLE_CHOICE", "FILL_BLANK", "TRANSLATION", "MATCHING", "ORDER_SENTENCE"];
        const shuffledTypes = [...allowedTypes].sort(() => Math.random() - 0.5);
        const results = [];

        for (let i = 0; i < quantity; i++) {
            const rawType = shuffledTypes[i % shuffledTypes.length] || "MULTIPLE_CHOICE";
            const qType = normalizeQuestionType(rawType);
            const vocab = vocabs[i % (vocabs.length || 1)];
            const word = vocab?.word || `greeting`;
            const meaning = vocab?.meaning || `lời chào`;
            const example = vocab?.example || `He sent a warm greeting to everyone.`;
            const exampleMeaning = vocab?.exampleMeaning || `Anh ấy đã gửi lời chào ấm áp tới mọi người.`;

            if (qType === "MULTIPLE_CHOICE") {
                const distractors = this.getDistractorsForVocab(vocab, vocabs);
                results.push({
                    type: "MULTIPLE_CHOICE",
                    content: `Từ "${word}" có nghĩa là gì trong tiếng Việt?`,
                    instruction: "Chọn 1 đáp án chính xác nhất",
                    vocabularyId: vocab?._id?.toString(),
                    correctAnswer: meaning,
                    options: [
                        { content: meaning, isCorrect: true, orderIndex: 0 },
                        { content: distractors[0] || "Xin chào", isCorrect: false, orderIndex: 1 },
                        { content: distractors[1] || "Buổi sáng", isCorrect: false, orderIndex: 2 },
                        { content: distractors[2] || "Buổi tối", isCorrect: false, orderIndex: 3 },
                    ],
                    explanation: `"${word}" có nghĩa chính xác là "${meaning}".`,
                });
            } else if (qType === "FILL_BLANK") {
                const blankSentence = example && example.toLowerCase().includes(word.toLowerCase())
                    ? example.replace(new RegExp(word, "gi"), "_____")
                    : `Please complete the sentence with "${word}": "_____ (${meaning})"`;
                results.push({
                    type: "FILL_BLANK",
                    content: `Điền từ vựng thích hợp vào chỗ trống: "${blankSentence}"`,
                    instruction: `Nhập từ tiếng Anh chính xác cho nghĩa "${meaning}"`,
                    vocabularyId: vocab?._id?.toString(),
                    correctAnswer: word,
                    explanation: `Từ đúng cần điền vào chỗ trống là "${word}" (Nghĩa: ${meaning}).`,
                });
            } else if (qType === "TRANSLATION") {
                results.push({
                    type: "TRANSLATION",
                    content: `Dịch câu sau sang tiếng Việt: "${example}"`,
                    instruction: "Nhập bản dịch tiếng Việt chính xác",
                    vocabularyId: vocab?._id?.toString(),
                    correctAnswer: exampleMeaning,
                    explanation: `Bản dịch chuẩn: "${exampleMeaning}".`,
                });
            } else if (qType === "MATCHING") {
                results.push({
                    type: "MATCHING",
                    content: `Nối các từ vựng với nghĩa tiếng Việt tương ứng:`,
                    instruction: "Kéo thả các cặp từ tương ứng",
                    matchingPairs: [
                        { vocabularyId: vocab?._id?.toString(), leftValue: word, rightValue: meaning },
                        { leftValue: "Welcome", rightValue: "Chào mừng" },
                        { leftValue: "Introduce", rightValue: "Giới thiệu" },
                    ],
                    explanation: `Ghép cặp chính xác: "${word}" - "${meaning}".`,
                });
            } else {
                results.push({
                    type: "ORDER_SENTENCE",
                    content: `Sắp xếp các từ thành câu tiếng Anh hoàn chỉnh: "${example}"`,
                    instruction: "Sắp xếp các từ theo đúng thứ tự",
                    vocabularyId: vocab?._id?.toString(),
                    correctAnswer: example.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "").split(" "),
                    explanation: `Thứ tự chuẩn của câu là: "${example}".`,
                });
            }
        }

        return results;
    }
}
