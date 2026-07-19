# 예식 일정·장소 및 캘린더 저장 구현 계획

> **에이전트 작업자 필수 사항:** 이 계획을 작업별로 구현할 때 `superpowers:subagent-driven-development`(권장) 또는 `superpowers:executing-plans` 하위 스킬을 사용한다. 모든 단계는 체크박스로 진행 상태를 기록한다.

**목표:** 입장 화면과 초대장 메뉴에서 동일한 실제 예식 정보를 제공하고, 기본 캘린더·Google Calendar·클립보드로 정확한 90분 일정을 저장할 수 있게 한다.

**아키텍처:** `shared/src/content.ts`를 예식 정보의 단일 출처로 확장하고, 클라이언트의 순수 캘린더 포매터와 브라우저 어댑터를 분리한다. 재사용 가능한 `WeddingEventSummary`와 포털 기반 `CalendarSaveSheet`를 입장 화면과 게임 메뉴에 연결해 표시와 동작의 중복을 없앤다.

**기술 스택:** TypeScript, React 18, Vite, Vitest, Testing Library, `lucide-react`, iCalendar 2.0, Google Calendar 템플릿 URL, GitHub Pages

## 전역 제약

- 실제 작업 경로는 `/Users/sjlee/Documents/New project 5`이며 새 worktree를 만들지 않는다.
- 신랑은 `이승재`, 신부는 `이건희`, 일정 제목은 `이승재 · 이건희 결혼식`이다.
- 시작은 `2027-05-01T17:10:00+09:00`, 종료는 `2027-05-01T18:40:00+09:00`, 시간대는 `Asia/Seoul`이다.
- 장소는 `MJ컨벤션`, 홀은 `5층 파티오볼룸`, 주소는 `경기 부천시 소사구 경인로 386`이다.
- 캘린더에 `VALARM`을 넣지 않으며 사용자 캘린더 기본 알림을 따른다.
- 이번 범위에서는 지도 앱 길 찾기, Worker, 데이터베이스, RSVP, 맵·포털·이동 로직을 변경하지 않는다.
- 모든 UI 문구와 문서는 한국어로 작성하고, 기존 픽셀 웨딩 팔레트와 모바일 우선 레이아웃을 유지한다.
- 기존 미추적 하객 원본 디렉터리는 스테이징하거나 수정하지 않는다.
- 구현은 테스트 실패 확인, 최소 구현, 테스트 통과, 작업별 커밋 순서를 따른다.
- 기능 완료 후 `main`을 푸시하고 GitHub Pages 배포 성공과 운영 번들 일치를 확인한다.

---

## 파일 구조

- 수정 `shared/src/content.ts`: 구조화된 예식 정보와 실제 예식 안내 문구의 단일 출처
- 수정 `shared/src/content.test.ts`: 확정 예식 데이터와 90분 기간 계약
- 생성 `client/src/invitation/calendarEvent.ts`: 날짜 표시, 검증, `.ics`, Google URL, 복사 문구 생성
- 생성 `client/src/invitation/calendarEvent.test.ts`: 캘린더 포맷과 표준 형식 테스트
- 생성 `client/src/invitation/browserActions.ts`: 클립보드와 `.ics` 다운로드 브라우저 어댑터
- 생성 `client/src/invitation/browserActions.test.ts`: 성공·실패 및 객체 URL 정리 테스트
- 수정 `client/src/components/BottomSheet.tsx`: 포털 렌더링과 배경 선택 닫기
- 생성 `client/src/components/BottomSheet.test.tsx`: 포커스 트랩·복원·닫기 테스트
- 생성 `client/src/components/CalendarSaveSheet.tsx`: 세 가지 캘린더 저장 동작과 상태 표시
- 생성 `client/src/components/CalendarSaveSheet.test.tsx`: 저장 선택창 동작 테스트
- 생성 `client/src/components/WeddingEventSummary.tsx`: `compact`·`detail` 공통 예식 UI
- 생성 `client/src/components/WeddingEventSummary.test.tsx`: 두 변형과 주소 복사 테스트
- 수정 `client/src/components/EntryScreen.tsx`: 실제 이름과 입장 전 요약 통합
- 수정 `client/src/components/EntryScreen.test.tsx`: 입장 화면 데이터·선택창 회귀 테스트
- 수정 `client/src/components/GameWorld.tsx`: 초대장 메뉴 상세 요약 통합
- 수정 `client/src/components/GameWorld.test.tsx`: 메뉴 정보, 맵 입력 차단, 모달 접근성 테스트
- 수정 `client/src/styles.css`: 예식 요약과 캘린더 선택창의 반응형 스타일
- 수정 `client/src/styles.test.ts`: 안정된 모바일 크기와 포커스 스타일 계약
- 수정 `client/package.json`, `pnpm-lock.yaml`: Lucide 아이콘 의존성

---

### 작업 1: 공통 예식 데이터 계약

**파일:**
- 수정: `shared/src/content.ts:1-72`
- 수정: `shared/src/content.test.ts:1-15`

**인터페이스:**
- 생성: `WeddingEvent` 타입
- 생성: `invitationContent.event: WeddingEvent`
- 유지: `invitationContent.spots: InvitationSpot[]`

- [ ] **1단계: 확정 데이터에 대한 실패 테스트 작성**

`shared/src/content.test.ts`에 다음 계약을 추가한다.

```ts
it("contains the confirmed wedding event", () => {
  expect(invitationContent.event).toEqual({
    couple: { groom: "이승재", bride: "이건희" },
    title: "이승재 · 이건희 결혼식",
    startAt: "2027-05-01T17:10:00+09:00",
    endAt: "2027-05-01T18:40:00+09:00",
    timeZone: "Asia/Seoul",
    venue: {
      name: "MJ컨벤션",
      hall: "5층 파티오볼룸",
      address: "경기 부천시 소사구 경인로 386"
    }
  });
});

it("defines an exact 90 minute event", () => {
  const start = new Date(invitationContent.event.startAt).getTime();
  const end = new Date(invitationContent.event.endAt).getTime();

  expect(end - start).toBe(90 * 60 * 1000);
});

it("keeps the wedding information spot consistent with the event", () => {
  const weddingInfo = invitationContent.spots.find((spot) => spot.id === "wedding-info");

  expect(weddingInfo?.body).toContain("2027년 5월 1일 토요일 오후 5시 10분");
  expect(weddingInfo?.body).toContain("MJ컨벤션 5층 파티오볼룸");
});
```

