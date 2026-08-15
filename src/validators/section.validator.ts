import { z } from "zod";

import { SECTION_STATUSES } from "../types/section.types.js";

const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

export const sectionIdParamSchema = z.object({
    sectionId: z
        .string({ error: "ID phần học là bắt buộc" })
        .regex(OBJECT_ID_REGEX, "ID phần học không hợp lệ"),
});

export const createSectionSchema = z.object({
    name: z
        .string({ error: "Tên phần học là bắt buộc" })
        .trim()
        .min(1, "Tên phần học là bắt buộc")
        .max(100, "Tên phần học không được vượt quá 100 ký tự"),
    description: z
        .string()
        .trim()
        .max(1000, "Mô tả phần học không được vượt quá 1000 ký tự")
        .optional(),
    orderIndex: z
        .number({ error: "Thứ tự sắp xếp là bắt buộc" })
        .int("Thứ tự sắp xếp phải là số nguyên")
        .min(0, "Thứ tự sắp xếp phải lớn hơn hoặc bằng 0"),
    status: z.enum(SECTION_STATUSES).optional(),
});

export const updateSectionSchema = z.object({
    name: z
        .string()
        .trim()
        .min(1, "Tên phần học không được để trống")
        .max(100, "Tên phần học không được vượt quá 100 ký tự")
        .optional(),
    description: z
        .string()
        .trim()
        .max(1000, "Mô tả phần học không được vượt quá 1000 ký tự")
        .optional(),
    orderIndex: z
        .number()
        .int("Thứ tự sắp xếp phải là số nguyên")
        .min(0, "Thứ tự sắp xếp phải lớn hơn hoặc bằng 0")
        .optional(),
});

export const updateSectionStatusSchema = z.object({
    status: z.enum(SECTION_STATUSES, {
        error: "Trạng thái phần học không hợp lệ. Chấp nhận: DRAFT, PUBLISHED, INACTIVE",
    }),
});

export const sectionListQuerySchema = z.object({
    status: z.enum(SECTION_STATUSES).optional(),
});
