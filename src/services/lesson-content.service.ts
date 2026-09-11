import { createHash } from "node:crypto";
import { LessonModel } from "../models/lesson.model.js";
import { LessonQuestionModel } from "../models/lesson-question.model.js";
import { QuestionModel, type QuestionPersistence } from "../models/question.model.js";
import { curriculumTransaction } from "../utils/curriculum-transaction.js";

export function contentFingerprint(requiredScore: number, questions: QuestionPersistence[]): string {
    return createHash("sha256").update(JSON.stringify({ requiredScore, questions: questions.map(q => ({
        // Assignment identity/order and learner-visible/grading fields only; ignore timestamps and subdocument IDs.
        id: (q as QuestionPersistence & { _id?: unknown })._id,
        type: q.type, content: q.content, instruction: q.instruction ?? null,
        correctAnswer: q.correctAnswer ?? null, explanation: q.explanation ?? null,
        audioUrl: q.audioUrl ?? null, imageUrl: q.imageUrl ?? null,
        vocabularyId: q.vocabularyId ?? null, vocabularyIds: q.vocabularyIds ?? [],
        options: q.options?.map(o => ({ content: o.content, imageUrl: o.imageUrl ?? null, isCorrect: o.isCorrect, orderIndex: o.orderIndex })) ?? [],
        matchingPairs: q.matchingPairs?.map(p => ({ vocabularyId: p.vocabularyId ?? null, leftValue: p.leftValue, rightValue: p.rightValue, orderIndex: p.orderIndex })) ?? [],
    })) })).digest("hex");
}

export async function readLessonContent(lessonId: string) {
    const assignments = await LessonQuestionModel.find({ lessonId }).sort({ orderIndex: 1, _id: 1 }).lean();
    const questions = await QuestionModel.find({ _id: { $in: assignments.map(a => a.questionId) }, status: "PUBLISHED" }).lean();
    const byId = new Map(questions.map(q => [q._id.toString(), q]));
    return {
        assignedQuestionCount: assignments.length,
        questions: assignments.flatMap(a => { const q = byId.get(a.questionId.toString()); return q ? [q] : []; }),
    };
}

/** Batch counters for path/admin lists without loading question bodies. */
export async function readLessonCounts(lessonIds: string[]) {
    const links = await LessonQuestionModel.find({ lessonId: { $in: lessonIds } }).select("lessonId questionId").lean();
    const published = new Set((await QuestionModel.find({
        _id: { $in: links.map(link => link.questionId) }, status: "PUBLISHED",
    }).select("_id").lean()).map(question => question._id.toString()));
    const counts = new Map(lessonIds.map(id => [id, { assigned: 0, published: 0 }]));
    for (const link of links) {
        const count = counts.get(link.lessonId.toString())!;
        count.assigned += 1;
        if (published.has(link.questionId.toString())) count.published += 1;
    }
    return counts;
}

export async function changeLessonContent<T>(lessonIds: () => Promise<string[]>, work: () => Promise<T>): Promise<T> {
    return curriculumTransaction(async () => {
        const ids = [...new Set(await lessonIds())];
        const before = new Map<string, string>();
        for (const id of ids) {
            const lesson = await LessonModel.findById(id);
            if (lesson?.publishedContentFingerprint) {
                before.set(id, lesson.publishedContentFingerprint);
            } else if (lesson?.status === "PUBLISHED") {
                before.set(id, contentFingerprint(lesson.requiredScore, (await readLessonContent(id)).questions));
            }
        }
        const result = await work();
        for (const id of ids) {
            const lesson = await LessonModel.findById(id);
            if (!lesson) continue;
            const content = await readLessonContent(id);
            const fingerprint = contentFingerprint(lesson.requiredScore, content.questions);
            const changed = lesson.status === "PUBLISHED" && before.has(id) && before.get(id) !== fingerprint;
            await LessonModel.updateOne({ _id: id }, {
                $set: { questionCount: content.assignedQuestionCount, publishedQuestionCount: content.questions.length,
                    ...(lesson.status === "PUBLISHED" ? { publishedContentFingerprint: fingerprint }
                        : before.has(id) ? { publishedContentFingerprint: before.get(id) } : {}),
                },
                ...(changed ? { $inc: { publishedVersion: 1 } } : {}),
            });
        }
        return result;
    });
}

export async function lessonsUsingQuestions(questionIds: string[]): Promise<string[]> {
    const links = await LessonQuestionModel.find({ questionId: { $in: questionIds } }).select("lessonId").lean();
    return links.map(link => link.lessonId.toString());
}
