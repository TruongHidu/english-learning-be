import { z } from "zod";
import { LESSON_STATUSES } from "../types/lesson.types.js";

const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

export const topicIdParamSchema = z.object({
    topicId: z
        .string({ error: "ID chủ đề là bắt buộc" })
        .regex(OBJECT_ID_REGEX, "ID chủ đề không hợp lệ"),
});

export const lessonIdParamSchema = z.object({
    lessonId: z
        .string({ error: "ID màn học là bắt buộc" })
        .regex(OBJECT_ID_REGEX, "ID màn học không hợp lệ"),
});

export const createLessonSchema = z.object({
    name: z
        .string({ error: "Tên màn học là bắt buộc" })
        .trim()
        .min(2, "Tên màn học phải có ít nhất 2 ký tự")
        .max(100, "Tên màn học không được vượt quá 100 ký tự"),
    description: z
        .string()
        .trim()
        .max(1000, "Mô tả không được vượt quá 1000 ký tự")
        .optional(),
    requiredScore: z
        .number()
        .int("Điểm yêu cầu phải là số nguyên")
        .min(0, "Điểm yêu cầu không được âm")
        .max(100, "Điểm yêu cầu tối đa là 100")
        .optional(),
    questionCount: z
        .number()
        .int("Số câu hỏi phải là số nguyên")
        .min(1, "Phải có ít nhất 1 câu hỏi")
        .max(100, "Tối đa 100 câu hỏi")
        .optional(),
    xpReward: z
        .number()
        .int("XP thưởng phải là số nguyên")
        .min(0, "XP thưởng không được âm")
        .optional(),
    diamondReward: z
        .number()
        .int("Kim cương thưởng phải là số nguyên")
        .min(0, "Kim cương thưởng không được âm")
        .optional(),
    orderIndex: z
        .number()
        .int("Thứ tự sắp xếp phải là số nguyên")
        .min(0, "Thứ tự sắp xếp phải lớn hơn hoặc bằng 0")
        .optional(),
    status: z.enum(LESSON_STATUSES).optional(),
});

export const updateLessonSchema = z.object({
    name: z
        .string()
        .trim()
        .min(2, "Tên màn học phải có ít nhất 2 ký tự")
        .max(100, "Tên màn học không được vượt quá 100 ký tự")
        .optional(),
    description: z
        .string()
        .trim()
        .max(1000, "Mô tả không được vượt quá 1000 ký tự")
        .optional(),
    requiredScore: z
        .number()
        .int("Điểm yêu cầu phải là số nguyên")
        .min(0, "Điểm yêu cầu không được âm")
        .max(100, "Điểm yêu cầu tối đa là 100")
        .optional(),
    questionCount: z
        .number()
        .int("Số câu hỏi phải là số nguyên")
        .min(1, "Phải có ít nhất 1 câu hỏi")
        .max(100, "Tối đa 100 câu hỏi")
        .optional(),
    xpReward: z
        .number()
        .int("XP thưởng phải là số nguyên")
        .min(0, "XP thưởng không được âm")
        .optional(),
    diamondReward: z
        .number()
        .int("Kim cương thưởng phải là số nguyên")
        .min(0, "Kim cương thưởng không được âm")
        .optional(),
});

export const updateLessonStatusSchema = z.object({
    status: z.enum(LESSON_STATUSES, {
        error: "Trạng thái không hợp lệ. Chấp nhận: DRAFT, PUBLISHED, INACTIVE",
    }),
});

export const reorderLessonsSchema = z.object({
    lessonIds: z
        .array(z.string().regex(OBJECT_ID_REGEX, "ID màn học không hợp lệ"))
        .min(1, "Danh sách ID màn học không được trống"),
});
