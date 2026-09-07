export function resolveStreakTimezone(value?: string): string {
    const timezone = value?.trim() || "Asia/Ho_Chi_Minh";
    try {
        new Intl.DateTimeFormat("en", { timeZone: timezone }).format(0);
    } catch {
        throw new Error(`Invalid STREAK_TIMEZONE: ${timezone}`);
    }
    return timezone;
}

export const STREAK_TIMEZONE = resolveStreakTimezone(process.env.STREAK_TIMEZONE);
