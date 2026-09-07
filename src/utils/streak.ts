import { STREAK_TIMEZONE } from "../config/streak.config.js";

export type StreakTransition = "FIRST_ACTIVITY" | "SAME_DAY" | "NEXT_DAY" | "BROKEN" | "FUTURE_ACTIVITY";

interface StreakState {
    currentStreak?: number;
    lastStudyDate?: Date;
}

// Compare calendar dates, not elapsed hours (also works across DST changes).
export function localDayNumber(date: Date, timezone: string = STREAK_TIMEZONE): number {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        calendar: "gregory",
        numberingSystem: "latn",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(date);
    const part = (type: string): number => Number(parts.find((p) => p.type === type)!.value);
    return Date.UTC(part("year"), part("month") - 1, part("day")) / 86_400_000;
}

export function calculateStreakTransition(
    lastStudyDate: Date | undefined,
    now: Date,
    timezone: string = STREAK_TIMEZONE,
): StreakTransition {
    if (!lastStudyDate) return "FIRST_ACTIVITY";
    // Includes older events processed after a newer event: never move the clock backwards.
    if (lastStudyDate.getTime() > now.getTime()) return "FUTURE_ACTIVITY";
    const days = localDayNumber(now, timezone) - localDayNumber(lastStudyDate, timezone);
    if (days === 0) return "SAME_DAY";
    if (days === 1) return "NEXT_DAY";
    return "BROKEN";
}

// Response-only projection: reads never reset a concurrently earned streak in storage.
export function effectiveCurrentStreak(
    stats: StreakState | undefined,
    now: Date = new Date(),
    timezone: string = STREAK_TIMEZONE,
): number {
    const transition = calculateStreakTransition(stats?.lastStudyDate, now, timezone);
    return transition === "FIRST_ACTIVITY" || transition === "BROKEN"
        ? 0
        : stats?.currentStreak ?? 0;
}