- [ ] **2단계: 공유 테스트가 실패하는지 확인**

실행:

```bash
pnpm --filter @wedding-game/shared test -- content.test.ts
```

예상: `invitationContent.event`가 없고 기존 샘플 예식 안내가 남아 있어 실패한다.

- [ ] **3단계: 구조화된 타입과 실제 데이터 구현**

`shared/src/content.ts`에 타입을 추가한다.

```ts
export type WeddingEvent = {
  couple: {
    groom: string;
    bride: string;
  };
  title: string;
  startAt: string;
  endAt: string;
  timeZone: string;
  venue: {
    name: string;
    hall: string;
    address: string;
  };
};
```

기존 `coupleNames`, `weddingDate`, `weddingTime`, `venueName`, `venueAddress`를 제거하고 다음 `event`로 교체한다.

```ts
event: {
  couple: { groom: "이승재", bride: "이건희" },
  title: "이승재 · 이건희 결혼식",
  startAt: "2027-05-01T17:10:00+09:00",
  endAt: "2027-05-01T18:40:00+09:00",
  timeZone: "Asia/Seoul",
  venue: {
    name: "MJ컨벤션",
    hall: "5층 파티오볼룸",
    address: "경기 부천시 소사구 경인로 386"
  }
} satisfies WeddingEvent,
```

`wedding-info` 본문을 다음 문장으로 교체한다.

```ts
body: "2027년 5월 1일 토요일 오후 5시 10분, MJ컨벤션 5층 파티오볼룸에서 예식이 진행됩니다."
```

`directions` 본문에서 기존 라온가든·역삼역 정보를 제거하고 확정 주소까지만 제공한다.

```ts
body: "MJ컨벤션은 경기 부천시 소사구 경인로 386에 있습니다."
```

- [ ] **4단계: 공유 테스트와 타입 검사 통과 확인**

실행:

```bash
pnpm --filter @wedding-game/shared test -- content.test.ts
pnpm --filter @wedding-game/shared typecheck
```

예상: 모든 테스트와 타입 검사가 통과한다.

- [ ] **5단계: 공통 데이터 커밋**

```bash
git add shared/src/content.ts shared/src/content.test.ts
git commit -m "feat: add confirmed wedding event data"
```

---

### 작업 2: 캘린더 포맷터와 표준 파일 생성

**파일:**
- 생성: `client/src/invitation/calendarEvent.ts`
- 생성: `client/src/invitation/calendarEvent.test.ts`

**인터페이스:**
- 소비: `WeddingEvent`
- 생성: `validateWeddingEvent(event): void`
- 생성: `formatEventDate(event): string`
- 생성: `formatEventStartTime(event): string`
- 생성: `formatEventTimeRange(event): string`
- 생성: `formatVenueLabel(event): string`
- 생성: `buildEventCopyText(event): string`
- 생성: `buildIcs(event, generatedAt?): string`
- 생성: `buildGoogleCalendarUrl(event): string`

- [ ] **1단계: 날짜·ICS·Google URL 실패 테스트 작성**

`client/src/invitation/calendarEvent.test.ts`를 다음 핵심 사례로 작성한다.

```ts
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
```

- [ ] **2단계: 새 테스트가 모듈 부재로 실패하는지 확인**

실행:

```bash
pnpm --filter @wedding-game/client test -- calendarEvent.test.ts
```

예상: `./calendarEvent` 모듈을 찾지 못해 실패한다.

- [ ] **3단계: 순수 캘린더 유틸리티 구현**

`client/src/invitation/calendarEvent.ts`에 다음 구조를 구현한다.

```ts
import type { WeddingEvent } from "@wedding-game/shared";

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

  return `${part("dayPeriod")} ${part("hour")}시 ${part("minute")}분`;
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

function descriptionText(event: WeddingEvent): string {
  return `${event.couple.groom} · ${event.couple.bride}의 결혼식에 초대합니다.\n${formatEventDate(event)} ${formatEventTimeRange(event)}`;
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

export function formatEventTimeRange(event: WeddingEvent): string {
  validateWeddingEvent(event);
  return `${formatTime(event.startAt, event.timeZone)} - ${formatTime(event.endAt, event.timeZone)}`;
}

export function formatVenueLabel(event: WeddingEvent): string {
  return `${event.venue.name} ${event.venue.hall}`;
}

export function buildEventCopyText(event: WeddingEvent): string {
  validateWeddingEvent(event);
  return [
    event.title,
    `${formatEventDate(event)} ${formatEventTimeRange(event)}`,
    formatVenueLabel(event),
    event.venue.address
  ].join("\n");
}

export function buildIcs(event: WeddingEvent, generatedAt = new Date()): string {
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
    `SUMMARY:${escapeIcsText(event.title)}`,
    `LOCATION:${escapeIcsText(locationText(event))}`,
    `DESCRIPTION:${escapeIcsText(descriptionText(event))}`,
    "END:VEVENT",
    "END:VCALENDAR"
  ];

  return `${rawLines.flatMap(foldIcsLine).join("\r\n")}\r\n`;
}

export function buildGoogleCalendarUrl(event: WeddingEvent): string {
  validateWeddingEvent(event);
  const url = new URL("https://calendar.google.com/calendar/render");
  url.searchParams.set("action", "TEMPLATE");
  url.searchParams.set("text", event.title);
  url.searchParams.set("dates", `${utcStamp(eventDate(event.startAt))}/${utcStamp(eventDate(event.endAt))}`);
  url.searchParams.set("details", descriptionText(event));
  url.searchParams.set("location", locationText(event));
  return url.toString();
}
```

- [ ] **4단계: 캘린더 유틸리티 테스트 통과 확인**

실행:

```bash
pnpm --filter @wedding-game/client test -- calendarEvent.test.ts
```

예상: 날짜, 90분 UTC 구간, 75바이트 줄 접기, Google URL, 유효성 검사가 모두 통과한다.

- [ ] **5단계: 캘린더 유틸리티 커밋**

```bash
git add client/src/invitation/calendarEvent.ts client/src/invitation/calendarEvent.test.ts
git commit -m "feat: generate wedding calendar events"
```

---

