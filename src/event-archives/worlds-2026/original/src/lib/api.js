export const number = (v) => new Intl.NumberFormat("en-US").format(v);
export function dateTime(value) {
    return value
        ? new Intl.DateTimeFormat("zh-TW", {
            timeZone: "Asia/Taipei",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
        }).format(new Date(value))
        : "時間待公布";
}
