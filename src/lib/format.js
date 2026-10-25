const FALLBACK_TIME_ZONE = "UTC";

export function safeTimeZone(timeZone) {
  if (!timeZone || typeof timeZone !== "string") return FALLBACK_TIME_ZONE;
  try {
    new Intl.DateTimeFormat("en", { timeZone }).format();
    return timeZone;
  } catch {
    return FALLBACK_TIME_ZONE;
  }
}

function toDate(timestamp) {
  if (timestamp == null) return null;
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatLocalDate(timestamp, timeZone, locale) {
  const date = toDate(timestamp);
  if (!date) return "Unavailable";
  return new Intl.DateTimeFormat(locale, {
    timeZone: safeTimeZone(timeZone),
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);
}

export function formatWeekday(timestamp, timeZone, locale) {
  const date = toDate(timestamp);
  if (!date) return "Unavailable";
  return new Intl.DateTimeFormat(locale, {
    timeZone: safeTimeZone(timeZone),
    weekday: "long",
  }).format(date);
}

export function formatWeekdayShort(timestamp, timeZone, locale) {
  const date = toDate(timestamp);
  if (!date) return "Unavailable";
  return new Intl.DateTimeFormat(locale, {
    timeZone: safeTimeZone(timeZone),
    weekday: "short",
  }).format(date);
}

export function formatMonthDay(timestamp, timeZone, locale) {
  const date = toDate(timestamp);
  if (!date) return "Unavailable";
  return new Intl.DateTimeFormat(locale, {
    timeZone: safeTimeZone(timeZone),
    month: "long",
    day: "numeric",
  }).format(date);
}

export function formatShortDate(timestamp, timeZone, locale) {
  const date = toDate(timestamp);
  if (!date) return "Unavailable";
  return new Intl.DateTimeFormat(locale, {
    timeZone: safeTimeZone(timeZone),
    month: "short",
    day: "numeric",
  }).format(date);
}

export function formatTime(timestamp, timeZone, locale) {
  const date = toDate(timestamp);
  if (!date) return "Unavailable";
  return new Intl.DateTimeFormat(locale, {
    timeZone: safeTimeZone(timeZone),
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatHour(timestamp, timeZone, locale) {
  const date = toDate(timestamp);
  if (!date) return "Unavailable";
  return new Intl.DateTimeFormat(locale, {
    timeZone: safeTimeZone(timeZone),
    hour: "numeric",
  }).format(date);
}

export function formatFullDateTime(timestamp, timeZone, locale) {
  const date = toDate(timestamp);
  if (!date) return "Unavailable";
  return new Intl.DateTimeFormat(locale, {
    timeZone: safeTimeZone(timeZone),
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

export function formatTimezoneAbbreviation(timeZone, locale) {
  try {
    const parts = new Intl.DateTimeFormat(locale, {
      timeZone: safeTimeZone(timeZone),
      timeZoneName: "short",
    }).formatToParts(new Date());
    return parts.find((part) => part.type === "timeZoneName")?.value || "";
  } catch {
    return "";
  }
}

export function localDateKey(timestamp, timeZone) {
  const date = toDate(timestamp);
  if (!date) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: safeTimeZone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function relativeUpdateLabel(updatedAt, now = Date.now()) {
  if (!updatedAt) return "Not updated";
  const elapsed = Math.max(0, now - updatedAt);
  if (elapsed < 45_000) return "Updated just now";
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 60) return `Updated ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Updated ${hours} hr${hours === 1 ? "" : "s"} ago`;
  return "Update is over a day old";
}

export function formatDaylightDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "Unavailable";
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!hours) return `${minutes} min`;
  return `${hours} hr ${minutes} min`;
}

export function formatNumber(value, options = {}) {
  if (!Number.isFinite(value)) return "Unavailable";
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 0,
    ...options,
  }).format(value);
}