### 작업 3: 브라우저 동작과 공통 하단 선택창 접근성

**파일:**
- 생성: `client/src/invitation/browserActions.ts`
- 생성: `client/src/invitation/browserActions.test.ts`
- 수정: `client/src/components/BottomSheet.tsx:1-82`
- 생성: `client/src/components/BottomSheet.test.tsx`

**인터페이스:**
- 생성: `copyText(text, clipboard?): Promise<void>`
- 생성: `downloadIcs(ics, environment?): void`
- 변경: `BottomSheet`가 `document.body` 포털에서 렌더링되고 배경 선택으로 닫힘

- [ ] **1단계: 브라우저 어댑터 실패 테스트 작성**

`client/src/invitation/browserActions.test.ts`에 다음 테스트를 작성한다.

```ts
import { describe, expect, it, vi } from "vitest";
import { copyText, downloadIcs } from "./browserActions";

describe("wedding browser actions", () => {
  it("writes exact text to the supplied clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);

    await copyText("예식 일정", { writeText });

    expect(writeText).toHaveBeenCalledWith("예식 일정");
  });

  it("surfaces clipboard failures", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));

    await expect(copyText("예식 일정", { writeText })).rejects.toThrow("denied");
  });

  it("downloads one UTF-8 calendar file and revokes its URL", () => {
    const createObjectUrl = vi.fn(() => "blob:wedding-event");
    const clickDownload = vi.fn();
    const revokeObjectUrl = vi.fn();

    downloadIcs("BEGIN:VCALENDAR\r\n", { createObjectUrl, clickDownload, revokeObjectUrl });

    expect(createObjectUrl).toHaveBeenCalledWith(expect.any(Blob));
    expect(clickDownload).toHaveBeenCalledWith("blob:wedding-event", "wedding-event.ics");
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:wedding-event");
  });
});
```

- [ ] **2단계: BottomSheet 포털·포커스 실패 테스트 작성**

`client/src/components/BottomSheet.test.tsx`에 다음 동작을 작성한다.

```tsx
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { BottomSheet } from "./BottomSheet";

afterEach(cleanup);

it("closes from Escape and backdrop and restores trigger focus", () => {
  const onClose = vi.fn();
  const trigger = document.createElement("button");
  document.body.append(trigger);
  trigger.focus();

  const { unmount } = render(
    <BottomSheet title="캘린더 저장" onClose={onClose}>
      <button type="button">기본 캘린더</button>
    </BottomSheet>
  );

  expect(screen.getByRole("button", { name: "닫기" })).toHaveFocus();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(onClose).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "캘린더 저장 닫기" }));
  expect(onClose).toHaveBeenCalledTimes(2);

  unmount();
  expect(trigger).toHaveFocus();
  trigger.remove();
});
```

- [ ] **3단계: 실패 확인**

실행:

```bash
pnpm --filter @wedding-game/client test -- browserActions.test.ts BottomSheet.test.tsx
```

예상: 브라우저 어댑터가 없고 기존 배경은 버튼이 아니어서 실패한다.

- [ ] **4단계: 브라우저 어댑터 구현**

`client/src/invitation/browserActions.ts`를 다음 인터페이스로 구현한다.

```ts
type ClipboardWriter = { writeText(text: string): Promise<void> };

export type CalendarDownloadEnvironment = {
  createObjectUrl(blob: Blob): string;
  clickDownload(url: string, filename: string): void;
  revokeObjectUrl(url: string): void;
};

const browserDownloadEnvironment: CalendarDownloadEnvironment = {
  createObjectUrl: (blob) => URL.createObjectURL(blob),
  clickDownload: (url, filename) => {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.hidden = true;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
  },
  revokeObjectUrl: (url) => URL.revokeObjectURL(url)
};

export async function copyText(
  text: string,
  clipboard: ClipboardWriter | undefined = navigator.clipboard
): Promise<void> {
  if (!clipboard) throw new Error("클립보드를 사용할 수 없습니다.");
  await clipboard.writeText(text);
}

export function downloadIcs(
  ics: string,
  environment: CalendarDownloadEnvironment = browserDownloadEnvironment
): void {
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = environment.createObjectUrl(blob);

  try {
    environment.clickDownload(url, "wedding-event.ics");
  } finally {
    environment.revokeObjectUrl(url);
  }
}
```

- [ ] **5단계: BottomSheet를 포털과 닫기 가능한 배경으로 변경**

`BottomSheet.tsx`에서 `createPortal`을 사용하고 기존 포커스 트랩은 유지한다.

```tsx
import { createPortal } from "react-dom";

// 기존 effect 아래의 반환부
return createPortal(
  <>
    <button
      type="button"
      className="sheet-backdrop"
      aria-label={`${title} 닫기`}
      onClick={onClose}
    />
    <section
      ref={dialogRef}
      className="bottom-sheet"
      role="dialog"
      aria-modal={true}
      aria-label={title}
      tabIndex={-1}
    >
      <header className="bottom-sheet__header">
        <h2>{title}</h2>
        <button ref={closeButtonRef} type="button" aria-label="닫기" onClick={onClose}>
          닫기
        </button>
      </header>
      <div className="bottom-sheet__body">{children}</div>
    </section>
  </>,
  document.body
);
```

- [ ] **6단계: 어댑터와 BottomSheet 테스트 통과 확인**

실행:

```bash
pnpm --filter @wedding-game/client test -- browserActions.test.ts BottomSheet.test.tsx GuestbookPanel.test.tsx RsvpForm.test.tsx
```

예상: 새 테스트와 기존 BottomSheet 소비자 테스트가 모두 통과한다.

- [ ] **7단계: 브라우저 기반 동작 커밋**

```bash
git add client/src/invitation/browserActions.ts client/src/invitation/browserActions.test.ts client/src/components/BottomSheet.tsx client/src/components/BottomSheet.test.tsx
git commit -m "feat: add accessible calendar browser actions"
```

---

### 작업 4: 재사용 예식 요약과 캘린더 선택창

**파일:**
- 수정: `client/package.json`
- 수정: `pnpm-lock.yaml`
- 생성: `client/src/components/CalendarSaveSheet.tsx`
- 생성: `client/src/components/CalendarSaveSheet.test.tsx`
- 생성: `client/src/components/WeddingEventSummary.tsx`
- 생성: `client/src/components/WeddingEventSummary.test.tsx`

