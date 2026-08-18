import type { VocabularyDocument } from "../models/vocabulary.model.js";
import type { VocabularyResponse } from "../types/vocabulary.types.js";

export const mapVocabularyToResponse = (
    doc: VocabularyDocument,
): VocabularyResponse => {
    return {
        id: doc._id.toString(),
        topicId: doc.topicId.toString(),
        word: doc.word,
        meaning: doc.meaning,
        phonetic: doc.phonetic ?? null,
        partOfSpeech: doc.partOfSpeech ?? null,
        example: doc.example ?? null,
        exampleMeaning: doc.exampleMeaning ?? null,
        audioUrl: doc.audioUrl ?? null,
        imageUrl: doc.imageUrl ?? null,
        difficulty: doc.difficulty,
        status: doc.status,
        createdByAi: doc.createdByAi,
        aiGenerationId: doc.aiGenerationId ? doc.aiGenerationId.toString() : null,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
    };
};
