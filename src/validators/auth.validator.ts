import { z } from "zod";

const emailSchema = z
    .string({ error: "Email là bắt buộc" })
    .trim()
    .min(1, "Email là bắt buộc")
    .email("Email không đúng định dạng")
    .transform((email) => email.toLowerCase());

const passwordSchema = z
    .string({ error: "Mật khẩu là bắt buộc" })
    .min(1, "Mật khẩu là bắt buộc")
    .min(8, "Mật khẩu phải có ít nhất 8 ký tự")
    .regex(/[A-Z]/, "Mật khẩu phải có ít nhất 1 chữ hoa")
    .regex(/[a-z]/, "Mật khẩu phải có ít nhất 1 chữ thường")
    .regex(/[0-9]/, "Mật khẩu phải có ít nhất 1 chữ số");

export const registerSchema = z.object({
    email: emailSchema,
    password: passwordSchema,
    displayName: z
        .string({ error: "Tên hiển thị là bắt buộc" })
        .trim()
        .min(1, "Tên hiển thị là bắt buộc")
        .min(2, "Tên hiển thị phải có ít nhất 2 ký tự")
        .max(50, "Tên hiển thị không được vượt quá 50 ký tự"),
});

export const loginSchema = z.object({
    email: emailSchema,
    password: z.string({ error: "Mật khẩu là bắt buộc" }).min(1, "Mật khẩu là bắt buộc"),
});