**인터페이스:**
- 생성: `CalendarSaveSheet({ onClose }): JSX.Element`
- 생성: `WeddingEventSummary({ variant, onCalendarSheetOpenChange? }): JSX.Element`
- `variant`는 `"compact" | "detail"`
- 캘린더 선택창은 포털이므로 게임 메뉴 밖 `document.body`에 렌더링됨

- [ ] **1단계: Lucide 아이콘 의존성 추가**

실행:

```bash
pnpm --filter @wedding-game/client add lucide-react
```

예상: `client/package.json`과 `pnpm-lock.yaml`에 `lucide-react`가 기록된다.

- [ ] **2단계: CalendarSaveSheet 실패 테스트 작성**

`client/src/components/CalendarSaveSheet.test.tsx`에서 브라우저 어댑터를 모킹하고 다음을 검증한다.

```tsx
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { copyText, downloadIcs } from "../invitation/browserActions";
import { CalendarSaveSheet } from "./CalendarSaveSheet";

vi.mock("../invitation/browserActions", () => ({
  copyText: vi.fn(),
  downloadIcs: vi.fn()
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("offers native calendar, Google Calendar, and event copy", async () => {
  render(<CalendarSaveSheet onClose={vi.fn()} />);

  expect(screen.getByRole("dialog", { name: "캘린더 저장" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "기본 캘린더에 저장" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Google 캘린더에서 열기" })).toHaveAttribute(
    "href",
    expect.stringContaining("calendar.google.com/calendar/render")
  );
  expect(screen.getByRole("button", { name: "일정 내용 복사" })).toBeInTheDocument();
  expect(screen.getByText(/2027년 5월 1일 토요일/)).toBeInTheDocument();
});

it("reports copy success and failure without hiding the source text", async () => {
  const mockedCopyText = vi.mocked(copyText);
  mockedCopyText.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("denied"));
  render(<CalendarSaveSheet onClose={vi.fn()} />);

  fireEvent.click(screen.getByRole("button", { name: "일정 내용 복사" }));
  expect(await screen.findByText("일정을 복사했습니다.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "일정 내용 복사" }));
  expect(await screen.findByText("복사하지 못했습니다. 내용을 길게 눌러 복사해주세요.")).toBeInTheDocument();
  expect(screen.getByText(/MJ컨벤션 5층 파티오볼룸/)).toBeInTheDocument();
});

it("downloads one calendar file and reports download failures", () => {
  const mockedDownloadIcs = vi.mocked(downloadIcs);
  mockedDownloadIcs.mockImplementationOnce(() => undefined).mockImplementationOnce(() => {
    throw new Error("blocked");
  });
  render(<CalendarSaveSheet onClose={vi.fn()} />);

  fireEvent.click(screen.getByRole("button", { name: "기본 캘린더에 저장" }));
  expect(mockedDownloadIcs).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "기본 캘린더에 저장" }));
  expect(screen.getByText("캘린더 파일을 만들지 못했습니다. 다시 시도해주세요.")).toBeInTheDocument();
  expect(screen.getByText(/경기 부천시 소사구 경인로 386/)).toBeInTheDocument();
});
```

- [ ] **3단계: WeddingEventSummary 실패 테스트 작성**

`client/src/components/WeddingEventSummary.test.tsx`에 다음 import, mock과 테스트를 포함한다.

```tsx
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { copyText } from "../invitation/browserActions";
import { WeddingEventSummary } from "./WeddingEventSummary";

vi.mock("../invitation/browserActions", () => ({
  copyText: vi.fn(),
  downloadIcs: vi.fn()
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("renders a compact entry summary", () => {
  render(<WeddingEventSummary variant="compact" />);

  expect(screen.getByText("2027년 5월 1일 토요일")).toBeInTheDocument();
  expect(screen.getByText("오후 5시 10분")).toBeInTheDocument();
  expect(screen.getByText("MJ컨벤션 5층 파티오볼룸")).toBeInTheDocument();
  expect(screen.queryByText("경기 부천시 소사구 경인로 386")).not.toBeInTheDocument();
});

it("renders details and reports address copy status", async () => {
  vi.mocked(copyText).mockResolvedValue(undefined);
  render(<WeddingEventSummary variant="detail" />);

  expect(screen.getByText("오후 5시 10분 - 오후 6시 40분")).toBeInTheDocument();
  expect(screen.getByText("경기 부천시 소사구 경인로 386")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "주소 복사" }));
  expect(await screen.findByText("주소를 복사했습니다.")).toBeInTheDocument();
});

it("keeps the address selectable and reports copy failure", async () => {
  vi.mocked(copyText).mockRejectedValue(new Error("denied"));
  render(<WeddingEventSummary variant="detail" />);

  fireEvent.click(screen.getByRole("button", { name: "주소 복사" }));

  expect(await screen.findByText("복사하지 못했습니다. 주소를 길게 눌러 복사해주세요.")).toBeInTheDocument();
  expect(screen.getByText("경기 부천시 소사구 경인로 386")).toBeInTheDocument();
});

it("notifies its owner while the calendar sheet is open", () => {
  const onCalendarSheetOpenChange = vi.fn();
  render(
    <WeddingEventSummary
      variant="detail"
      onCalendarSheetOpenChange={onCalendarSheetOpenChange}
    />
  );

  fireEvent.click(screen.getByRole("button", { name: "캘린더 저장" }));
  expect(onCalendarSheetOpenChange).toHaveBeenLastCalledWith(true);
  fireEvent.click(screen.getByRole("button", { name: "닫기" }));
  expect(onCalendarSheetOpenChange).toHaveBeenLastCalledWith(false);
});
```

- [ ] **4단계: 두 컴포넌트 테스트의 실패 확인**

실행:

```bash
pnpm --filter @wedding-game/client test -- CalendarSaveSheet.test.tsx WeddingEventSummary.test.tsx
```

예상: 두 컴포넌트 모듈이 없어 실패한다.

- [ ] **5단계: CalendarSaveSheet 구현**

`CalendarSaveSheet.tsx`는 `invitationContent.event`와 작업 2·3의 함수를 사용한다. import와 상태·마크업을 다음과 같이 구현한다.

