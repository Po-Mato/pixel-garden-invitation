# 오시는 길 강화 구현 계획

> **에이전트 작업자 필수 사항:** REQUIRED SUB-SKILL: 이 계획을 작업별로 구현할 때 `superpowers:subagent-driven-development`(권장) 또는 `superpowers:executing-plans` 하위 스킬을 사용한다. 모든 단계는 체크박스로 진행 상태를 기록한다.

**목표:** 입장 화면, 초대장 메뉴, 월드 장소에서 같은 오시는 길 하단 시트를 열고 지도 3종·주소 복사·교통·주차·전화 정보를 사용할 수 있게 한다.

**아키텍처:** `shared/src/content.ts`의 예식장 데이터가 모든 장소 정보의 단일 출처가 된다. 클라이언트는 순수 지도 링크 유틸리티와 재사용 가능한 `DirectionsSheet`를 분리하고, `WeddingEventSummary`와 `GameWorld`가 각 진입점의 열기 상태만 소유한다.

**기술 스택:** TypeScript, React 18, Vite, Vitest, Testing Library, `lucide-react`, HTTPS 지도 링크, GitHub Pages

## 전역 제약

- 실제 작업 경로는 `/Users/sjlee/Documents/New project 5`이며 새 worktree를 만들지 않는다.
- 장소는 `MJ컨벤션`, 홀은 `5층 파티오볼룸`, 주소는 `경기 부천시 소사구 경인로 386`이다.
- 지하철 안내는 `1호선·서해선 소사역 1번 출구에서 도보 약 3분`이다.
- 주차 안내는 `주차 2시간 무료 · 약 500대 이상 주차 가능`이다.
- 대표번호는 `032-347-5500`, 전화 링크는 대표번호에서 파생한 `tel:0323475500`이다.
- 지도 서비스는 네이버지도, 카카오맵, Google 지도 세 개다.
- 모든 화면은 `invitationContent.event.venue`의 공통 데이터를 사용하며 장소 문구를 중복 작성하지 않는다.
- 지도 링크는 HTTPS와 새 탭, 안전한 `rel` 속성을 사용한다.
- 지도 SDK·iframe, 현재 위치 권한, 버스 노선·실시간 교통, 앱 전용 스킴은 추가하지 않는다.
- 기존 픽셀 웨딩 팔레트와 모바일 우선 레이아웃을 유지한다.
- 하단 시트 입력이 캐릭터 이동, 조이스틱, 포털, 미니맵 입력으로 전달되면 안 된다.
- 기존 미추적 하객 원본 디렉터리와 수정된 `.superpowers/sdd/task-*-report.md`를 스테이징하거나 수정하지 않는다.
- 구현은 실패 테스트 확인, 최소 구현, 테스트 통과, 작업별 커밋 순서를 따른다.
- 기능 완료 후 `main`을 푸시하고 GitHub Pages 실행 성공, 운영 번들 일치, 실서비스 모바일 동작을 확인한다.

---

## 파일 구조

- 수정 `shared/src/content.ts`: 구조화된 교통·주차·전화·지도 검색 데이터
- 수정 `shared/src/content.test.ts`: 확정 장소 데이터 계약
- 생성 `client/src/invitation/directions.ts`: 지도 URL과 전화 링크 생성
- 생성 `client/src/invitation/directions.test.ts`: URL 인코딩·호스트·유효성 테스트
- 생성 `client/src/components/DirectionsSheet.tsx`: 재사용 가능한 오시는 길 하단 시트
- 생성 `client/src/components/DirectionsSheet.test.tsx`: 지도·복사·전화·닫기 동작 테스트
- 수정 `client/src/components/WeddingEventSummary.tsx`: 입장·메뉴 오시는 길 버튼과 시트 상태
- 수정 `client/src/components/WeddingEventSummary.test.tsx`: 두 변형의 오시는 길 진입 회귀
- 수정 `client/src/components/EntryScreen.test.tsx`: 입장 전 진입점 회귀
- 수정 `client/src/components/GameWorld.tsx`: 메뉴 레이어와 월드 장소 통합
- 수정 `client/src/components/GameWorld.test.tsx`: 세 진입점·입력 차단·포커스 회귀
- 수정 `client/src/styles.css`: 요약 동작 그룹과 오시는 길 시트 반응형 스타일
- 수정 `client/src/styles.test.ts`: 320px·가로 화면·포커스·안정 크기 계약

---

### Task 1: 공통 오시는 길 데이터 계약

**파일:**
- 수정: `shared/src/content.ts:17-58`
- 수정: `shared/src/content.test.ts:17-44`

**인터페이스:**
- 확장: `WeddingEvent["venue"]["directions"]`
- 소비: Task 2의 `buildDirectionsLinks`, Task 3의 `DirectionsSheet`
- 생성 데이터:

```ts
directions: {
  mapSearchName: string;
  phone: string;
  transit: string;
  parking: string;
}
```

- [ ] **Step 1: 확정 장소 데이터에 대한 실패 테스트 작성**

`shared/src/content.test.ts`의 예식 데이터 기대값에 다음 객체를 추가하고, 오시는 길 spot이 공통 데이터와 일치하는 테스트를 작성한다.

```ts
it("contains the confirmed wedding directions", () => {
  expect(invitationContent.event.venue).toEqual({
    name: "MJ컨벤션",
    hall: "5층 파티오볼룸",
    address: "경기 부천시 소사구 경인로 386",
    directions: {
      mapSearchName: "MJ컨벤션",
      phone: "032-347-5500",
      transit: "1호선·서해선 소사역 1번 출구에서 도보 약 3분",
      parking: "주차 2시간 무료 · 약 500대 이상 주차 가능"
    }
  });
});

it("keeps the directions spot consistent with the venue", () => {
  const directions = invitationContent.spots.find((spot) => spot.id === "directions");
  const venue = invitationContent.event.venue;

  expect(directions?.body).toContain(venue.name);
  expect(directions?.body).toContain(venue.address);
});
```

- [ ] **Step 2: 공유 테스트가 실패하는지 확인**

실행:

```bash
pnpm --filter @wedding-game/shared test -- content.test.ts
```

예상: `venue.directions`가 없어 신규 계약 테스트가 실패한다.

- [ ] **Step 3: 타입과 확정 데이터 구현**

`WeddingEvent`의 `venue`와 실제 데이터에 다음 구조를 추가한다.

```ts
venue: {
  name: string;
  hall: string;
  address: string;
  directions: {
    mapSearchName: string;
    phone: string;
    transit: string;
    parking: string;
  };
};
```

```ts
venue: {
  name: "MJ컨벤션",
  hall: "5층 파티오볼룸",
  address: "경기 부천시 소사구 경인로 386",
  directions: {
    mapSearchName: "MJ컨벤션",
    phone: "032-347-5500",
    transit: "1호선·서해선 소사역 1번 출구에서 도보 약 3분",
    parking: "주차 2시간 무료 · 약 500대 이상 주차 가능"
  }
}
```

- [ ] **Step 4: 공유 테스트와 타입 검사 통과 확인**

실행:

```bash
pnpm --filter @wedding-game/shared test -- content.test.ts
pnpm --filter @wedding-game/shared typecheck
```

예상: 공유 테스트 5개 파일 전체와 타입 검사가 통과한다.

- [ ] **Step 5: 공통 데이터 커밋**

```bash
git add shared/src/content.ts shared/src/content.test.ts
git commit -m "feat: add confirmed wedding directions data"
```

---

### Task 2: 지도 URL과 전화 링크 생성

**파일:**
- 생성: `client/src/invitation/directions.ts`
- 생성: `client/src/invitation/directions.test.ts`

**인터페이스:**
- 소비: `WeddingEvent["venue"]`
- 생성: `buildDirectionsLinks(venue): DirectionsLinks`
- 생성: `buildTelephoneHref(phone): string | null`
- 생성 타입:

```ts
export type DirectionsLinks = {
  naver: string | null;
  kakao: string | null;
  google: string | null;
  telephone: string | null;
};
```

- [ ] **Step 1: 세 지도와 전화 링크 실패 테스트 작성**

`client/src/invitation/directions.test.ts`를 다음 핵심 사례로 작성한다.

```ts
import { invitationContent } from "@wedding-game/shared";
import { describe, expect, it } from "vitest";
import { buildDirectionsLinks, buildTelephoneHref } from "./directions";

const venue = invitationContent.event.venue;
const destination = `${venue.directions.mapSearchName} ${venue.address}`;

describe("wedding directions links", () => {
  it("builds three HTTPS destination links from the shared venue", () => {
    const links = buildDirectionsLinks(venue);
    const naver = new URL(links.naver ?? "");
    const kakao = new URL(links.kakao ?? "");
    const google = new URL(links.google ?? "");

    expect(naver.protocol).toBe("https:");
    expect(naver.hostname).toBe("map.naver.com");
    expect(decodeURIComponent(naver.pathname)).toContain(destination);
    expect(kakao.protocol).toBe("https:");
    expect(kakao.hostname).toBe("map.kakao.com");
    expect(kakao.searchParams.get("q")).toBe(destination);
    expect(google.protocol).toBe("https:");
    expect(google.hostname).toBe("www.google.com");
    expect(google.pathname).toBe("/maps/dir/");
    expect(google.searchParams.get("api")).toBe("1");
    expect(google.searchParams.get("destination")).toBe(destination);
  });

  it("derives a telephone link from the display number", () => {
    expect(buildTelephoneHref(venue.directions.phone)).toBe("tel:0323475500");
  });

  it("disables only data-dependent actions for invalid venue values", () => {
    expect(buildDirectionsLinks({ ...venue, address: "" })).toEqual({
      naver: null,
      kakao: null,
      google: null,
      telephone: "tel:0323475500"
    });
    expect(buildTelephoneHref("번호 없음")).toBeNull();
  });
});
```

