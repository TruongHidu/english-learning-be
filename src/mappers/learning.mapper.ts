import type { LearningSessionDocument } from "../models/learning-session.model.js";
import type { QuestionDocument } from "../models/question.model.js";
import type { LearningQuestionResponse, LearningSessionResponse } from "../types/learning.types.js";

const shuffle = <T>(items: T[]): T[] => {
    const result = [...items];
    for (let index = result.length - 1; index > 0; index -= 1) {
        const randomIndex = Math.floor(Math.random() * (index + 1));
        [result[index], result[randomIndex]] = [result[randomIndex]!, result[index]!];
    }
    return result;
};

export const mapLearningQuestionToResponse = (question: QuestionDocument): LearningQuestionResponse => ({
    id: question._id.toString(),
    type: question.type,
    content: question.content,
    instruction: question.instruction ?? null,
    options:
        question.type === "ORDER_SENTENCE"
            ? question.options && question.options.length > 0
                ? shuffle(
                      question.options.map((option) => ({
                          id: (option as unknown as { _id?: { toString(): string } })._id?.toString() ?? null,
                          content: option.content,
                          imageUrl: option.imageUrl ?? null,
                          orderIndex: option.orderIndex,
                      })),
                  )
                : question.correctAnswer
                ? shuffle(
                      String(question.correctAnswer)
                          .split(/\s+/)
                          .filter(Boolean)
                          .map((word: string, idx: number) => ({
                              id: null,
                              content: word,
                              imageUrl: null,
                              orderIndex: idx + 1,
                          })),
                  )
                : null
            : question.options
            ? question.options.map((option) => ({
                  id: (option as unknown as { _id?: { toString(): string } })._id?.toString() ?? null,
                  content: option.content,
                  imageUrl: option.imageUrl ?? null,
                  orderIndex: option.orderIndex,
              }))
            : null,
    matchingLeftItems: question.matchingPairs?.map((pair) => pair.leftValue) ?? null,
    matchingRightItems: question.matchingPairs
        ? shuffle(question.matchingPairs.map((pair) => pair.rightValue))
        : null,
    audioUrl: question.audioUrl ?? null,
    imageUrl: question.imageUrl ?? null,
    vocabularyId: question.vocabularyId?.toString() ?? null,
});

export const mapLearningSessionToResponse = (
    session: LearningSessionDocument,
): LearningSessionResponse => ({
    id: session._id.toString(),
    lessonId: session.lessonId.toString(),
    lessonVersion: session.lessonVersion ?? 1,
    status: session.status,
    heartStart: session.heartStart,
    heartRemaining: session.heartRemaining,
    requiredScore: session.requiredScore ?? 80,
    totalQuestions: session.totalQuestions,
    correctCount: session.correctCount,
    wrongCount: session.wrongCount,
    score: session.score,
    startedAt: session.startedAt,
});
