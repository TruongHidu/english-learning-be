import "dotenv/config";
import mongoose from "mongoose";

import { VocabularyModel } from "../models/vocabulary.model.js";
import { normalizeVocabularyWord } from "../utils/vocabulary-normalization.utils.js";

const run = async (): Promise<void> => {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) throw new Error("MONGODB_URI is not defined");

    await mongoose.connect(mongoUri, { autoIndex: false });
    const vocabularies = await VocabularyModel.find({})
        .select("topicId word +normalizedWord")
        .lean()
        .exec();
    const groups = new Map<string, string[]>();

    for (const vocabulary of vocabularies) {
        const normalizedWord = normalizeVocabularyWord(vocabulary.word);
        const key = `${vocabulary.topicId.toString()}\u0000${normalizedWord}`;
        const ids = groups.get(key) ?? [];
        ids.push(vocabulary._id.toString());
        groups.set(key, ids);
    }

    const duplicates = Array.from(groups.entries()).filter(([, ids]) => ids.length > 1);
    if (duplicates.length > 0) {
        console.error("Phát hiện Vocabulary trùng trong cùng Topic. Chưa có dữ liệu nào được cập nhật.");
        for (const [key, ids] of duplicates) {
            const [topicId, normalizedWord] = key.split("\u0000");
            console.error({ topicId, normalizedWord, vocabularyIds: ids });
        }
        throw new Error("VOCABULARY_DUPLICATES_REQUIRE_MANUAL_RESOLUTION");
    }

    if (process.argv.includes("--check")) {
        console.log(`Kiểm tra hoàn tất: ${vocabularies.length} Vocabulary, không có duplicate.`);
        return;
    }

    if (vocabularies.length > 0) {
        await VocabularyModel.bulkWrite(
            vocabularies.map((vocabulary) => ({
                updateOne: {
                    filter: { _id: vocabulary._id },
                    update: {
                        $set: {
                            word: normalizeVocabularyWord(vocabulary.word),
                            normalizedWord: normalizeVocabularyWord(vocabulary.word),
                        },
                    },
                },
            })),
            { ordered: true },
        );
    }
    await VocabularyModel.syncIndexes();
    console.log(`Đã backfill normalizedWord cho ${vocabularies.length} Vocabulary và đồng bộ index.`);
};

run()
    .catch((error: unknown) => {
        console.error(error instanceof Error ? error.message : "Migration thất bại");
        process.exitCode = 1;
    })
    .finally(async () => {
        await mongoose.disconnect();
    });