- [ ] **Step 2: 모듈 부재로 테스트가 실패하는지 확인**

실행:

```bash
pnpm --filter @wedding-game/client test -- directions.test.ts
```

예상: `./directions` 모듈을 찾지 못해 실패한다.

- [ ] **Step 3: 순수 링크 생성 유틸리티 구현**

`client/src/invitation/directions.ts`에 다음 구현을 추가한다.

```ts
import type { WeddingEvent } from "@wedding-game/shared";

export type DirectionsLinks = {
  naver: string | null;
  kakao: string | null;
  google: string | null;
  telephone: string | null;
};

export function buildTelephoneHref(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  return /^\d{9,11}$/.test(digits) ? `tel:${digits}` : null;
}

export function buildDirectionsLinks(venue: WeddingEvent["venue"]): DirectionsLinks {
  const mapSearchName = venue.directions.mapSearchName.trim();
  const address = venue.address.trim();
  const telephone = buildTelephoneHref(venue.directions.phone);

  if (!mapSearchName || !address) {
    return { naver: null, kakao: null, google: null, telephone };
  }

  const destination = `${mapSearchName} ${address}`;
  const kakao = new URL("https://map.kakao.com/");
  kakao.searchParams.set("q", destination);
  const google = new URL("https://www.google.com/maps/dir/");
  google.searchParams.set("api", "1");
  google.searchParams.set("destination", destination);

  return {
    naver: `https://map.naver.com/p/search/${encodeURIComponent(destination)}`,
    kakao: kakao.toString(),
    google: google.toString(),
    telephone
  };
}
```

- [ ] **Step 4: 유틸리티 테스트와 타입 검사 통과 확인**

실행:

```bash
pnpm --filter @wedding-game/client test -- directions.test.ts
pnpm --filter @wedding-game/client typecheck
```

예상: 지도 URL 3종, 전화번호, 잘못된 데이터 사례가 모두 통과한다.

- [ ] **Step 5: 링크 유틸리티 커밋**

```bash
git add client/src/invitation/directions.ts client/src/invitation/directions.test.ts
git commit -m "feat: build wedding directions links"
```

---

### Task 3: 재사용 가능한 오시는 길 하단 시트

**파일:**
- 생성: `client/src/components/DirectionsSheet.tsx`
- 생성: `client/src/components/DirectionsSheet.test.tsx`

**인터페이스:**
- 소비: `invitationContent.event.venue`
- 소비: `buildDirectionsLinks`, `copyText`, `BottomSheet`
- 생성: `DirectionsSheet({ onClose }: { onClose(): void })`

- [ ] **Step 1: 렌더링·복사·외부 링크 실패 테스트 작성**

`client/src/components/DirectionsSheet.test.tsx`에 다음 사례를 작성한다.

```tsx
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { copyText } from "../invitation/browserActions";
import { DirectionsSheet } from "./DirectionsSheet";

