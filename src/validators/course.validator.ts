import { z } from "zod";

import { COURSE_STATUSES } from "../types/course.types.js";

const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

export const courseIdParamSchema = z.object({
    courseId: z
        .string({ error: "ID khóa học là bắt buộc" })
        .regex(OBJECT_ID_REGEX, "ID khóa học không hợp lệ"),
});

const urlSchema = z
    .string()
    .trim()
    .url("Đường dẫn ảnh đại diện không đúng định dạng")
    .or(z.literal(""));

export const createCourseSchema = z.object({
    name: z
        .string({ error: "Tên khóa học là bắt buộc" })
        .trim()
        .min(1, "Tên khóa học là bắt buộc")
        .max(100, "Tên khóa học không được vượt quá 100 ký tự"),
    description: z
        .string()
        .trim()
        .max(1000, "Mô tả khóa học không được vượt quá 1000 ký tự")
        .optional(),
    level: z
        .string({ error: "Trình độ là bắt buộc" })
        .trim()
        .min(1, "Trình độ là bắt buộc")
        .max(20, "Trình độ không được vượt quá 20 ký tự"),
    thumbnailUrl: urlSchema.nullable().optional(),
    orderIndex: z
        .number({ error: "Thứ tự sắp xếp là bắt buộc" })
        .int("Thứ tự sắp xếp phải là số nguyên")
        .min(0, "Thứ tự sắp xếp phải lớn hơn hoặc bằng 0"),
    status: z.enum(COURSE_STATUSES).optional(),
});

export const updateCourseSchema = z.object({
    name: z
        .string()
        .trim()
        .min(1, "Tên khóa học không được để trống")
        .max(100, "Tên khóa học không được vượt quá 100 ký tự")
        .optional(),
    description: z
        .string()
        .trim()
        .max(1000, "Mô tả khóa học không được vượt quá 1000 ký tự")
        .optional(),
    level: z
        .string()
        .trim()
        .min(1, "Trình độ không được để trống")
        .max(20, "Trình độ không được vượt quá 20 ký tự")
        .optional(),
    thumbnailUrl: urlSchema.nullable().optional(),
    orderIndex: z
        .number()
        .int("Thứ tự sắp xếp phải là số nguyên")
        .min(0, "Thứ tự sắp xếp phải lớn hơn hoặc bằng 0")
        .optional(),
});

export const updateCourseStatusSchema = z.object({
    status: z.enum(COURSE_STATUSES, {
        error: "Trạng thái khóa học không hợp lệ. Chấp nhận: DRAFT, PUBLISHED, INACTIVE",
    }),
});

export const courseListQuerySchema = z.object({
    page: z.coerce.number().int("Số trang phải là số nguyên").min(1, "Số trang tối thiểu là 1").default(1),
    limit: z.coerce
        .number()
        .int("Số lượng bản ghi phải là số nguyên")
        .min(1, "Số lượng bản ghi tối thiểu là 1")
        .max(100, "Số lượng bản ghi tối đa là 100")
        .default(20),
    search: z.string().trim().optional(),
    status: z.enum(COURSE_STATUSES).optional(),
    level: z.string().trim().optional(),
});
