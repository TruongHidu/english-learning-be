import { z } from "zod";

const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

export const learningLessonIdParamSchema = z.object({
    lessonId: z.string({ error: "ID bài học là bắt buộc" }).regex(OBJECT_ID_REGEX, "ID bài học không hợp lệ"),
});

export const learningSectionIdParamSchema = z.object({
    sectionId: z.string({ error: "ID chương học là bắt buộc" }).regex(OBJECT_ID_REGEX, "ID chương học không hợp lệ"),
});

export const learningTopicIdParamSchema = z.object({
    topicId: z.string({ error: "ID chủ đề là bắt buộc" }).regex(OBJECT_ID_REGEX, "ID chủ đề không hợp lệ"),
});

export const learningSessionIdParamSchema = z.object({
    sessionId: z.string({ error: "ID phiên học là bắt buộc" }).regex(OBJECT_ID_REGEX, "ID phiên học không hợp lệ"),
});

export const submitAnswerBodySchema = z.object({
    questionId: z
        .string({ error: "ID câu hỏi là bắt buộc" })
        .regex(OBJECT_ID_REGEX, "ID câu hỏi không hợp lệ"),
    answer: z.union(
        [
            z.string({ error: "Đáp án không hợp lệ" }).min(1, "Đáp án không được rỗng"),
            z
                .array(z.string({ error: "Đáp án không hợp lệ" }).min(1))
                .min(1, "Đáp án không được rỗng"),
        ],
        { error: "Đáp án là bắt buộc" },
    ),
});