vi.mock("../invitation/browserActions", () => ({ copyText: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("renders the confirmed venue, transit, parking, map, and phone actions", () => {
  render(<DirectionsSheet onClose={vi.fn()} />);

  expect(screen.getByRole("dialog", { name: "오시는 길" })).toHaveTextContent("MJ컨벤션 5층 파티오볼룸");
  expect(screen.getByText("경기 부천시 소사구 경인로 386")).toBeInTheDocument();
  expect(screen.getByText("1호선·서해선 소사역 1번 출구에서 도보 약 3분")).toBeInTheDocument();
  expect(screen.getByText("주차 2시간 무료 · 약 500대 이상 주차 가능")).toBeInTheDocument();

  for (const name of ["네이버지도", "카카오맵", "Google 지도"]) {
    expect(screen.getByRole("link", { name: new RegExp(name) })).toHaveAttribute("target", "_blank");
    expect(screen.getByRole("link", { name: new RegExp(name) })).toHaveAttribute("rel", "noopener noreferrer");
  }
  expect(screen.getByRole("link", { name: "032-347-5500 전화하기" })).toHaveAttribute("href", "tel:0323475500");
});

it("copies the address and reports success", async () => {
  vi.mocked(copyText).mockResolvedValue(undefined);
  render(<DirectionsSheet onClose={vi.fn()} />);

  fireEvent.click(screen.getByRole("button", { name: "주소 복사" }));
  expect(copyText).toHaveBeenCalledWith("경기 부천시 소사구 경인로 386");
  expect(await screen.findByText("주소를 복사했습니다.")).toBeInTheDocument();
});

it("keeps the address visible and reports copy failure", async () => {
  vi.mocked(copyText).mockRejectedValue(new Error("denied"));
  render(<DirectionsSheet onClose={vi.fn()} />);

  fireEvent.click(screen.getByRole("button", { name: "주소 복사" }));
  expect(await screen.findByText("복사하지 못했습니다. 주소를 길게 눌러 복사해주세요.")).toBeInTheDocument();
  expect(screen.getByText("경기 부천시 소사구 경인로 386")).toBeInTheDocument();
});
```

- [ ] **Step 2: 컴포넌트 부재로 테스트가 실패하는지 확인**

실행:

```bash
pnpm --filter @wedding-game/client test -- DirectionsSheet.test.tsx
```

예상: `DirectionsSheet` 모듈을 찾지 못해 실패한다.

- [ ] **Step 3: 하단 시트 구현**

`DirectionsSheet.tsx`에 상태와 동작을 다음 구조로 구현한다.

```tsx
import { useState } from "react";
import { Car, Copy, ExternalLink, MapPinned, Phone, TrainFront } from "lucide-react";
import { invitationContent } from "@wedding-game/shared";
import { copyText } from "../invitation/browserActions";
import { buildDirectionsLinks } from "../invitation/directions";
import { BottomSheet } from "./BottomSheet";

type DirectionsSheetProps = { onClose: () => void };
type CopyStatus = "idle" | "copying" | "copied" | "error";

export function DirectionsSheet({ onClose }: DirectionsSheetProps) {
  const venue = invitationContent.event.venue;
  const links = buildDirectionsLinks(venue);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");
  const mapLinks = [
    ["네이버지도", links.naver],
    ["카카오맵", links.kakao],
    ["Google 지도", links.google]
  ] as const;

  async function copyAddress() {
    if (copyStatus === "copying") return;
    setCopyStatus("copying");
    try {
      await copyText(venue.address);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("error");
    }
  }

  return (
    <BottomSheet title="오시는 길" onClose={onClose}>
      <div className="directions-sheet">
        <section className="directions-sheet__venue">
          <MapPinned aria-hidden="true" />
          <div><strong>{venue.name} {venue.hall}</strong><span>{venue.address}</span></div>
          <button type="button" aria-label="주소 복사" disabled={copyStatus === "copying"} onClick={copyAddress}><Copy aria-hidden="true" /></button>
        </section>
        <div className="directions-sheet__maps">
          {mapLinks.map(([label, href]) => href ? (
            <a key={label} href={href} target="_blank" rel="noopener noreferrer"><ExternalLink aria-hidden="true" />{label}</a>
          ) : (
            <button key={label} type="button" disabled><ExternalLink aria-hidden="true" />{label}</button>
          ))}
        </div>
        <section className="directions-sheet__info"><TrainFront aria-hidden="true" /><div><strong>대중교통</strong><span>{venue.directions.transit}</span></div></section>
        <section className="directions-sheet__info"><Car aria-hidden="true" /><div><strong>자가용·주차</strong><span>{venue.directions.parking}</span></div></section>
        <section className="directions-sheet__phone"><Phone aria-hidden="true" /><strong>{venue.directions.phone}</strong>{links.telephone ? <a href={links.telephone} aria-label={`${venue.directions.phone} 전화하기`}>전화</a> : null}</section>
        <p className="directions-sheet__status" aria-live="polite">
          {copyStatus === "copied" ? "주소를 복사했습니다." : null}
          {copyStatus === "error" ? "복사하지 못했습니다. 주소를 길게 눌러 복사해주세요." : null}
        </p>
      </div>
    </BottomSheet>
  );
}
```

- [ ] **Step 4: 컴포넌트 테스트와 타입 검사 통과 확인**

실행:

```bash
pnpm --filter @wedding-game/client test -- DirectionsSheet.test.tsx BottomSheet.test.tsx
pnpm --filter @wedding-game/client typecheck
```

예상: 새 시트 테스트와 기존 포커스 트랩 테스트가 통과한다.

- [ ] **Step 5: 하단 시트 커밋**

```bash
git add client/src/components/DirectionsSheet.tsx client/src/components/DirectionsSheet.test.tsx
git commit -m "feat: add wedding directions sheet"
```

---

### Task 4: 입장 화면과 예식 요약 통합

**파일:**
- 수정: `client/src/components/WeddingEventSummary.tsx:1-98`
- 수정: `client/src/components/WeddingEventSummary.test.tsx:16-62`
- 수정: `client/src/components/EntryScreen.test.tsx:10-26`

**인터페이스:**
- 추가 prop: `onDirectionsSheetOpenChange?: (open: boolean) => void`
- 소비: `DirectionsSheet`
- 유지: `onCalendarSheetOpenChange?: (open: boolean) => void`

- [ ] **Step 1: 두 변형의 진입점과 소유자 알림 실패 테스트 작성**

기존 테스트에 다음 사례를 추가한다.

```tsx
it("opens the shared directions sheet from the compact summary", () => {
  render(<WeddingEventSummary variant="compact" />);
  fireEvent.click(screen.getByRole("button", { name: "오시는 길" }));
  expect(screen.getByRole("dialog", { name: "오시는 길" })).toHaveTextContent("소사역 1번 출구");
});

it("notifies its owner while the directions sheet is open", () => {
  const onDirectionsSheetOpenChange = vi.fn();
  render(<WeddingEventSummary variant="detail" onDirectionsSheetOpenChange={onDirectionsSheetOpenChange} />);

  fireEvent.click(screen.getByRole("button", { name: "오시는 길" }));
  expect(onDirectionsSheetOpenChange).toHaveBeenLastCalledWith(true);
  fireEvent.click(screen.getByRole("button", { name: "닫기" }));
  expect(onDirectionsSheetOpenChange).toHaveBeenLastCalledWith(false);
});
```

`EntryScreen.test.tsx`의 입장 전 요약 테스트에 다음 검증을 추가한다.

```tsx
expect(screen.getByRole("button", { name: "오시는 길" })).toBeInTheDocument();
fireEvent.click(screen.getByRole("button", { name: "오시는 길" }));
expect(screen.getByRole("dialog", { name: "오시는 길" })).toBeInTheDocument();
```

- [ ] **Step 2: 신규 버튼 부재로 테스트가 실패하는지 확인**

실행:

```bash
pnpm --filter @wedding-game/client test -- WeddingEventSummary.test.tsx EntryScreen.test.tsx
```

예상: `오시는 길` 버튼과 시트를 찾지 못해 실패한다.

- [ ] **Step 3: 요약의 오시는 길 상태와 동작 그룹 구현**

`WeddingEventSummary.tsx`에 독립 방향 시트 상태와 콜백을 추가한다.

```tsx
type WeddingEventSummaryProps = {
  variant: "compact" | "detail";
  onCalendarSheetOpenChange?: (open: boolean) => void;
  onDirectionsSheetOpenChange?: (open: boolean) => void;
};

const [directionsOpen, setDirectionsOpen] = useState(false);

const setDirectionsVisibility = (open: boolean) => {
  setDirectionsOpen(open);
  onDirectionsSheetOpenChange?.(open);
};
```

기존 캘린더 버튼을 두 동작의 고정 그룹으로 교체한다.

```tsx
<div className="wedding-event-summary__actions">
  <button type="button" className="wedding-event-summary__directions" onClick={() => setDirectionsVisibility(true)}>
    <Navigation aria-hidden="true" />
    오시는 길
  </button>
  <button type="button" className="wedding-event-summary__calendar" onClick={() => setCalendarVisibility(true)}>
    <CalendarPlus aria-hidden="true" />
    캘린더 저장
  </button>
</div>
{directionsOpen ? <DirectionsSheet onClose={() => setDirectionsVisibility(false)} /> : null}
{calendarOpen ? <CalendarSaveSheet onClose={() => setCalendarVisibility(false)} /> : null}
```

`lucide-react`에서 `Navigation`을 가져오고 `DirectionsSheet`를 import한다. 기존 상세 주소 복사 동작은 유지한다.

- [ ] **Step 4: 입장·요약 테스트와 타입 검사 통과 확인**

실행:

```bash
pnpm --filter @wedding-game/client test -- WeddingEventSummary.test.tsx EntryScreen.test.tsx DirectionsSheet.test.tsx
pnpm --filter @wedding-game/client typecheck
```

예상: compact·detail 모두 동일한 시트를 열고 기존 캘린더·주소 복사 테스트가 유지된다.

- [ ] **Step 5: 입장·요약 통합 커밋**

```bash
git add client/src/components/WeddingEventSummary.tsx client/src/components/WeddingEventSummary.test.tsx client/src/components/EntryScreen.test.tsx
git commit -m "feat: expose directions before garden entry"
```

---

### Task 5: 초대장 메뉴와 월드 장소 통합

**파일:**
- 수정: `client/src/components/GameWorld.tsx:105-337,805-844`
- 수정: `client/src/components/GameWorld.test.tsx`

**인터페이스:**
- 소비: `DirectionsSheet`
- 소비: `WeddingEventSummary.onDirectionsSheetOpenChange`
- 유지: `activeSpotId: SpotId | null`

- [ ] **Step 1: 메뉴·월드 진입과 입력 차단 실패 테스트 작성**

`GameWorld.test.tsx`에 다음 통합 사례를 추가한다.

```tsx
it("opens directions above the invitation menu without moving the player", () => {
  const { container } = render(<GameWorld profile={profile} />);
  const player = container.querySelector<HTMLElement>(".world-player");
  const before = { left: player?.style.left, top: player?.style.top };

  fireEvent.click(screen.getByRole("button", { name: "초대장 메뉴" }));
  const menu = screen.getByRole("dialog", { name: "초대장 바로가기" });
  fireEvent.click(within(menu).getByRole("button", { name: "오시는 길" }));

  expect(screen.getByRole("dialog", { name: "오시는 길" })).toBeInTheDocument();
  expect(menu).toHaveAttribute("aria-hidden", "true");
  fireEvent.click(within(screen.getByRole("dialog", { name: "오시는 길" })).getByRole("button", { name: "주소 복사" }));
  expect(player?.style.left).toBe(before.left);
  expect(player?.style.top).toBe(before.top);
});

it("opens the same directions sheet from the world directions spot", () => {
  render(<GameWorld profile={profile} />);
  fireEvent.click(screen.getByRole("button", { name: /오시는 길/ }));

  const dialog = screen.getByRole("dialog", { name: "오시는 길" });
  expect(dialog).toHaveTextContent("네이버지도");
  expect(dialog).toHaveTextContent("주차 2시간 무료");
  expect(screen.queryByText("MJ컨벤션은 경기 부천시 소사구 경인로 386에 있습니다.")).not.toBeInTheDocument();
});

it("opens the same sheet from the menu directions shortcut", () => {
  render(<GameWorld profile={profile} />);
  fireEvent.click(screen.getByRole("button", { name: "초대장 메뉴" }));
  fireEvent.click(within(screen.getByRole("dialog", { name: "초대장 바로가기" })).getByRole("button", { name: "길 찾기" }));

  expect(screen.queryByRole("dialog", { name: "초대장 바로가기" })).not.toBeInTheDocument();
  expect(screen.getByRole("dialog", { name: "오시는 길" })).toBeInTheDocument();
});
```

테스트의 `copyText` mock은 기존 `WeddingEventSummary` 테스트 패턴처럼 성공 값을 반환하도록 설정한다.

- [ ] **Step 2: 기존 일반 SpotModal 동작으로 테스트가 실패하는지 확인**

실행:

```bash
pnpm --filter @wedding-game/client test -- GameWorld.test.tsx
```

예상: 메뉴 내 오시는 길 버튼이 없고 월드 directions가 일반 `SpotModal`을 열어 실패한다.

- [ ] **Step 3: 메뉴 중첩 시트 상태와 월드 분기 구현**

`GameWorld.tsx`에 방향 시트 상태를 추가하고 메뉴 중첩 여부를 계산한다.

```tsx
const [calendarSheetOpen, setCalendarSheetOpen] = useState(false);
const [directionsSheetOpen, setDirectionsSheetOpen] = useState(false);
const nestedMenuSheetOpen = calendarSheetOpen || directionsSheetOpen;
```

`closeMenu`와 포털 도착 정리 경로에서 두 중첩 시트 상태를 함께 초기화한다.

```tsx
setCalendarSheetOpen(false);
setDirectionsSheetOpen(false);
setMenuOpen(false);
```

메뉴 `Escape`, 레이어, 접근성 상태가 두 중첩 시트 모두를 따르도록 교체한다.

```tsx
if (event.key === "Escape" && !nestedMenuSheetOpen) closeMenu();
```

```tsx
style={{ zIndex: nestedMenuSheetOpen ? 8 : undefined }}
aria-hidden={nestedMenuSheetOpen || undefined}
style={{ zIndex: nestedMenuSheetOpen ? 9 : undefined }}
```

요약 컴포넌트에 콜백을 연결한다.

```tsx
<WeddingEventSummary
  variant="detail"
  onCalendarSheetOpenChange={setCalendarSheetOpen}
  onDirectionsSheetOpenChange={setDirectionsSheetOpen}
/>
```

월드의 `directions` spot만 공통 시트로 분기한다.

```tsx
{activeSpotId === "directions" ? (
  <DirectionsSheet onClose={() => setActiveSpotId(null)} />
) : activeSpotId ? (
  <SpotModal spotId={activeSpotId} nickname={profile.nickname} onClose={() => setActiveSpotId(null)} />
) : null}
```

`DirectionsSheet`를 import하고 기존 포털 도착·여정 이동에서 `activeSpotId`를 닫는 경로는 유지한다.

- [ ] **Step 4: 게임 통합과 회귀 테스트 통과 확인**

실행:

```bash
pnpm --filter @wedding-game/client test -- GameWorld.test.tsx WeddingEventSummary.test.tsx DirectionsSheet.test.tsx
pnpm --filter @wedding-game/client typecheck
```

예상: 세 진입점, 메뉴 레이어, 포털 전환 차단, 기존 월드 테스트가 모두 통과한다.

- [ ] **Step 5: 게임 통합 커밋**

```bash
git add client/src/components/GameWorld.tsx client/src/components/GameWorld.test.tsx
git commit -m "feat: open directions throughout the invitation"
```

---

### Task 6: 반응형 스타일, 전체 검증, 배포

**파일:**
- 수정: `client/src/styles.css:300-420,1460-1650,2227-2445`
- 수정: `client/src/styles.test.ts:73-123`

**인터페이스:**
- 스타일 계약: `.wedding-event-summary__actions`, `.directions-sheet`, `.directions-sheet__maps`, `.directions-sheet__info`, `.directions-sheet__phone`
- 배포 산출물: `client/dist`

- [ ] **Step 1: 고정 크기·포커스·반응형 실패 테스트 작성**

`styles.test.ts`의 `wedding event access` 블록에 다음 검증을 추가한다.

```ts
it("keeps directions actions stable and accessible on narrow screens", () => {
  expect(styles).toMatch(/\.wedding-event-summary__actions\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);/s);
  expect(styles).toMatch(/\.directions-sheet__maps\s*\{[^}]*display:\s*grid;/s);
  expect(styles).toMatch(/\.directions-sheet__maps > (?:a|button)[^{]*\{[^}]*min-height:\s*48px;/s);
  expect(styles).toMatch(/\.directions-sheet__venue span\s*\{[^}]*user-select:\s*text;/s);
  expect(styles).toMatch(/\.directions-sheet a:focus-visible,\s*\.directions-sheet button:focus-visible\s*\{/s);
});

it("adapts the directions sheet for narrow and short landscape viewports", () => {
  expect(styles).toMatch(/@media \(max-width:\s*360px\)[\s\S]*\.directions-sheet__maps/);
  expect(styles).toMatch(/@media \(orientation:\s*landscape\) and \(max-height:\s*500px\)[\s\S]*\.bottom-sheet/);
  expect(styles).toMatch(/@media \(orientation:\s*landscape\) and \(max-height:\s*500px\)[\s\S]*\.directions-sheet/);
});
```

- [ ] **Step 2: 스타일 계약 부재로 테스트가 실패하는지 확인**

실행:

```bash
pnpm --filter @wedding-game/client test -- styles.test.ts
```

예상: 신규 클래스와 반응형 규칙을 찾지 못해 실패한다.

- [ ] **Step 3: 픽셀 웨딩 스타일과 반응형 규칙 구현**

기존 paper·sage·camellia·gold 토큰을 재사용해 다음 핵심 규칙을 추가한다.

```css
.wedding-event-summary__actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  min-width: 0;
}

.wedding-event-summary__actions > button {
  min-width: 0;
  min-height: 42px;
  padding: 8px 6px;
  white-space: normal;
}

.directions-sheet {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.directions-sheet__venue,
.directions-sheet__info,
.directions-sheet__phone {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.directions-sheet__venue span {
  user-select: text;
}

.directions-sheet__maps {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.directions-sheet__maps > a,
.directions-sheet__maps > button {
  display: flex;
  min-width: 0;
  min-height: 48px;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 7px 5px;
  text-align: center;
  white-space: normal;
}

.directions-sheet__maps > a,
.directions-sheet__maps > button,
.directions-sheet__phone > a,
.directions-sheet__venue > button {
  border: 2px solid color-mix(in srgb, var(--sage) 62%, #59483f);
  background: var(--paper-raised);
  color: var(--ink);
  font-weight: 900;
  text-decoration: none;
  box-shadow: 2px 2px 0 rgba(89, 72, 63, 0.42);
}

.directions-sheet a:focus-visible,
.directions-sheet button:focus-visible {
  outline: 2px solid #fff8cf;
  outline-offset: 2px;
  box-shadow: 0 0 0 5px var(--sage);
}

@media (max-width: 360px) {
  .directions-sheet__maps {
    grid-template-columns: 1fr;
  }
}

@media (orientation: landscape) and (max-height: 500px) {
  .bottom-sheet {
    max-height: calc(100dvh - 12px);
  }

  .directions-sheet {
    gap: 8px;
  }
}
```

기존 `.wedding-event-summary__calendar` 단일 버튼 규칙은 `.wedding-event-summary__actions > button`과 두 버튼의 focus selector로 일반화한다. 아이콘은 18px 고정 크기를 유지하고 버튼 텍스트가 레이아웃 크기를 변경하지 않게 한다.

- [ ] **Step 4: 스타일·컴포넌트·타입 검사 통과 확인**

실행:

```bash
pnpm --filter @wedding-game/client test -- styles.test.ts DirectionsSheet.test.tsx WeddingEventSummary.test.tsx EntryScreen.test.tsx GameWorld.test.tsx
pnpm --filter @wedding-game/client typecheck
git diff --check
```

예상: 관련 클라이언트 테스트와 타입 검사, whitespace 검사가 통과한다.

- [ ] **Step 5: 스타일 커밋**

```bash
git add client/src/styles.css client/src/styles.test.ts
git commit -m "style: polish wedding directions access"
```

- [ ] **Step 6: 저장소 전체 자동 검증**

각 명령을 별도로 실행한다.

```bash
pnpm test
pnpm typecheck
pnpm build
git diff --check
```

예상:

- 맵·캐릭터 asset audit 통과
- shared, client, worker 테스트 실패 0개
- shared, client, worker 타입 검사 통과
- `client/dist` 프로덕션 번들 생성
- `git diff --check` 출력 없음

- [ ] **Step 7: 로컬 모바일 브라우저 검증**

Worker와 클라이언트를 서로 다른 세션으로 실행한다.

```bash
pnpm --filter @wedding-game/worker exec wrangler dev --ip 127.0.0.1 --port 8787
VITE_WORKER_URL=http://127.0.0.1:8787 VITE_INVITATION_ID=sample-garden pnpm --filter @wedding-game/client exec vite --host 127.0.0.1 --port 58866
```

`agent-browser`에서 `320x568`, iPhone 14, `667x375`를 각각 확인한다.

1. 입장 화면의 오시는 길 버튼이 캘린더 버튼과 겹치지 않는다.
2. 시트에 확정 주소·교통·주차·전화가 표시된다.
3. 세 지도 링크의 `href`, `target`, `rel`이 올바르다.
4. 주소 복사 실패 시 원문과 실패 문구가 유지된다.
5. `Escape` 후 오시는 길 버튼으로 포커스가 복원된다.
6. 정원 입장 후 메뉴의 오시는 길 시트가 메뉴보다 위에 표시된다.
7. 월드 오시는 길 장소도 같은 시트를 연다.
8. 시트 조작 전후 `.world-player`의 `left`와 `top`이 같다.
9. 모든 viewport의 `document.documentElement.scrollWidth - window.innerWidth`가 0이다.
10. 브라우저 page errors가 0이다.

- [ ] **Step 8: `main` 푸시와 GitHub Pages 배포 확인**

```bash
git status --short --branch
git push origin main
gh run list --workflow pages.yml --branch main --limit 3
gh run watch "$(gh run list --workflow pages.yml --branch main --limit 1 --json databaseId --jq '.[0].databaseId')" --exit-status
```

예상: 새 실행의 `headSha`가 현재 `HEAD`와 같고 결론이 `success`다.

CI 번들과 운영 HTML의 해시를 비교한다.

```bash
gh run view "$(gh run list --workflow pages.yml --branch main --limit 1 --json databaseId --jq '.[0].databaseId')" --log | rg -o 'index-[A-Za-z0-9_-]+\.(js|css)' | sort -u
curl -L -fsS -H 'Cache-Control: no-cache' "https://po-mato.github.io/pixel-garden-invitation/?deploy=$(git rev-parse --short HEAD)" | rg -o 'index-[A-Za-z0-9_-]+\.(js|css)' | sort -u
```

예상: CI와 운영 HTML의 JS·CSS 파일명이 각각 일치한다.

- [ ] **Step 9: 실서비스 기능 확인**

`https://po-mato.github.io/pixel-garden-invitation/?qa=$(git rev-parse --short HEAD)`의 셸 치환 결과 URL을 새 브라우저 세션으로 열고 Step 7의 세 진입점과 링크 속성을 다시 확인한다. 지도 링크는 새 탭 도메인이 각각 `map.naver.com`, `map.kakao.com`, `www.google.com`인지 확인하고, 전화 링크는 DOM의 `href="tel:0323475500"`으로 검증한다. 콘솔 오류와 page errors가 없어야 한다.

---

## 완료 조건

- `invitationContent.event.venue` 하나로 주소·교통·주차·전화·지도 검색어가 관리된다.
- 입장 화면, 초대장 메뉴, 월드 장소가 동일한 `DirectionsSheet`를 연다.
- 네이버지도·카카오맵·Google 지도와 전화 링크가 정확하다.
- 주소 복사 성공·실패 상태와 접근성 포커스가 동작한다.
- 시트 상호작용이 캐릭터 위치나 게임 입력을 변경하지 않는다.
- 320px 모바일과 좁은 가로 화면에서 잘림·겹침·가로 스크롤이 없다.
- 전체 테스트·타입 검사·빌드가 통과한다.
- GitHub Pages 배포와 운영 번들·실서비스 검증이 완료된다.
