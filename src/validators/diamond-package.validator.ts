import { z } from "zod";

const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

export const diamondPackageIdParamSchema = z.object({
    packageId: z
        .string({ error: "ID gói kim cương là bắt buộc" })
        .regex(OBJECT_ID_REGEX, "ID gói kim cương không hợp lệ"),
});

export const createDiamondPackageSchema = z.object({
    name: z
        .string({ error: "Tên gói kim cương là bắt buộc" })
        .trim()
        .min(1, "Tên gói kim cương không được để trống")
        .max(100, "Tên gói không được vượt quá 100 ký tự"),
    diamondAmount: z
        .number({ error: "Số kim cương là bắt buộc" })
        .int("Số kim cương phải là số nguyên")
        .positive("Số kim cương phải lớn hơn 0"),
    bonusDiamond: z
        .number()
        .int("Kim cương thưởng phải là số nguyên")
        .min(0, "Kim cương thưởng phải lớn hơn hoặc bằng 0")
        .default(0),
    price: z
        .number({ error: "Giá gói là bắt buộc" })
        .int("Giá gói phải là số nguyên")
        .positive("Giá gói phải lớn hơn 0"),
    currency: z.literal("VND").default("VND"),
    description: z
        .string()
        .trim()
        .max(500, "Mô tả không được vượt quá 500 ký tự")
        .optional(),
    status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
    orderIndex: z
        .number()
        .int("Thứ tự sắp xếp phải là số nguyên")
        .min(0, "Thứ tự sắp xếp phải lớn hơn hoặc bằng 0")
        .default(0),
});

export const updateDiamondPackageSchema = z.object({
    name: z
        .string()
        .trim()
        .min(1, "Tên gói kim cương không được để trống")
        .max(100, "Tên gói không được vượt quá 100 ký tự")
        .optional(),
    diamondAmount: z
        .number()
        .int("Số kim cương phải là số nguyên")
        .positive("Số kim cương phải lớn hơn 0")
        .optional(),
    bonusDiamond: z
        .number()
        .int("Kim cương thưởng phải là số nguyên")
        .min(0, "Kim cương thưởng phải lớn hơn hoặc bằng 0")
        .optional(),
    price: z
        .number()
        .int("Giá gói phải là số nguyên")
        .positive("Giá gói phải lớn hơn 0")
        .optional(),
    currency: z.literal("VND").optional(),
    description: z
        .string()
        .trim()
        .max(500, "Mô tả không được vượt quá 500 ký tự")
        .optional(),
    status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
    orderIndex: z
        .number()
        .int("Thứ tự sắp xếp phải là số nguyên")
        .min(0, "Thứ tự sắp xếp phải lớn hơn hoặc bằng 0")
        .optional(),
});
