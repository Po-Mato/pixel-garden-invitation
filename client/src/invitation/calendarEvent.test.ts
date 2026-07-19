import { invitationContent } from "@wedding-game/shared";
import { describe, expect, it } from "vitest";
import {
  buildEventCopyText,
  buildGoogleCalendarUrl,
  buildIcs,
  formatEventDate,
  formatEventStartTime,
  formatEventTimeRange,
  formatVenueLabel,
  validateWeddingEvent
} from "./calendarEvent";

const event = invitationContent.event;

describe("wedding calendar event", () => {
  it("formats the confirmed Korean date, time, and venue", () => {
    expect(formatEventDate(event)).toBe("2027년 5월 1일 토요일");
    expect(formatEventStartTime(event)).toBe("오후 5시 10분");
    expect(formatEventTimeRange(event)).toBe("오후 5시 10분 - 오후 6시 40분");
    expect(formatVenueLabel(event)).toBe("MJ컨벤션 5층 파티오볼룸");
  });

  it("builds a complete copyable event summary", () => {
    expect(buildEventCopyText(event)).toBe([
      "이승재 · 이건희 결혼식",
      "2027년 5월 1일 토요일 오후 5시 10분 - 오후 6시 40분",
      "MJ컨벤션 5층 파티오볼룸",
      "경기 부천시 소사구 경인로 386"
    ].join("\n"));
  });

  it("builds a UTF-8 iCalendar event with UTC timestamps and no alarm", () => {
    const ics = buildIcs(event, new Date("2026-07-20T00:00:00Z"));
    const unfolded = ics.replace(/\r\n /g, "");

    expect(ics).toContain("BEGIN:VCALENDAR\r\n");
    expect(unfolded).toContain("DTSTAMP:20260720T000000Z");
    expect(unfolded).toContain("DTSTART:20270501T081000Z");
    expect(unfolded).toContain("DTEND:20270501T094000Z");
    expect(unfolded).toContain("SUMMARY:이승재 · 이건희 결혼식");
    expect(unfolded).toContain("LOCATION:MJ컨벤션 5층 파티오볼룸\\, 경기 부천시 소사구 경인로 386");
    expect(ics).not.toContain("VALARM");
    expect(ics.endsWith("\r\n")).toBe(true);
    expect(ics.split("\r\n").every((line) => new TextEncoder().encode(line).length <= 75)).toBe(true);
  });

  it("builds a Google Calendar template URL with the same UTC interval", () => {
    const url = new URL(buildGoogleCalendarUrl(event));

    expect(url.origin + url.pathname).toBe("https://calendar.google.com/calendar/render");
    expect(url.searchParams.get("action")).toBe("TEMPLATE");
    expect(url.searchParams.get("text")).toBe(event.title);
    expect(url.searchParams.get("dates")).toBe("20270501T081000Z/20270501T094000Z");
    expect(url.searchParams.get("location")).toContain(event.venue.address);
  });

  it("rejects invalid or reversed dates", () => {
    expect(() => validateWeddingEvent({ ...event, startAt: "invalid" })).toThrow("유효한 예식 시작 시각");
    expect(() => validateWeddingEvent({ ...event, endAt: event.startAt })).toThrow("종료 시각");
  });
});