```tsx
import { useState } from "react";
import { CalendarPlus, Copy, ExternalLink } from "lucide-react";
import { invitationContent } from "@wedding-game/shared";
import { buildEventCopyText, buildGoogleCalendarUrl, buildIcs } from "../invitation/calendarEvent";
import { copyText, downloadIcs } from "../invitation/browserActions";
import { BottomSheet } from "./BottomSheet";

type CalendarSaveSheetProps = { onClose: () => void };
type ActionStatus = "idle" | "downloading" | "copying" | "copied" | "copy-error" | "download-error";

export function CalendarSaveSheet({ onClose }: CalendarSaveSheetProps) {
  const event = invitationContent.event;
  const eventText = buildEventCopyText(event);
  const [status, setStatus] = useState<ActionStatus>("idle");
  const busy = status === "downloading" || status === "copying";

  const copyEvent = async () => {
    if (busy) return;
    setStatus("copying");
    try {
      await copyText(eventText);
      setStatus("copied");
    } catch {
      setStatus("copy-error");
    }
  };

  const saveNative = () => {
    if (busy) return;
    setStatus("downloading");
    try {
      downloadIcs(buildIcs(event));
      setStatus("idle");
    } catch {
      setStatus("download-error");
    }
  };

  return (
    <BottomSheet title="캘린더 저장" onClose={onClose}>
      <div className="calendar-save-options">
        <button type="button" onClick={saveNative} disabled={busy}>
          <CalendarPlus aria-hidden="true" />
          <span>기본 캘린더에 저장</span>
        </button>
        <a
          href={buildGoogleCalendarUrl(event)}
          target="_blank"
          rel="noreferrer"
          aria-label="Google 캘린더에서 열기"
        >
          <ExternalLink aria-hidden="true" />
          <span>Google 캘린더</span>
        </a>
        <button type="button" onClick={copyEvent} disabled={busy}>
          <Copy aria-hidden="true" />
          <span>일정 내용 복사</span>
        </button>
      </div>
      <p className="calendar-save-preview">{eventText}</p>
      <p className="calendar-action-status" aria-live="polite">
        {status === "copied" ? "일정을 복사했습니다." : null}
        {status === "copy-error" ? "복사하지 못했습니다. 내용을 길게 눌러 복사해주세요." : null}
        {status === "download-error" ? "캘린더 파일을 만들지 못했습니다. 다시 시도해주세요." : null}
      </p>
    </BottomSheet>
  );
}
```

- [ ] **6단계: WeddingEventSummary 구현**

`WeddingEventSummary.tsx`는 다음 import, 공개 props와 상태를 사용한다.

```tsx
import { useState } from "react";
import { CalendarDays, CalendarPlus, Copy, MapPin } from "lucide-react";
import { invitationContent } from "@wedding-game/shared";
import {
  formatEventDate,
  formatEventStartTime,
  formatEventTimeRange,
  formatVenueLabel
} from "../invitation/calendarEvent";
import { copyText } from "../invitation/browserActions";
import { CalendarSaveSheet } from "./CalendarSaveSheet";

type WeddingEventSummaryProps = {
  variant: "compact" | "detail";
  onCalendarSheetOpenChange?: (open: boolean) => void;
};

export function WeddingEventSummary({
  variant,
  onCalendarSheetOpenChange
}: WeddingEventSummaryProps) {
  const event = invitationContent.event;
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [addressStatus, setAddressStatus] = useState<"idle" | "copying" | "copied" | "error">("idle");

  const setCalendarVisibility = (open: boolean) => {
    setCalendarOpen(open);
    onCalendarSheetOpenChange?.(open);
  };

  const copyAddress = async () => {
    if (addressStatus === "copying") return;
    setAddressStatus("copying");
    try {
      await copyText(event.venue.address);
      setAddressStatus("copied");
    } catch {
      setAddressStatus("error");
    }
  };

  return (
    <section className={`wedding-event-summary wedding-event-summary--${variant}`} aria-label="예식 일정과 장소">
      <div className="wedding-event-summary__date">
        <CalendarDays aria-hidden="true" />
        <div>
          <time dateTime={event.startAt}>{formatEventDate(event)}</time>
          <strong>{variant === "detail" ? formatEventTimeRange(event) : formatEventStartTime(event)}</strong>
        </div>
      </div>
      <div className="wedding-event-summary__venue">
        <MapPin aria-hidden="true" />
        <div>
          <strong>{formatVenueLabel(event)}</strong>
          {variant === "detail" ? <span>{event.venue.address}</span> : null}
        </div>
        {variant === "detail" ? (
          <button
            type="button"
            className="icon-button"
            aria-label="주소 복사"
            disabled={addressStatus === "copying"}
            onClick={copyAddress}
          >
            <Copy aria-hidden="true" />
          </button>
        ) : null}
      </div>
      <button type="button" className="wedding-event-summary__calendar" onClick={() => setCalendarVisibility(true)}>
        <CalendarPlus aria-hidden="true" />
        캘린더 저장
      </button>
      <p className="wedding-event-summary__status" aria-live="polite">
        {addressStatus === "copied" ? "주소를 복사했습니다." : null}
        {addressStatus === "error" ? "복사하지 못했습니다. 주소를 길게 눌러 복사해주세요." : null}
      </p>
      {calendarOpen ? <CalendarSaveSheet onClose={() => setCalendarVisibility(false)} /> : null}
    </section>
  );
}
```

- [ ] **7단계: 컴포넌트 테스트 통과 확인**

실행:

```bash
pnpm --filter @wedding-game/client test -- CalendarSaveSheet.test.tsx WeddingEventSummary.test.tsx BottomSheet.test.tsx
```

예상: 세 저장 방식, 주소 복사, 성공·실패 안내, 모달 열림 상태 전달이 통과한다.

- [ ] **8단계: 재사용 UI 커밋**

```bash
git add client/package.json pnpm-lock.yaml client/src/components/CalendarSaveSheet.tsx client/src/components/CalendarSaveSheet.test.tsx client/src/components/WeddingEventSummary.tsx client/src/components/WeddingEventSummary.test.tsx
git commit -m "feat: add reusable wedding event controls"
```

---

### 작업 5: 입장 화면 요약 통합

**파일:**
- 수정: `client/src/components/EntryScreen.tsx:1-57`
- 수정: `client/src/components/EntryScreen.test.tsx:1-69`

