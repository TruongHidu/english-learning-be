import { z } from "zod";

const strongPasswordSchema = z
    .string({ error: "Mật khẩu mới là bắt buộc" })
    .min(1, "Mật khẩu mới là bắt buộc")
    .min(8, "Mật khẩu mới phải có ít nhất 8 ký tự")
    .regex(/[A-Z]/, "Mật khẩu mới phải có ít nhất 1 chữ hoa")
    .regex(/[a-z]/, "Mật khẩu mới phải có ít nhất 1 chữ thường")
    .regex(/[0-9]/, "Mật khẩu mới phải có ít nhất 1 chữ số");

export const updateDisplayNameSchema = z.object({
    displayName: z
        .string({ error: "Tên hiển thị là bắt buộc" })
        .trim()
        .min(1, "Tên hiển thị không được chỉ chứa khoảng trắng")
        .min(2, "Tên hiển thị phải có ít nhất 2 ký tự")
        .max(50, "Tên hiển thị không được vượt quá 50 ký tự"),
});

export const changePasswordSchema = z
    .object({
        currentPassword: z
            .string({ error: "Mật khẩu hiện tại là bắt buộc" })
            .min(1, "Mật khẩu hiện tại là bắt buộc"),
        newPassword: strongPasswordSchema,
        confirmPassword: z
            .string({ error: "Xác nhận mật khẩu là bắt buộc" })
            .min(1, "Xác nhận mật khẩu là bắt buộc"),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
        path: ["confirmPassword"],
        message: "Xác nhận mật khẩu không khớp",
    });
