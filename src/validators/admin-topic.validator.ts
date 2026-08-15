import { z } from "zod";
import { TOPIC_STATUSES } from "../types/topic.types.js";

const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

export const sectionIdParamSchema = z.object({
    sectionId: z
        .string({ error: "ID phần học là bắt buộc" })
        .regex(OBJECT_ID_REGEX, "ID phần học không hợp lệ"),
});

export const topicIdParamSchema = z.object({
    topicId: z
        .string({ error: "ID chủ đề là bắt buộc" })
        .regex(OBJECT_ID_REGEX, "ID chủ đề không hợp lệ"),
});

export const createTopicSchema = z.object({
    name: z
        .string({ error: "Tên chủ đề là bắt buộc" })
        .trim()
        .min(2, "Tên chủ đề phải có ít nhất 2 ký tự")
        .max(100, "Tên chủ đề không được vượt quá 100 ký tự"),
    description: z
        .string()
        .trim()
        .max(1000, "Mô tả không được vượt quá 1000 ký tự")
        .optional(),
    orderIndex: z
        .number()
        .int("Thứ tự sắp xếp phải là số nguyên")
        .min(0, "Thứ tự sắp xếp phải lớn hơn hoặc bằng 0")
        .optional(),
    status: z.enum(TOPIC_STATUSES).optional(),
});

export const updateTopicSchema = z.object({
    name: z
        .string()
        .trim()
        .min(2, "Tên chủ đề phải có ít nhất 2 ký tự")
        .max(100, "Tên chủ đề không được vượt quá 100 ký tự")
        .optional(),
    description: z
        .string()
        .trim()
        .max(1000, "Mô tả không được vượt quá 1000 ký tự")
        .optional(),
});

export const updateTopicStatusSchema = z.object({
    status: z.enum(TOPIC_STATUSES, {
        error: "Trạng thái không hợp lệ. Chấp nhận: DRAFT, PUBLISHED, INACTIVE",
    }),
});

export const reorderTopicsSchema = z.object({
    topicIds: z
        .array(z.string().regex(OBJECT_ID_REGEX, "ID chủ đề không hợp lệ"))
        .min(1, "Danh sách ID chủ đề không được trống"),
});