**인터페이스:**
- 소비: `<WeddingEventSummary variant="compact" />`
- 유지: `EntryScreenProps`, `EntryProfile`, 캐릭터 선택·닉네임 제출 계약

- [ ] **1단계: 실제 입장 정보와 캘린더 진입점 실패 테스트 작성**

`EntryScreen.test.tsx`에 다음을 추가한다.

```tsx
it("shows the confirmed couple and compact wedding summary before entry", () => {
  render(<EntryScreen onEnter={vi.fn()} />);

  expect(screen.getByRole("heading", { name: "이승재 & 이건희의 정원" })).toBeInTheDocument();
  expect(screen.getByText("2027년 5월 1일 토요일")).toBeInTheDocument();
  expect(screen.getByText("오후 5시 10분")).toBeInTheDocument();
  expect(screen.getByText("MJ컨벤션 5층 파티오볼룸")).toBeInTheDocument();
});

it("opens calendar choices without requiring a nickname", () => {
  render(<EntryScreen onEnter={vi.fn()} />);

  fireEvent.click(screen.getByRole("button", { name: "캘린더 저장" }));

  expect(screen.getByRole("dialog", { name: "캘린더 저장" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "정원 입장" })).toBeDisabled();
});
```

- [ ] **2단계: 기존 샘플 이름으로 테스트가 실패하는지 확인**

실행:

```bash
pnpm --filter @wedding-game/client test -- EntryScreen.test.tsx
```

예상: 실제 이름과 예식 요약이 없어 실패한다.

- [ ] **3단계: 입장 헤더와 공통 요약 통합**

`EntryScreen.tsx`에 `WeddingEventSummary`를 import하고 헤더와 캐릭터 선택기 사이에 배치한다.

```tsx
<header className="entry-screen__header">
  <p>WEDDING GARDEN · 2027</p>
  <h1>이승재 & 이건희의 정원</h1>
  <span>정원에 입장할 하객 캐릭터를 선택해주세요.</span>
</header>
<WeddingEventSummary variant="compact" />
<CharacterCustomizer value={appearance} onChange={setAppearance} />
```

- [ ] **4단계: 입장 화면 전체 테스트 통과 확인**

실행:

```bash
pnpm --filter @wedding-game/client test -- EntryScreen.test.tsx CharacterCustomizer.test.tsx
```

예상: 실제 예식 정보와 기존 캐릭터·닉네임 동작이 모두 통과한다.

- [ ] **5단계: 입장 화면 통합 커밋**

```bash
git add client/src/components/EntryScreen.tsx client/src/components/EntryScreen.test.tsx
git commit -m "feat: show wedding event before entry"
```

---

### 작업 6: 초대장 메뉴 상세 정보 통합

**파일:**
- 수정: `client/src/components/GameWorld.tsx:1-819`
- 수정: `client/src/components/GameWorld.test.tsx`

**인터페이스:**
- 소비: `<WeddingEventSummary variant="detail" onCalendarSheetOpenChange={setCalendarSheetOpen} />`
- 생성 상태: `calendarSheetOpen: boolean`
- 유지: 여정 이동, 포털, 조이스틱, 미니맵, 기존 초대장 바로가기 동작

- [ ] **1단계: 상세 정보와 맵 입력 차단 실패 테스트 작성**

`GameWorld.test.tsx`에 다음 테스트를 추가한다.

```tsx
it("shows detailed wedding information in the invitation menu", () => {
  render(<GameWorld profile={profile} />);
  fireEvent.click(screen.getByRole("button", { name: "초대장 메뉴" }));
  const menu = screen.getByRole("dialog", { name: "초대장 바로가기" });

  expect(within(menu).getByText("오후 5시 10분 - 오후 6시 40분")).toBeInTheDocument();
  expect(within(menu).getByText("MJ컨벤션 5층 파티오볼룸")).toBeInTheDocument();
  expect(within(menu).getByText("경기 부천시 소사구 경인로 386")).toBeInTheDocument();
  expect(within(menu).getByRole("button", { name: "주소 복사" })).toBeInTheDocument();
});

it("opens calendar choices from the menu without moving the player", () => {
  render(<GameWorld profile={profile} />);
  const player = screen.getByLabelText("하객1");

  fireEvent.click(screen.getByRole("button", { name: "초대장 메뉴" }));
  const menu = screen.getByRole("dialog", { name: "초대장 바로가기" });
  fireEvent.click(within(menu).getByRole("button", { name: "캘린더 저장" }));

  expect(screen.getByRole("dialog", { name: "캘린더 저장" })).toBeInTheDocument();
  expect(menu).toHaveAttribute("aria-hidden", "true");
  expect(player).toHaveStyle({ left: "285px", top: "555px" });
});

it("closes only the calendar sheet on Escape and restores its menu trigger", () => {
  render(<GameWorld profile={profile} />);
  fireEvent.click(screen.getByRole("button", { name: "초대장 메뉴" }));
  const menu = screen.getByRole("dialog", { name: "초대장 바로가기" });
  const calendarButton = within(menu).getByRole("button", { name: "캘린더 저장" });
  fireEvent.click(calendarButton);

  fireEvent.keyDown(document, { key: "Escape" });

  expect(screen.queryByRole("dialog", { name: "캘린더 저장" })).not.toBeInTheDocument();
  expect(screen.getByRole("dialog", { name: "초대장 바로가기" })).toBeInTheDocument();
  expect(calendarButton).toHaveFocus();
});
```

- [ ] **2단계: 메뉴에 상세 요약이 없어 실패하는지 확인**

실행:

```bash
pnpm --filter @wedding-game/client test -- GameWorld.test.tsx
```

예상: 상세 일정, 주소 복사, 캘린더 저장 버튼이 없어 실패한다.

- [ ] **3단계: 메뉴에 상세 요약과 모달 가시성 상태 통합**

`GameWorld.tsx`에 import와 상태를 추가한다.

```tsx
import { WeddingEventSummary } from "./WeddingEventSummary";

const [calendarSheetOpen, setCalendarSheetOpen] = useState(false);
```

포털 이동 시작 시 열린 캘린더 선택창도 닫히도록 `beginPortalTransition`의 상태 정리에 다음 호출을 추가한다.

```ts
setCalendarSheetOpen(false);
```

