import type { QuestionDocument } from "../models/question.model.js";
import type {
    MatchingPairResponse,
    QuestionListItemResponse,
    QuestionOptionResponse,
    QuestionResponse,
} from "../types/question.types.js";

export const mapQuestionToResponse = (doc: QuestionDocument): QuestionResponse => {
    const options: QuestionOptionResponse[] | null = doc.options
        ? doc.options.map((opt) => ({
              id: (opt as unknown as { _id?: { toString(): string } })._id?.toString(),
              content: opt.content,
              imageUrl: opt.imageUrl ?? null,
              isCorrect: opt.isCorrect,
              orderIndex: opt.orderIndex,
          }))
        : null;

    const matchingPairs: MatchingPairResponse[] | null = doc.matchingPairs
        ? doc.matchingPairs.map((pair) => ({
              id: (pair as unknown as { _id?: { toString(): string } })._id?.toString(),
              vocabularyId: pair.vocabularyId ? pair.vocabularyId.toString() : null,
              leftValue: pair.leftValue,
              rightValue: pair.rightValue,
              orderIndex: pair.orderIndex,
          }))
        : null;

    return {
        id: doc._id.toString(),
        vocabularyId: doc.vocabularyId ? doc.vocabularyId.toString() : null,
        type: doc.type,
        content: doc.content,
        instruction: doc.instruction ?? null,
        correctAnswer: doc.correctAnswer ?? null,
        options,
        matchingPairs,
        explanation: doc.explanation ?? null,
        difficulty: doc.difficulty,
        audioUrl: doc.audioUrl ?? null,
        imageUrl: doc.imageUrl ?? null,
        status: doc.status,
        createdByAi: doc.createdByAi,
        aiGenerationId: doc.aiGenerationId ? doc.aiGenerationId.toString() : null,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
    };
};

export const mapQuestionToListItemResponse = (doc: QuestionDocument): QuestionListItemResponse => {
    return {
        id: doc._id.toString(),
        vocabularyId: doc.vocabularyId ? doc.vocabularyId.toString() : null,
        type: doc.type,
        content: doc.content,
        difficulty: doc.difficulty,
        status: doc.status,
        createdByAi: doc.createdByAi,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
    };
};
