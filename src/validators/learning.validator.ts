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