메뉴 시트에 상세 예식 정보를 바로가기 그리드보다 먼저 배치하고, 포털 선택창이 열리면 아래 메뉴를 접근성 트리에서 숨긴다.

```tsx
<section
  className="world-menu-sheet"
  role="dialog"
  aria-modal="true"
  aria-label="초대장 바로가기"
  aria-hidden={calendarSheetOpen || undefined}
>
  <header className="world-menu-sheet__header">
    <div><span>WEDDING MENU</span><h2>초대장 바로가기</h2></div>
    <button ref={menuCloseButtonRef} type="button" aria-label="초대장 메뉴 닫기" onClick={() => setMenuOpen(false)}>×</button>
  </header>
  <WeddingEventSummary
    variant="detail"
    onCalendarSheetOpenChange={setCalendarSheetOpen}
  />
  <div className="world-menu-grid">
    {invitationContent.spots.map((item) => (
      <button key={item.id} type="button" onClick={() => openSpot(item.id)}>{item.actionLabel}</button>
    ))}
  </div>
</section>
```

메뉴를 닫을 때 `calendarSheetOpen`도 `false`로 정리하는 다음 콜백을 만들고 메뉴 배경과 닫기 버튼에서 `setMenuOpen(false)` 대신 사용한다. 포털 전환은 앞에서 추가한 두 상태 초기화를 사용한다.

```ts
const closeMenu = useCallback(() => {
  setCalendarSheetOpen(false);
  setMenuOpen(false);
}, []);
```

기존 메뉴 `Escape` effect는 캘린더 선택창이 열렸을 때 아래 메뉴까지 닫지 않도록 다음과 같이 변경한다.

```ts
useEffect(() => {
  if (!menuOpen) return;
  menuCloseButtonRef.current?.focus();
  const handleEscape = (event: KeyboardEvent) => {
    if (event.key === "Escape" && !calendarSheetOpen) closeMenu();
  };
  document.addEventListener("keydown", handleEscape);
  return () => document.removeEventListener("keydown", handleEscape);
}, [calendarSheetOpen, closeMenu, menuOpen]);
```

- [ ] **4단계: 게임 메뉴와 이동 회귀 테스트 통과 확인**

실행:

```bash
pnpm --filter @wedding-game/client test -- GameWorld.test.tsx WeddingEventSummary.test.tsx CalendarSaveSheet.test.tsx
```

예상: 메뉴 상세 정보와 캘린더 선택창이 통과하고 기존 맵 입력·포털·여정 테스트도 유지된다.

- [ ] **5단계: 초대장 메뉴 통합 커밋**

```bash
git add client/src/components/GameWorld.tsx client/src/components/GameWorld.test.tsx
git commit -m "feat: add wedding details to invitation menu"
```

---

### 작업 7: 반응형 스타일, 전체 검증 및 배포

**파일:**
- 수정: `client/src/styles.css`
- 수정: `client/src/styles.test.ts`

**인터페이스:**
- 생성 CSS: `.wedding-event-summary`, `--compact`, `--detail`, 날짜·장소·상태·버튼 하위 클래스
- 생성 CSS: `.calendar-save-options`, `.calendar-save-preview`, `.calendar-action-status`, `.icon-button`
- 유지 CSS: 입장 화면 고정 뷰포트, 게임 맵 가용 높이, 기존 BottomSheet 스크롤

- [ ] **1단계: 반응형 레이아웃 실패 테스트 작성**

`styles.test.ts`에 다음 계약을 추가한다.

```ts
describe("wedding event access", () => {
  it("keeps the compact event summary stable and readable", () => {
    const rule = styles.match(/\.wedding-event-summary--compact\s*\{([^}]*)}/s)?.[1] ?? "";

    expect(rule).toContain("min-width: 0;");
    expect(styles).toMatch(/\.wedding-event-summary__venue\s*\{[^}]*grid-template-columns:/s);
    expect(styles).toMatch(/\.wedding-event-summary__calendar:focus-visible\s*\{/s);
  });

  it("uses fixed-size icons and non-overlapping calendar actions", () => {
    expect(styles).toMatch(/\.wedding-event-summary svg,\s*\.calendar-save-options svg\s*\{[^}]*width:\s*18px;[^}]*height:\s*18px;/s);
    expect(styles).toMatch(/\.calendar-save-options\s*\{[^}]*display:\s*grid;/s);
    expect(styles).toMatch(/\.calendar-save-options > (?:button|a)[^{]*\{[^}]*min-height:\s*48px;/s);
    expect(styles).toMatch(/\.sheet-backdrop\s*\{[^}]*z-index:\s*40;/s);
    expect(styles).toMatch(/\.bottom-sheet\s*\{[^}]*z-index:\s*41;/s);
  });

  it("adapts event content for short entry viewports", () => {
    expect(styles).toMatch(/@media \(max-height:\s*640px\)[\s\S]*\.wedding-event-summary--compact/);
  });
});
```

- [ ] **2단계: 새 스타일 계약이 실패하는지 확인**

실행:

```bash
pnpm --filter @wedding-game/client test -- styles.test.ts
```

예상: 예식 요약과 캘린더 선택창 클래스가 없어 실패한다.

- [ ] **3단계: 예식 요약과 선택창 스타일 구현**

`styles.css`에서 기존 팔레트 변수를 사용해 다음 기준을 구현한다.

