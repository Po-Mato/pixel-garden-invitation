import type { WeddingEvent } from "@wedding-game/shared";
import {
  defaultCoupleDisplayOrder,
  formatCoupleNames,
  formatWeddingTitle,
  type CoupleDisplayOrder
} from "./coupleOrder";

const encoder = new TextEncoder();

function eventDate(value: string): Date {
  return new Date(value);
}

function utcStamp(value: Date): string {
  return value.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function formatTime(value: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hourCycle: "h12"
  }).formatToParts(eventDate(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";

  const dayPeriod = part("dayPeriod") === "AM" ? "오전" : part("dayPeriod") === "PM" ? "오후" : part("dayPeriod");

  return `${dayPeriod} ${part("hour")}시 ${part("minute")}분`;
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function foldIcsLine(line: string): string[] {
  const lines: string[] = [];
  let current = "";

  for (const character of line) {
    if (encoder.encode(current + character).length > 75) {
      lines.push(current);
      current = ` ${character}`;
    } else {
      current += character;
    }
  }

  lines.push(current);
  return lines;
}

function locationText(event: WeddingEvent): string {
  return `${formatVenueLabel(event)}, ${event.venue.address}`;
}

function descriptionText(event: WeddingEvent, order: CoupleDisplayOrder): string {
  return `${formatCoupleNames(event, order)}의 결혼식에 초대합니다.\n${formatEventDate(event)} ${formatEventTimeRange(event)}`;
}

export function validateWeddingEvent(event: WeddingEvent): void {
  const start = eventDate(event.startAt).getTime();
  const end = eventDate(event.endAt).getTime();

  if (!Number.isFinite(start)) throw new Error("유효한 예식 시작 시각이 필요합니다.");
  if (!Number.isFinite(end)) throw new Error("유효한 예식 종료 시각이 필요합니다.");
  if (end <= start) throw new Error("예식 종료 시각은 시작 시각보다 늦어야 합니다.");
  new Intl.DateTimeFormat("ko-KR", { timeZone: event.timeZone }).format(eventDate(event.startAt));
}

export function formatEventDate(event: WeddingEvent): string {
  validateWeddingEvent(event);
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: event.timeZone,
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long"
  }).format(eventDate(event.startAt));
}

export function formatEventStartTime(event: WeddingEvent): string {
  validateWeddingEvent(event);
  return formatTime(event.startAt, event.timeZone);
}

export function formatEventEndTime(event: WeddingEvent): string {
  validateWeddingEvent(event);
  return formatTime(event.endAt, event.timeZone);
}

export function formatEventTimeRange(event: WeddingEvent): string {
  return `${formatEventStartTime(event)} - ${formatEventEndTime(event)}`;
}

export function formatVenueLabel(event: WeddingEvent): string {
  return `${event.venue.name} ${event.venue.hall}`;
}

export function buildEventCopyText(
  event: WeddingEvent,
  order: CoupleDisplayOrder = defaultCoupleDisplayOrder
): string {
  validateWeddingEvent(event);
  return [
    formatWeddingTitle(event, order),
    `${formatEventDate(event)} ${formatEventTimeRange(event)}`,
    formatVenueLabel(event),
    event.venue.address
  ].join("\n");
}

export function buildIcs(
  event: WeddingEvent,
  generatedAt = new Date(),
  order: CoupleDisplayOrder = defaultCoupleDisplayOrder
): string {
  validateWeddingEvent(event);
  const start = utcStamp(eventDate(event.startAt));
  const rawLines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Pixel Garden Invitation//Wedding Event//KO",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${start.toLowerCase()}@pixel-garden-invitation`,
    `DTSTAMP:${utcStamp(generatedAt)}`,
    `DTSTART:${start}`,
    `DTEND:${utcStamp(eventDate(event.endAt))}`,
    `SUMMARY:${escapeIcsText(formatWeddingTitle(event, order))}`,
    `LOCATION:${escapeIcsText(locationText(event))}`,
    `DESCRIPTION:${escapeIcsText(descriptionText(event, order))}`,
    "END:VEVENT",
    "END:VCALENDAR"
  ];

  return `${rawLines.flatMap(foldIcsLine).join("\r\n")}\r\n`;
}

export function buildGoogleCalendarUrl(
  event: WeddingEvent,
  order: CoupleDisplayOrder = defaultCoupleDisplayOrder
): string {
  validateWeddingEvent(event);
  const url = new URL("https://calendar.google.com/calendar/render");
  url.searchParams.set("action", "TEMPLATE");
  url.searchParams.set("text", formatWeddingTitle(event, order));
  url.searchParams.set("dates", `${utcStamp(eventDate(event.startAt))}/${utcStamp(eventDate(event.endAt))}`);
  url.searchParams.set("details", descriptionText(event, order));
  url.searchParams.set("location", locationText(event));
  return url.toString();
}
