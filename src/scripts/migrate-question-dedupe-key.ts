import "dotenv/config";
import mongoose from "mongoose";

import { QuestionModel } from "../models/question.model.js";
import { VocabularyModel } from "../models/vocabulary.model.js";
import {
    buildQuestionDedupeKey,
    normalizeQuestionContent,
} from "../utils/question-normalization.utils.js";

interface QuestionBackfill {
    questionId: mongoose.Types.ObjectId;
    topicId: mongoose.Types.ObjectId;
    normalizedContent: string;
    dedupeKey: string;
}

const run = async (): Promise<void> => {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) throw new Error("MONGODB_URI is not defined");

    await mongoose.connect(mongoUri, { autoIndex: false });
    const questions = await QuestionModel.find({})
        .select("topicId vocabularyId vocabularyIds matchingPairs.vocabularyId type content +dedupeKey")
        .lean()
        .exec();

    const referencedVocabularyIds = new Set<string>();
    for (const question of questions) {
        if (question.vocabularyId) referencedVocabularyIds.add(question.vocabularyId.toString());
        for (const vocabularyId of question.vocabularyIds ?? []) {
            referencedVocabularyIds.add(vocabularyId.toString());
        }
        for (const pair of question.matchingPairs ?? []) {
            if (pair.vocabularyId) referencedVocabularyIds.add(pair.vocabularyId.toString());
        }
    }

    const vocabularies = await VocabularyModel.find({
        _id: { $in: Array.from(referencedVocabularyIds) },
    })
        .select("topicId")
        .lean()
        .exec();
    const topicByVocabularyId = new Map(
        vocabularies.map((vocabulary) => [
            vocabulary._id.toString(),
            vocabulary.topicId.toString(),
        ]),
    );

    const backfills: QuestionBackfill[] = [];
    const unresolvedIds: string[] = [];
    const conflictingIds: string[] = [];
    const groups = new Map<string, string[]>();

    for (const question of questions) {
        const topicIds = new Set<string>();
        if (question.topicId) topicIds.add(question.topicId.toString());
        const vocabularyIds = [
            ...(question.vocabularyId ? [question.vocabularyId] : []),
            ...(question.vocabularyIds ?? []),
            ...(question.matchingPairs ?? [])
                .map((pair) => pair.vocabularyId)
                .filter((id): id is mongoose.Types.ObjectId => id !== undefined),
        ];
        for (const vocabularyId of vocabularyIds) {
            const topicId = topicByVocabularyId.get(vocabularyId.toString());
            if (topicId) topicIds.add(topicId);
        }

        if (topicIds.size === 0) {
            unresolvedIds.push(question._id.toString());
            continue;
        }
        if (topicIds.size > 1) {
            conflictingIds.push(question._id.toString());
            continue;
        }

        const topicId = new mongoose.Types.ObjectId(Array.from(topicIds)[0]);
        const normalizedContent = normalizeQuestionContent(question.content);
        const dedupeKey = buildQuestionDedupeKey(topicId.toString(), question.type, question.content);
        backfills.push({
            questionId: question._id,
            topicId,
            normalizedContent,
            dedupeKey,
        });
        const ids = groups.get(dedupeKey) ?? [];
        ids.push(question._id.toString());
        groups.set(dedupeKey, ids);
    }

    const duplicates = Array.from(groups.entries()).filter(([, ids]) => ids.length > 1);
    if (conflictingIds.length > 0 || duplicates.length > 0) {
        console.error("Chưa cập nhật dữ liệu vì Question cần được xử lý thủ công.");
        if (conflictingIds.length > 0) {
            console.error({ reason: "QUESTION_REFERENCES_MULTIPLE_TOPICS", questionIds: conflictingIds });
        }
        for (const [dedupeKey, questionIds] of duplicates) {
            console.error({ reason: "DUPLICATE_QUESTION", dedupeKey, questionIds });
        }
        throw new Error("QUESTION_DEDUPE_REQUIRES_MANUAL_RESOLUTION");
    }

    console.log({
        totalQuestions: questions.length,
        readyToBackfill: backfills.length,
        unresolvedWithoutTopic: unresolvedIds.length,
        unresolvedQuestionIds: unresolvedIds,
    });
    if (process.argv.includes("--check")) return;

    if (backfills.length > 0) {
        await QuestionModel.bulkWrite(
            backfills.map((item) => ({
                updateOne: {
                    filter: { _id: item.questionId },
                    update: {
                        $set: {
                            topicId: item.topicId,
                            normalizedContent: item.normalizedContent,
                            dedupeKey: item.dedupeKey,
                        },
                    },
                },
            })),
            { ordered: true },
        );
    }
    await QuestionModel.syncIndexes();
    console.log(`Đã backfill dedupe metadata cho ${backfills.length} Question và đồng bộ index.`);
};

run()
    .catch((error: unknown) => {
        console.error(error instanceof Error ? error.message : "Migration thất bại");
        process.exitCode = 1;
    })
    .finally(async () => {
        await mongoose.disconnect();
    });