```css
.entry-screen {
  grid-template-rows: auto auto minmax(0, 1fr) auto;
}

.wedding-event-summary {
  position: relative;
  z-index: 3;
  display: grid;
  min-width: 0;
  color: var(--ink);
}

.wedding-event-summary--compact {
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-rows: auto auto;
  gap: 6px 10px;
  min-width: 0;
  padding: 8px 10px;
  border-block: 1px solid rgba(86, 133, 117, 0.45);
  background: rgba(255, 253, 248, 0.9);
}

.wedding-event-summary--compact .wedding-event-summary__date {
  grid-column: 1;
  grid-row: 1;
}

.wedding-event-summary--compact .wedding-event-summary__venue {
  grid-column: 1;
  grid-row: 2;
}

.wedding-event-summary--compact .wedding-event-summary__calendar {
  grid-column: 2;
  grid-row: 1 / 3;
  min-width: 116px;
  align-self: stretch;
}

.wedding-event-summary--detail {
  gap: 10px;
  padding: 12px 16px;
  border-block: 1px solid var(--gold-soft);
  background: var(--paper-raised);
}

.wedding-event-summary__date,
.wedding-event-summary__venue {
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.wedding-event-summary__date div,
.wedding-event-summary__venue div {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.wedding-event-summary__date time,
.wedding-event-summary__venue span,
.wedding-event-summary__date strong,
.wedding-event-summary__venue strong {
  overflow-wrap: anywhere;
  letter-spacing: 0;
}

.wedding-event-summary--detail .wedding-event-summary__venue span {
  user-select: text;
}

.wedding-event-summary__calendar,
.calendar-save-options > button,
.calendar-save-options > a {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 48px;
  border: 2px solid var(--ink);
  background: var(--paper-raised);
  color: var(--ink);
  text-decoration: none;
}

.wedding-event-summary svg,
.calendar-save-options svg {
  width: 18px;
  height: 18px;
  flex: 0 0 18px;
}

.icon-button {
  display: inline-grid;
  width: 40px;
  height: 40px;
  place-items: center;
  border: 1px solid var(--gold);
  background: var(--paper);
  color: var(--ink);
}

.calendar-save-options {
  display: grid;
  gap: 8px;
}

.calendar-save-preview {
  margin: 12px 0 0;
  padding: 10px;
  border-left: 3px solid var(--sage);
  background: var(--paper);
  white-space: pre-line;
  user-select: text;
}

.wedding-event-summary__status,
.calendar-action-status {
  min-height: 1.4em;
  margin: 0;
  color: var(--ink-soft);
  font-size: 12px;
}

.wedding-event-summary__calendar:focus-visible,
.calendar-save-options > button:focus-visible,
.calendar-save-options > a:focus-visible,
.icon-button:focus-visible {
  outline: 3px solid var(--camellia);
  outline-offset: 2px;
}

.sheet-backdrop {
  z-index: 40;
  padding: 0;
  border: 0;
}

.bottom-sheet {
  z-index: 41;
}

@media (max-height: 640px) {
  .wedding-event-summary--compact {
    padding-block: 5px;
    font-size: 11px;
  }

  .wedding-event-summary--compact .wedding-event-summary__venue strong {
    font-size: 10px;
    line-height: 1.25;
  }
}
```

- [ ] **4단계: 스타일과 컴포넌트 테스트 통과 확인**

실행:

```bash
pnpm --filter @wedding-game/client test -- styles.test.ts EntryScreen.test.tsx GameWorld.test.tsx CalendarSaveSheet.test.tsx WeddingEventSummary.test.tsx
```

예상: 스타일 계약과 관련 컴포넌트 테스트가 모두 통과한다.

- [ ] **5단계: 전체 정적·회귀 검증**

실행:

```bash
pnpm test
pnpm typecheck
pnpm build
git diff --check
```

예상: 맵·캐릭터·shared·client·worker 전체 테스트, 타입 검사, 프로덕션 빌드와 공백 검사가 모두 통과한다.

- [ ] **6단계: 모바일 실화면 검증**

개발 서버를 빈 포트로 실행하고 운영과 동일한 모바일 흐름을 확인한다.

```bash
pnpm dev -- --host 127.0.0.1
```

`agent-browser`에서 iPhone 14 크기와 `390x640`, `430x780`, 가로 `844x390` 뷰포트를 사용해 다음을 확인한다.

- 입장 화면에서 이름, 날짜, 시간, 장소, 캐릭터 선택 첫 행, 닉네임과 입장 버튼이 겹치지 않는다.
- 짧은 세로 화면에서도 날짜, 시간, 장소, 캘린더 저장이 모두 표시된다.
- `.ics`, Google Calendar, 일정 복사 세 동작이 표시된다.
- 게임 메뉴에서 전체 주소가 잘리지 않고 스크롤로 기존 바로가기에 접근할 수 있다.
- 메뉴, 주소 복사, 캘린더 선택창을 눌러도 캐릭터가 이동하지 않는다.
- 선택창 닫기 후 포커스가 캘린더 저장 버튼으로 돌아온다.
- 브라우저 콘솔 오류가 없다.

겹침 검증은 각 뷰포트에서 `getBoundingClientRect()`를 사용해 요약, 캐릭터 선택기, 입력 컨트롤의 인접 경계가 역전되지 않는지 확인한다. 발견한 문제는 CSS와 해당 스타일 테스트를 함께 수정한 뒤 4·5단계를 다시 실행한다.

- [ ] **7단계: 스타일과 최종 보정 커밋**

```bash
git add client/src/styles.css client/src/styles.test.ts
git commit -m "style: polish wedding event access"
```

- [ ] **8단계: `main` 푸시와 GitHub Pages 배포 확인**

```bash
git push origin main
gh run list --workflow pages.yml --branch main --limit 5 --json databaseId,headSha,status,conclusion,url
head_sha=$(git rev-parse HEAD)
run_id=$(gh run list --workflow pages.yml --branch main --limit 10 --json databaseId,headSha --jq ".[] | select(.headSha == \"$head_sha\") | .databaseId" | head -n 1)
gh run watch "$run_id" --exit-status
```

배포가 끝나면 `https://po-mato.github.io/pixel-garden-invitation/`의 HTML이 Actions 로그의 `index-*.js`와 `index-*.css`를 참조하는지 확인한다. 운영 모바일 화면에서도 입장 요약, 초대장 메뉴 상세, 세 가지 캘린더 선택, 주소 복사를 다시 검증하고 HTTP 200과 브라우저 오류 없음까지 확인한다.

---

## 완료 체크

- [ ] 공통 예식 데이터가 확정 정보와 일치한다.
- [ ] `.ics`와 Google Calendar가 `2027-05-01 17:10-18:40 Asia/Seoul`을 같은 순간으로 표현한다.
- [ ] 입장 화면과 초대장 메뉴가 같은 재사용 컴포넌트를 사용한다.
- [ ] 주소와 일정 복사의 성공·실패 상태가 노출된다.
- [ ] 모달 포커스, 배경 닫기, 맵 입력 차단이 동작한다.
- [ ] 전체 테스트, 타입 검사, 빌드, 모바일 실화면 검증이 통과한다.
- [ ] 작업별 커밋을 푸시하고 GitHub Pages 운영본이 최신 번들과 일치한다.
