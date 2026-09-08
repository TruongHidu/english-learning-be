/**
 * Calculates the exact UTC instant range [monthStartUtc, nextMonthStartUtc)
 * for the calendar month of a reference date in Asia/Ho_Chi_Minh timezone (UTC+7).
 * Completely independent of Node process's local timezone.
 */
export function getVietnamMonthRangeUtc(referenceDate: Date = new Date()): {
    monthStartUtc: Date;
    nextMonthStartUtc: Date;
} {
    const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Ho_Chi_Minh",
        calendar: "gregory",
        year: "numeric",
        month: "numeric",
    });
    const parts = formatter.formatToParts(referenceDate);
    const year = Number(parts.find((p) => p.type === "year")!.value);
    const month = Number(parts.find((p) => p.type === "month")!.value); // 1 - 12

    // Vietnam is fixed UTC+7 all year (no DST).
    // Start of current month in VN: YYYY-MM-01 00:00:00.000 +07:00
    // In UTC, this is Date.UTC(year, month - 1, 1, 0, 0, 0, 0) - 7 * 60 * 60 * 1000
    const monthStartUtc = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0) - 7 * 60 * 60 * 1000);

    const nextYear = month === 12 ? year + 1 : year;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextMonthStartUtc = new Date(Date.UTC(nextYear, nextMonth - 1, 1, 0, 0, 0, 0) - 7 * 60 * 60 * 1000);

    return { monthStartUtc, nextMonthStartUtc };
}
