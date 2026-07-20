# 참석 답변 실사용화 구현 계획

> **에이전트 작업자 필수 사항:** REQUIRED SUB-SKILL: 이 계획을 작업별로 구현할 때 `superpowers:subagent-driven-development`(권장) 또는 `superpowers:executing-plans` 하위 스킬을 사용한다. 모든 단계는 체크박스로 진행 상태를 기록한다.

**목표:** 하객이 청첩장 안에서 실제 참석 정보를 제출하고 같은 기기에서 확인·수정하며, 신랑·신부가 보호된 관리 화면에서 집계·검색·삭제·CSV 저장을 수행할 수 있게 한다.

**아키텍처:** `shared`에 RSVP 타입·정규화·조건부 검증과 예식 정책을 두고 클라이언트와 Worker가 같은 계약을 사용한다. Worker는 D1 저장소, Web Crypto 기반 수정 키·관리자 세션, 관리자 조회, 예약 삭제를 분리하며, 클라이언트는 하객 상태 흐름과 관리자 화면을 별도 컴포넌트로 구성한다.

**기술 스택:** TypeScript, React 18, Vite, Vitest, Testing Library, Cloudflare Workers, D1, Web Crypto, Wrangler, GitHub Pages

## 전역 제약

- 실제 작업 경로는 `/Users/sjlee/Documents/New project 5`이며 새 worktree를 만들지 않는다.
- 참석 답변 권장 마감은 2027년 4월 24일이며 이후에도 제출과 수정을 허용한다.
- RSVP 개인정보는 2027년 5월 31일 종료 시점 이후 첫 예약 작업에서 자동 삭제한다.
- 신규 응답은 신랑측·신부측, 이름, 연락처, 참석 상태, 조건부 인원·식사, 전달사항과 개인정보 동의를 사용한다.
- `참석`은 인원 1~10과 식사 `yes|no|unsure`, `불참`은 인원 0과 식사 `not_applicable`, `미정`은 예상 인원 1~10과 식사 `unsure`를 사용한다.
- 하객 수정 권한은 응답별 무작위 키로 제한하고 D1에는 키 해시만 저장한다.
- 관리자 비밀번호 원문과 세션 서명 키는 코드, 문서, D1, Git 기록, CI 로그에 남기지 않는다.
- 관리자 세션은 1시간 유효하며 브라우저 `sessionStorage`에만 저장한다.
- 다른 기기 응답 복구, SMS·이메일 인증, 동행자별 입력, 외부 설문·시트 동기화는 구현하지 않는다.
- 기존 방명록, 일정 저장, 오시는 길, 월드 이동, 포털, 조이스틱과 미니맵 동작을 보존한다.
- 기존 미추적 캐릭터 원본 디렉터리와 수정된 `.superpowers/sdd/task-*-report.md`를 스테이징하거나 수정하지 않는다.
- 구현은 실패 테스트 확인, 최소 구현, 테스트 통과, 작업별 검토와 커밋 순서를 따른다.
- 운영 배포는 D1 백업 → D1 마이그레이션 → Worker → GitHub Pages 순서로 수행한다.

---

## 파일 구조

- 생성 `shared/src/rsvp.ts`: RSVP 타입, 연락처 정규화, 조건부 payload 검증
- 생성 `shared/src/rsvp.test.ts`: 공통 RSVP 계약 테스트
- 수정 `shared/src/index.ts`: RSVP 계약 export
- 수정 `shared/src/content.ts`: RSVP 마감·삭제·동의 버전 정책
- 수정 `shared/src/content.test.ts`: 확정 RSVP 정책 테스트
- 생성 `worker/migrations/0003_production_rsvp.sql`: RSVP 테이블 교체, 예식 정책, 로그인 제한 테이블과 인덱스
- 수정 `worker/src/migrations.test.ts`: 기존 행 보존과 신규 제약 검증
- 생성 `worker/src/security.ts`: 수정 키 해시, PBKDF2 비밀번호 검증, HMAC 관리자 세션
- 생성 `worker/src/security.test.ts`: 보안 primitive와 변조·만료 테스트
- 생성 `scripts/hash-rsvp-admin-password.mjs`: 원문을 저장하지 않는 PBKDF2 secret 생성
- 수정 `worker/src/validation.ts`: 공통 RSVP parser 사용과 방명록 검증 유지
- 수정 `worker/src/validation.test.ts`: 상태별 RSVP 검증
- 생성 `worker/src/rsvpRepository.ts`: D1 RSVP 생성·조회·수정·목록·삭제·집계
- 생성 `worker/src/rsvpRepository.test.ts`: SQL bind와 행 매핑 테스트
- 생성 `worker/src/adminAuth.ts`: 로그인 제한, 비밀번호 확인과 관리자 토큰 발급
- 생성 `worker/src/adminAuth.test.ts`: 실패 제한과 성공 초기화 테스트
- 생성 `worker/src/cleanup.ts`: RSVP와 로그인 시도 예약 삭제
- 생성 `worker/src/cleanup.test.ts`: 시간 경계와 반복 실행 테스트
- 수정 `worker/src/http.ts`: 하객·관리자 API 라우팅, origin 제한과 오류 매핑
- 수정 `worker/src/http.test.ts`: 신규 API, 권한, 충돌과 CORS 테스트
- 수정 `worker/src/index.ts`: Worker 환경 계약과 `scheduled` handler
- 수정 `worker/src/index.test.ts`: fetch·scheduled 위임 테스트
- 수정 `worker/wrangler.toml`: 일일 cron trigger
- 수정 `client/src/api/weddingApi.ts`: 하객·관리자 RSVP API와 구조화된 오류
- 수정 `client/src/api/weddingApi.test.ts`: 메서드·헤더·응답 검증
- 생성 `client/src/invitation/rsvpStorage.ts`: 하객 수정 키와 관리자 세션 저장
- 생성 `client/src/invitation/rsvpStorage.test.ts`: invitation별 저장·삭제·손상 복구
- 생성 `client/src/invitation/rsvpCsv.ts`: 안전한 한글 CSV 생성·다운로드
- 생성 `client/src/invitation/rsvpCsv.test.ts`: BOM, quoting, 수식 주입 방어
- 수정 `client/src/components/RsvpForm.tsx`: 조건부 실사용 폼
- 수정 `client/src/components/RsvpForm.test.tsx`: 상태별 입력, 동의, 실패 보존 테스트
- 생성 `client/src/components/RsvpPanel.tsx`: 조회·요약·수정 상태 흐름
- 생성 `client/src/components/RsvpPanel.test.tsx`: 수정 키 복원, 충돌·삭제 처리
- 수정 `client/src/components/SpotModal.tsx`: RSVP panel 통합
- 생성 `client/src/components/RsvpAdminPage.tsx`: 관리자 로그인·집계·검색·삭제·CSV UI
- 생성 `client/src/components/RsvpAdminPage.test.tsx`: 관리자 전체 흐름 테스트
- 수정 `client/src/App.tsx`: `?admin=rsvp` 진입 분기
- 생성 `client/src/App.test.tsx`: 일반 청첩장과 관리자 진입 분기
- 수정 `client/src/components/GameWorld.test.tsx`: 두 RSVP 진입점과 이동 차단 회귀
- 수정 `client/src/styles.css`: RSVP 폼·요약·관리자 반응형 스타일
- 수정 `client/src/styles.test.ts`: 320px·390px·가로·포커스 스타일 계약

---

### Task 1: 공통 RSVP 타입과 예식 정책

**파일:**
- 생성: `shared/src/rsvp.ts`
- 생성: `shared/src/rsvp.test.ts`
- 수정: `shared/src/index.ts`
- 수정: `shared/src/content.ts`
- 수정: `shared/src/content.test.ts`

**인터페이스:**
- 생성: `parseRsvpSubmission(value, expectedConsentVersion): RsvpSubmission | null`
- 생성: `normalizeRsvpPhone(value): string`
- 생성: `RsvpSubmission`, `RsvpRecord`, `RsvpCreateResult`, `RsvpAdminSummary`, `RsvpAdminResult`
- 확장: `WeddingEvent["rsvp"]`

- [ ] **Step 1: 공통 계약 실패 테스트 작성**

`shared/src/rsvp.test.ts`에 다음 핵심 사례를 작성한다.

```ts
import { describe, expect, it } from "vitest";
import { normalizeRsvpPhone, parseRsvpSubmission } from "./rsvp";

const consentVersion = "2026-07-20";
const base = {
  side: "groom",
  guestName: " 이승재 ",
  phone: "010-1234-5678",
  attendance: "yes",
  partySize: 2,
  mealStatus: "yes",
  note: " 창가 자리 ",
  consentVersion
};

describe("parseRsvpSubmission", () => {
  it("normalizes a valid attending response", () => {
    expect(parseRsvpSubmission(base, consentVersion)).toEqual({
      ...base,
      guestName: "이승재",
      phone: "01012345678",
      note: "창가 자리"
    });
  });

  it.each([
    [{ ...base, attendance: "no", partySize: 1, mealStatus: "not_applicable" }],
    [{ ...base, attendance: "no", partySize: 0, mealStatus: "yes" }],
    [{ ...base, attendance: "unsure", partySize: 2, mealStatus: "yes" }],
    [{ ...base, consentVersion: "old" }]
  ])("rejects invalid conditional data %#", (value) => {
    expect(parseRsvpSubmission(value, consentVersion)).toBeNull();
  });

  it("accepts canonical no and unsure responses", () => {
    expect(parseRsvpSubmission({ ...base, attendance: "no", partySize: 0, mealStatus: "not_applicable" }, consentVersion)).not.toBeNull();
    expect(parseRsvpSubmission({ ...base, attendance: "unsure", partySize: 2, mealStatus: "unsure" }, consentVersion)).not.toBeNull();
  });
});

it("normalizes domestic and international separators", () => {
  expect(normalizeRsvpPhone("+82 10-1234-5678")).toBe("821012345678");
});
```

`shared/src/content.test.ts`의 예식 기대값에는 다음 정책을 추가한다.

```ts
rsvp: {
  responseDeadline: "2027-04-24T23:59:59+09:00",
  deleteAt: "2027-05-31T23:59:59+09:00",
  consentVersion: "2026-07-20"
}
```

- [ ] **Step 2: 모듈과 정책 부재로 실패하는지 확인**

실행:

```bash
pnpm --filter @wedding-game/shared test -- rsvp.test.ts content.test.ts
```

예상: `./rsvp` 모듈과 `event.rsvp`가 없어 실패한다.

- [ ] **Step 3: 타입과 parser 구현**

`shared/src/rsvp.ts`에 다음 공개 계약을 구현한다.

```ts
import { sanitizeText } from "./validation";

export type RsvpSide = "groom" | "bride";
export type RsvpRecordSide = RsvpSide | "legacy";
export type RsvpAttendance = "yes" | "no" | "unsure";
export type RsvpMealStatus = "yes" | "no" | "unsure" | "not_applicable";

export type RsvpSubmission = {
  side: RsvpSide;
  guestName: string;
  phone: string;
  attendance: RsvpAttendance;
  partySize: number;
  mealStatus: RsvpMealStatus;
  note: string;
  consentVersion: string;
};

export type RsvpRecord = Omit<RsvpSubmission, "side" | "phone" | "consentVersion"> & {
  id: string;
  side: RsvpRecordSide;
  phone: string | null;
  consentVersion: string | null;
  revision: number;
  createdAt: string;
  updatedAt: string;
};

export type RsvpCreateResult = {
  response: RsvpRecord;
  credential: { rsvpId: string; editToken: string };
};

export type RsvpAdminSummary = {
  responseCount: number;
  attendingResponseCount: number;
  attendingPartySize: number;
  mealPartySize: number;
  declinedResponseCount: number;
  unsureResponseCount: number;
  unsurePartySize: number;
  deleteAt: string;
};

export type RsvpAdminResult = { summary: RsvpAdminSummary; responses: RsvpRecord[] };

export function normalizeRsvpPhone(value: string): string {
  return value.replace(/\D/g, "");
}

const sides = new Set<RsvpSide>(["groom", "bride"]);
const attendances = new Set<RsvpAttendance>(["yes", "no", "unsure"]);
const meals = new Set<RsvpMealStatus>(["yes", "no", "unsure", "not_applicable"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseRsvpSubmission(value: unknown, expectedConsentVersion: string): RsvpSubmission | null {
  if (!isRecord(value) || typeof value.phone !== "string") return null;

  const side = value.side as RsvpSide;
  const attendance = value.attendance as RsvpAttendance;
  const mealStatus = value.mealStatus as RsvpMealStatus;
  const guestName = sanitizeText(value.guestName, 30);
  const phone = normalizeRsvpPhone(value.phone);
  const note = sanitizeText(value.note ?? "", 160);
  const partySize = value.partySize;
  const consentVersion = value.consentVersion;

  if (!sides.has(side) || !attendances.has(attendance) || !meals.has(mealStatus)) return null;
  if (!guestName || phone.length < 8 || phone.length > 15) return null;
  if (typeof partySize !== "number" || !Number.isInteger(partySize)) return null;
  if (consentVersion !== expectedConsentVersion) return null;

  const conditionalFieldsAreValid =
    (attendance === "yes" && partySize >= 1 && partySize <= 10 && mealStatus !== "not_applicable")
    || (attendance === "no" && partySize === 0 && mealStatus === "not_applicable")
    || (attendance === "unsure" && partySize >= 1 && partySize <= 10 && mealStatus === "unsure");
  if (!conditionalFieldsAreValid) return null;

  return { side, guestName, phone, attendance, partySize, mealStatus, note, consentVersion };
}
```

`shared/src/index.ts`에서 `./rsvp`를 export하고 `WeddingEvent`에 정책 타입과 확정값을 추가한다.

- [ ] **Step 4: 공통 테스트와 타입 검사 통과 확인**

```bash
pnpm --filter @wedding-game/shared test -- rsvp.test.ts content.test.ts
pnpm --filter @wedding-game/shared typecheck
```

예상: 신규 parser·정책 테스트와 기존 공유 테스트가 모두 통과한다.

- [ ] **Step 5: 공통 계약과 승인 문서 커밋**

```bash
git add shared/src/rsvp.ts shared/src/rsvp.test.ts shared/src/index.ts shared/src/content.ts shared/src/content.test.ts docs/superpowers/specs/2026-07-20-production-rsvp-design.md docs/superpowers/plans/2026-07-20-production-rsvp.md
git commit -m "feat: define production RSVP contract"
```

---

### Task 2: D1 RSVP 스키마 마이그레이션

**파일:**
- 생성: `worker/migrations/0003_production_rsvp.sql`
- 수정: `worker/src/migrations.test.ts`

**인터페이스:**
- 생성 테이블: 새 `rsvps`, `admin_login_attempts`
- 확장 열: `invitations.rsvp_deadline`, `invitations.rsvp_delete_at`
- 소비: Task 4의 `rsvpRepository`, Task 5의 `adminAuth`, Task 6의 `cleanup`

- [ ] **Step 1: 기존 데이터 보존과 제약 실패 테스트 작성**

`migrationFiles`에 `0003_production_rsvp.sql`을 추가한다. 0003 적용 전 기존 RSVP를 넣은 뒤 다음을 검증한다.

```ts
expect(database.prepare("SELECT side, phone, meal_status, revision FROM rsvps WHERE id = ?").get("rsvp_old")).toEqual({
  side: "legacy",
  phone: null,
  meal_status: "unsure",
  revision: 1
});

expect(querySampleGarden(database)).toMatchObject({
  rsvp_deadline: "2027-04-24T14:59:59.000Z",
  rsvp_delete_at: "2027-05-31T14:59:59.000Z"
});
```

또한 신규 불참 `party_size=0`은 성공하고, 참석 `party_size=0` 또는 불참 `meal_status=yes`는 SQLite CHECK 오류가 발생하는지 검증한다.

- [ ] **Step 2: 신규 마이그레이션 부재로 실패 확인**

```bash
pnpm --filter @wedding-game/worker test -- migrations.test.ts
```

예상: `0003_production_rsvp.sql`을 읽지 못해 실패한다.

- [ ] **Step 3: 테이블 교체 마이그레이션 작성**

마이그레이션은 다음 순서를 그대로 사용한다.

```sql
ALTER TABLE invitations ADD COLUMN rsvp_deadline TEXT;
ALTER TABLE invitations ADD COLUMN rsvp_delete_at TEXT;

UPDATE invitations
SET rsvp_deadline = '2027-04-24T14:59:59.000Z',
    rsvp_delete_at = '2027-05-31T14:59:59.000Z'
WHERE id = 'sample-garden';

ALTER TABLE rsvps RENAME TO rsvps_legacy;

CREATE TABLE rsvps (
  id TEXT PRIMARY KEY,
  invitation_id TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('groom', 'bride', 'legacy')),
  guest_name TEXT NOT NULL,
  phone TEXT,
  attendance TEXT NOT NULL CHECK (attendance IN ('yes', 'no', 'unsure')),
  party_size INTEGER NOT NULL CHECK (party_size >= 0 AND party_size <= 10),
  meal_status TEXT NOT NULL CHECK (meal_status IN ('yes', 'no', 'unsure', 'not_applicable')),
  note TEXT NOT NULL,
  consent_version TEXT,
  consented_at TEXT,
  edit_token_hash TEXT,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (invitation_id) REFERENCES invitations(id),
  CHECK (
    side = 'legacy'
    OR (attendance = 'yes' AND party_size BETWEEN 1 AND 10 AND meal_status IN ('yes', 'no', 'unsure'))
    OR (attendance = 'no' AND party_size = 0 AND meal_status = 'not_applicable')
    OR (attendance = 'unsure' AND party_size BETWEEN 1 AND 10 AND meal_status = 'unsure')
  )
);

INSERT INTO rsvps (
  id, invitation_id, side, guest_name, phone, attendance, party_size,
  meal_status, note, consent_version, consented_at, edit_token_hash,
  revision, created_at, updated_at
)
SELECT id, invitation_id, 'legacy', guest_name, NULL, attendance, party_size,
       'unsure', note, NULL, NULL, NULL, 1, created_at, created_at
FROM rsvps_legacy;

DROP TABLE rsvps_legacy;

CREATE INDEX idx_rsvps_invitation_updated ON rsvps(invitation_id, updated_at DESC);

CREATE TABLE admin_login_attempts (
  invitation_id TEXT NOT NULL,
  client_hash TEXT NOT NULL,
  window_started_at TEXT NOT NULL,
  attempts INTEGER NOT NULL CHECK (attempts >= 1),
  PRIMARY KEY (invitation_id, client_hash),
  FOREIGN KEY (invitation_id) REFERENCES invitations(id)
);
```

- [ ] **Step 4: 마이그레이션 테스트 통과 확인**

```bash
pnpm --filter @wedding-game/worker test -- migrations.test.ts
pnpm db:migrate:local
pnpm db:migrate:local
```

예상: 기존 행 보존, 신규 조건 제약과 확정 정책이 통과한다. 첫 로컬 적용은 0003을 적용하고 두 번째 적용은 적용할 마이그레이션이 없다고 보고한다.

- [ ] **Step 5: 스키마 커밋**

```bash
git add worker/migrations/0003_production_rsvp.sql worker/src/migrations.test.ts
git commit -m "feat: migrate production RSVP schema"
```

---

### Task 3: RSVP 검증과 Web Crypto 보안 모듈

**파일:**
- 생성: `worker/src/security.ts`
- 생성: `worker/src/security.test.ts`
- 생성: `scripts/hash-rsvp-admin-password.mjs`
- 수정: `worker/src/validation.ts`
- 수정: `worker/src/validation.test.ts`

**인터페이스:**
- 생성: `createEditCredential(): Promise<{ editToken: string; editTokenHash: string }>`
- 생성: `hashEditToken(token): Promise<string>`
- 생성: `verifyPassword(password, encodedHash): Promise<boolean>`
- 생성: `issueAdminToken(claims, secret): Promise<string>`
- 생성: `verifyAdminToken(token, secret, invitationId, now): Promise<AdminClaims | null>`
- 생성: `hashClientKey(clientKey, secret): Promise<string>`

- [ ] **Step 1: 보안과 상태별 검증 실패 테스트 작성**

`security.test.ts`에서 다음을 검증한다.

```ts
it("stores only a stable hash for an unpredictable edit token", async () => {
  const first = await createEditCredential();
  const second = await createEditCredential();
  expect(first.editToken).not.toBe(second.editToken);
  expect(first.editToken).not.toBe(first.editTokenHash);
  await expect(hashEditToken(first.editToken)).resolves.toBe(first.editTokenHash);
});

it("rejects changed, expired, and cross-invitation admin tokens", async () => {
  const token = await issueAdminToken({ invitationId: "sample-garden", expiresAt: 2_000 }, "session-secret");
  await expect(verifyAdminToken(`${token}x`, "session-secret", "sample-garden", 1_000)).resolves.toBeNull();
  await expect(verifyAdminToken(token, "session-secret", "other", 1_000)).resolves.toBeNull();
  await expect(verifyAdminToken(token, "session-secret", "sample-garden", 2_001)).resolves.toBeNull();
});
```

`validation.test.ts`는 Task 1의 세 canonical 상태와 잘못된 연락처·동의 버전을 `parseRsvpPayload(value, consentVersion)`으로 검사한다.

- [ ] **Step 2: 보안 모듈 부재와 구형 parser로 실패 확인**

```bash
pnpm --filter @wedding-game/worker test -- security.test.ts validation.test.ts
```

예상: 보안 export가 없고 구형 RSVP payload가 신규 계약을 만족하지 않아 실패한다.

- [ ] **Step 3: Web Crypto 구현과 parser 위임**

`security.ts`는 `crypto.getRandomValues`, SHA-256, PBKDF2와 HMAC-SHA256만 사용한다. 토큰은 base64url로 인코딩하고 관리자 payload는 다음 형식으로 제한한다.

```ts
export type AdminClaims = { invitationId: string; expiresAt: number };
```

PBKDF2 secret 문자열 형식은 `pbkdf2-sha256$210000$<salt-base64url>$<hash-base64url>`로 고정한다. 비교는 두 byte array 전체를 XOR 누적하는 상수 시간 비교를 사용한다. `scripts/hash-rsvp-admin-password.mjs`는 `RSVP_ADMIN_PASSWORD` 환경값이 12자 이상인지 검사하고 16 byte 무작위 salt와 210,000회 PBKDF2-SHA256으로 같은 형식의 한 줄만 출력한다. 원문 비밀번호는 출력하거나 파일에 기록하지 않는다. `worker/src/validation.ts`의 RSVP parser는 공통 `parseRsvpSubmission`에 위임하고 기존 방명록 parser는 유지한다.

```js
const password = process.env.RSVP_ADMIN_PASSWORD;
if (!password || password.length < 12) {
  throw new Error("RSVP_ADMIN_PASSWORD must contain at least 12 characters");
}

const encoder = new TextEncoder();
const salt = crypto.getRandomValues(new Uint8Array(16));
const material = await crypto.subtle.importKey(
  "raw",
  encoder.encode(password),
  "PBKDF2",
  false,
  ["deriveBits"]
);
const bits = await crypto.subtle.deriveBits(
  { name: "PBKDF2", hash: "SHA-256", salt, iterations: 210_000 },
  material,
  256
);
const encodedSalt = Buffer.from(salt).toString("base64url");
const encodedHash = Buffer.from(bits).toString("base64url");
process.stdout.write(`pbkdf2-sha256$210000$${encodedSalt}$${encodedHash}`);
```

- [ ] **Step 4: 보안과 검증 테스트 통과 확인**

```bash
pnpm --filter @wedding-game/worker test -- security.test.ts validation.test.ts
pnpm --filter @wedding-game/worker typecheck
```

예상: 난수 키, stable hash, 비밀번호 성공·실패, 토큰 변조·범위·만료, 상태별 payload 테스트가 통과한다.

- [ ] **Step 5: 보안 모듈 커밋**

```bash
git add worker/src/security.ts worker/src/security.test.ts worker/src/validation.ts worker/src/validation.test.ts scripts/hash-rsvp-admin-password.mjs
git commit -m "feat: secure RSVP credentials and validation"
```

---

### Task 4: 하객 RSVP 저장소와 API

**파일:**
- 생성: `worker/src/rsvpRepository.ts`
- 생성: `worker/src/rsvpRepository.test.ts`
- 수정: `worker/src/http.ts`
- 수정: `worker/src/http.test.ts`
- 수정: `worker/src/index.ts`

**인터페이스:**
- 생성: `createRsvp`, `findRsvp`, `updateRsvp`, `getRsvpPolicy`
- 변경: `handleApiRequest(request, env, clientKey, options?)`
- 생성 API: `POST /rsvps`, `GET /rsvps/:id`, `PATCH /rsvps/:id`

- [ ] **Step 1: 저장소와 API 실패 테스트 작성**

다음 계약을 테스트한다.

```ts
expect(createResponse.status).toBe(201);
await expect(createResponse.json()).resolves.toMatchObject({
  response: { side: "groom", attendance: "yes", partySize: 2, revision: 1 },
  credential: { rsvpId: expect.stringMatching(/^rsvp_/), editToken: expect.any(String) }
});

expect(ownedGet.status).toBe(200);
expect(missingTokenGet.status).toBe(401);
expect(wrongTokenGet.status).toBe(401);
expect(updateResponse.status).toBe(200);
expect(staleRevisionUpdate.status).toBe(409);
```

저장소 테스트는 insert bind에 수정 키 원문이 없고 해시만 포함되는지, DB snake_case 행이 `RsvpRecord` camelCase로 정확히 매핑되는지 검사한다.

- [ ] **Step 2: 신규 라우트 부재로 실패 확인**

```bash
pnpm --filter @wedding-game/worker test -- rsvpRepository.test.ts http.test.ts
```

예상: 상세 RSVP 라우트가 404이고 신규 생성 응답 계약이 맞지 않아 실패한다.

- [ ] **Step 3: 저장소와 하객 라우트 구현**

`rsvpRepository.ts`는 다음 입력을 사용한다.

```ts
export type CreateRsvpArgs = {
  id: string;
  invitationId: string;
  submission: RsvpSubmission;
  consentedAt: string;
  editTokenHash: string;
};

export type UpdateRsvpArgs = {
  invitationId: string;
  rsvpId: string;
  submission: RsvpSubmission;
  expectedRevision: number;
  updatedAt: string;
};
```

상세 조회 후 `hashEditToken` 결과를 DB의 `edit_token_hash`와 상수 시간으로 비교한다. PATCH는 `WHERE revision = ?`와 `revision = revision + 1`을 사용하고 변경 행이 0이면 존재 여부를 재확인해 `404` 또는 `409`로 구분한다. 신규·수정 검증은 D1의 invitation 정책에서 읽은 consent version을 사용한다.

`handleApiRequest`는 `Env` 전체를 받고 기존 방명록 라우트를 보존한다. API 오류 코드는 `invalid_request`, `unauthorized`, `not_found`, `conflict`, `rate_limited`, `internal_error`로 제한한다.

- [ ] **Step 4: 하객 API와 기존 Worker 테스트 통과 확인**

```bash
pnpm --filter @wedding-game/worker test -- rsvpRepository.test.ts http.test.ts
pnpm --filter @wedding-game/worker typecheck
```

예상: 신규 생성·조회·수정·충돌·권한 테스트와 기존 방명록 테스트가 모두 통과한다.

- [ ] **Step 5: 하객 API 커밋**

```bash
git add worker/src/rsvpRepository.ts worker/src/rsvpRepository.test.ts worker/src/http.ts worker/src/http.test.ts worker/src/index.ts
git commit -m "feat: add owned RSVP create and update API"
```

---

### Task 5: 관리자 인증과 RSVP 관리 API

**파일:**
- 생성: `worker/src/adminAuth.ts`
- 생성: `worker/src/adminAuth.test.ts`
- 수정: `worker/src/rsvpRepository.ts`
- 수정: `worker/src/rsvpRepository.test.ts`
- 수정: `worker/src/http.ts`
- 수정: `worker/src/http.test.ts`
- 수정: `worker/src/index.ts`

**인터페이스:**
- 생성: `attemptAdminLogin(db, input): Promise<AdminLoginResult>`
- 생성: `listRsvps(db, invitationId): Promise<RsvpAdminResult>`
- 생성: `deleteRsvp(db, invitationId, rsvpId): Promise<boolean>`
- 생성 API: `POST /admin/session`, `GET /admin/rsvps`, `DELETE /admin/rsvps/:id`

- [ ] **Step 1: 로그인 제한과 관리 API 실패 테스트 작성**

다음 사례를 구체적으로 작성한다.

```ts
expect(await login("wrong")).toMatchObject({ status: 401 });
expect(await login("correct")).toMatchObject({ status: 200 });
expect((await login("correct")).headers.get("cache-control")).toBe("no-store");
expect(await adminList()).toMatchObject({ status: 200 });
expect(await adminList("bad-token")).toMatchObject({ status: 401 });
expect(await deleteResponse("rsvp_1")).toMatchObject({ status: 204 });
expect(await deleteResponse("missing")).toMatchObject({ status: 404 });
```

다섯 번 실패한 같은 client hash는 `429`, 다른 client hash는 계속 시도 가능하고 성공 로그인 후 해당 실패 횟수가 초기화되는지 검사한다. 집계는 참석 인원 합, 식사 예정 인원 합, 미정 예상 인원을 별도로 검사한다.

- [ ] **Step 2: 관리자 라우트 부재로 실패 확인**

```bash
pnpm --filter @wedding-game/worker test -- adminAuth.test.ts rsvpRepository.test.ts http.test.ts
```

예상: 관리자 session/list/delete 라우트가 404로 실패한다.

- [ ] **Step 3: 관리자 인증과 목록·삭제 구현**

`Env`에 다음 secret/variable 계약을 추가한다.

```ts
export interface Env {
  DB: D1Database;
  GARDEN_ROOM: DurableObjectNamespace;
  RSVP_ADMIN_PASSWORD_HASH: string;
  RSVP_ADMIN_SESSION_SECRET: string;
  RSVP_CLIENT_KEY_SECRET: string;
  RSVP_ALLOWED_ORIGINS: string;
}
```

로그인 제한은 10분 창, 최대 5회로 고정한다. `hashClientKey`로 만든 값만 `admin_login_attempts`에 저장하며 성공 시 해당 행을 삭제한다. 성공 토큰 만료는 `Date.now() + 60 * 60 * 1000`이다.

관리 목록은 최신 수정 순 전체 응답과 전체 요약을 반환한다. 검색과 필터는 데이터 규모가 작은 단일 초대장이므로 클라이언트에서 수행한다. DELETE는 invitation ID와 RSVP ID를 함께 조건으로 사용한다.

- [ ] **Step 4: 관리자 API 테스트와 전체 Worker 테스트 통과 확인**

```bash
pnpm --filter @wedding-game/worker test -- adminAuth.test.ts rsvpRepository.test.ts http.test.ts
pnpm --filter @wedding-game/worker test
pnpm --filter @wedding-game/worker typecheck
```

예상: 인증·제한·집계·삭제와 기존 Worker 테스트가 모두 통과한다.

- [ ] **Step 5: 관리자 API 커밋**

```bash
git add worker/src/adminAuth.ts worker/src/adminAuth.test.ts worker/src/rsvpRepository.ts worker/src/rsvpRepository.test.ts worker/src/http.ts worker/src/http.test.ts worker/src/index.ts
git commit -m "feat: add protected RSVP administration API"
```

---

### Task 6: CORS 제한과 예약 삭제

**파일:**
- 생성: `worker/src/cleanup.ts`
- 생성: `worker/src/cleanup.test.ts`
- 수정: `worker/src/http.ts`
- 수정: `worker/src/http.test.ts`
- 수정: `worker/src/index.ts`
- 수정: `worker/src/index.test.ts`
- 수정: `worker/wrangler.toml`

**인터페이스:**
- 생성: `cleanupExpiredRsvpData(db, now): Promise<{ rsvps: number; attempts: number }>`
- 생성: Worker `scheduled(controller, env, ctx)` handler

- [ ] **Step 1: origin과 삭제 경계 실패 테스트 작성**

```ts
expect(allowedPreflight.status).toBe(204);
expect(allowedPreflight.headers.get("access-control-allow-origin")).toBe("https://po-mato.github.io");
expect(deniedPreflight.status).toBe(403);
expect(allowedPreflight.headers.get("access-control-allow-methods")).toBe("GET,POST,PATCH,DELETE,OPTIONS");
expect(allowedPreflight.headers.get("access-control-allow-headers")).toBe("content-type,authorization");
```

`cleanup.test.ts`는 삭제 시각 직전 0건, 직후 대상 RSVP 삭제, 오래된 로그인 시도 삭제, 반복 호출 0건을 검증한다. `index.test.ts`는 `scheduled`가 `ctx.waitUntil`에 cleanup Promise를 전달하는지 검사한다.

- [ ] **Step 2: 허용 origin과 scheduled handler 부재로 실패 확인**

```bash
pnpm --filter @wedding-game/worker test -- cleanup.test.ts http.test.ts index.test.ts
```

예상: 현재 wildcard CORS와 scheduled handler 부재로 실패한다.

- [ ] **Step 3: origin allowlist와 idempotent cleanup 구현**

`RSVP_ALLOWED_ORIGINS`는 쉼표 구분 origin 목록으로 파싱한다. 요청 `Origin`이 없으면 서버·CLI 요청으로 처리하되 CORS 헤더를 추가하지 않고, Origin이 있으면 정확히 일치하는 값만 허용한다. 모든 민감 응답에 `Cache-Control: no-store`를 적용한다.

cleanup SQL은 다음 조건을 사용한다.

```sql
DELETE FROM rsvps
WHERE invitation_id IN (
  SELECT id FROM invitations
  WHERE rsvp_delete_at IS NOT NULL AND rsvp_delete_at <= ?
)
```

로그인 시도는 `window_started_at < now - 10분` 기준으로 지운다. `worker/wrangler.toml`에는 한국 시간 자정 직후인 UTC `15:17` 일일 실행을 추가한다.

```toml
[triggers]
crons = ["17 15 * * *"]

[vars]
RSVP_ALLOWED_ORIGINS = "https://po-mato.github.io,http://localhost:5173,http://127.0.0.1:5173"
```

- [ ] **Step 4: 예약 삭제와 전체 Worker 검증**

```bash
pnpm --filter @wedding-game/worker test -- cleanup.test.ts http.test.ts index.test.ts
pnpm --filter @wedding-game/worker test
pnpm --filter @wedding-game/worker typecheck
```

예상: origin 제한, 예약 삭제, 반복 실행과 기존 Worker 테스트가 통과한다.

- [ ] **Step 5: 예약 삭제 커밋**

```bash
git add worker/src/cleanup.ts worker/src/cleanup.test.ts worker/src/http.ts worker/src/http.test.ts worker/src/index.ts worker/src/index.test.ts worker/wrangler.toml
git commit -m "feat: expire RSVP data and restrict API origins"
```

---

### Task 7: 클라이언트 RSVP API, 저장소와 CSV

**파일:**
- 수정: `client/src/api/weddingApi.ts`
- 수정: `client/src/api/weddingApi.test.ts`
- 생성: `client/src/invitation/rsvpStorage.ts`
- 생성: `client/src/invitation/rsvpStorage.test.ts`
- 생성: `client/src/invitation/rsvpCsv.ts`
- 생성: `client/src/invitation/rsvpCsv.test.ts`

**인터페이스:**
- 생성 API: `createRsvp`, `fetchOwnedRsvp`, `updateOwnedRsvp`, `createAdminSession`, `fetchAdminRsvps`, `deleteAdminRsvp`
- 생성 오류: `WeddingApiError { status, code, retryAfterSeconds }`
- 생성 저장소: `load/save/clearRsvpCredential`, `load/save/clearAdminSession`
- 생성 CSV: `buildRsvpCsv(result): string`, `downloadRsvpCsv(result): void`

- [ ] **Step 1: HTTP, 저장소와 CSV 실패 테스트 작성**

API 테스트는 POST/GET/PATCH/DELETE 메서드, `Authorization` 헤더, `409` 오류 code와 `Retry-After` 파싱을 검사한다. 저장소 테스트는 invitation별 키 분리와 손상된 JSON 자동 제거를 검사한다.

CSV 테스트는 다음 계약을 사용한다.

```ts
const csv = buildRsvpCsv(result);
expect(csv.startsWith("\uFEFF대상,이름,연락처")).toBe(true);
expect(csv).toContain("\r\n");
expect(csv).toContain("'=HYPERLINK");
expect(csv).not.toContain("editToken");
```

- [ ] **Step 2: 신규 client API와 utility 부재로 실패 확인**

```bash
pnpm --filter @wedding-game/client test -- weddingApi.test.ts rsvpStorage.test.ts rsvpCsv.test.ts
```

예상: 신규 export와 모듈을 찾지 못해 실패한다.

- [ ] **Step 3: 구조화 API와 브라우저 utility 구현**

저장 키는 다음과 같이 고정한다.

```ts
const credentialKey = (invitationId: string) => `wedding:rsvp:${invitationId}`;
const adminSessionKey = (invitationId: string) => `wedding:rsvp-admin:${invitationId}`;
```

하객 credential은 `{ rsvpId, editToken }`, 관리자 session은 `{ token, expiresAt }`만 저장한다. `localStorage`와 `sessionStorage` 접근 실패는 throw하지 않고 null/false로 처리한다.

API 오류는 JSON의 `error`와 HTTP status를 보존한다. `fetchOwnedRsvp`와 `updateOwnedRsvp`는 edit token, 관리자 함수는 admin token을 Bearer header에 넣는다. CSV는 RFC 4180 quoting, UTF-8 BOM, CRLF, 수식 시작 문자 이스케이프를 적용한다.

- [ ] **Step 4: 클라이언트 utility 테스트와 타입 검사 통과 확인**

```bash
pnpm --filter @wedding-game/client test -- weddingApi.test.ts rsvpStorage.test.ts rsvpCsv.test.ts
pnpm --filter @wedding-game/client typecheck
```

예상: API 요청, 저장 복구와 CSV 보안 테스트가 통과한다.

- [ ] **Step 5: 클라이언트 기반 모듈 커밋**

```bash
git add client/src/api/weddingApi.ts client/src/api/weddingApi.test.ts client/src/invitation/rsvpStorage.ts client/src/invitation/rsvpStorage.test.ts client/src/invitation/rsvpCsv.ts client/src/invitation/rsvpCsv.test.ts
git commit -m "feat: add RSVP client data utilities"
```

---

### Task 8: 하객 실사용 RSVP 하단 시트

**파일:**
- 수정: `client/src/components/RsvpForm.tsx`
- 수정: `client/src/components/RsvpForm.test.tsx`
- 생성: `client/src/components/RsvpPanel.tsx`
- 생성: `client/src/components/RsvpPanel.test.tsx`
- 수정: `client/src/components/SpotModal.tsx`
- 수정: `client/src/components/GameWorld.test.tsx`
- 수정: `client/src/styles.css`
- 수정: `client/src/styles.test.ts`

**인터페이스:**
- `RsvpForm({ initialValue, policy, submitLabel, onSubmit })`
- `RsvpPanel()`가 API와 저장소를 소유
- `SpotModal`은 `spotId === "rsvp"`일 때 `RsvpPanel` 렌더링

- [ ] **Step 1: 조건부 폼과 상태 흐름 실패 테스트 작성**

`RsvpForm.test.tsx`에서 다음을 검증한다.

```ts
expect(screen.getByRole("radiogroup", { name: "어느 분의 하객인가요?" })).toBeInTheDocument();
expect(screen.getByLabelText("연락처")).toHaveAttribute("type", "tel");
fireEvent.click(screen.getByLabelText("불참"));
expect(screen.queryByLabelText("본인 포함 참석 인원")).not.toBeInTheDocument();
expect(screen.queryByRole("radiogroup", { name: "식사 여부" })).not.toBeInTheDocument();
expect(screen.getByRole("button", { name: "참석 답변 보내기" })).toBeDisabled();
fireEvent.click(screen.getByLabelText(/개인정보 수집/));
expect(screen.getByRole("button", { name: "참석 답변 보내기" })).toBeEnabled();
```

`RsvpPanel.test.tsx`는 credential 없음의 신규 폼, credential 있음의 loading→summary, 수정 성공, `401/404` 저장값 제거, `409` 최신 응답 재조회, 실패 시 폼 값 유지와 중복 제출 차단을 검사한다.

`GameWorld.test.tsx`는 초대장 메뉴의 `답변하기`와 월드 RSVP 장소가 같은 시트를 열고, 폼 클릭·입력 중 캐릭터 위치가 변하지 않는지 검사한다.

- [ ] **Step 2: 신규 폼 요구사항과 panel 부재로 실패 확인**

```bash
pnpm --filter @wedding-game/client test -- RsvpForm.test.tsx RsvpPanel.test.tsx GameWorld.test.tsx
```

예상: 신규 필드·조건부 UI·요약 panel이 없어 실패한다.

- [ ] **Step 3: 폼과 상태 machine 구현**

`RsvpPanel` 상태를 다음 union으로 제한한다.

```ts
type PanelState =
  | { kind: "loading" }
  | { kind: "new" }
  | { kind: "summary"; response: RsvpRecord }
  | { kind: "editing"; response: RsvpRecord }
  | { kind: "error"; message: string; recoverTo: "new" | "summary" };
```

폼은 radio/segmented control을 사용하고 참석 상태 변경 시 canonical 값으로 즉시 정리한다. 국내 번호는 입력 중 읽기 좋은 형식으로 보이되 API에는 `normalizeRsvpPhone` 결과를 보낸다. 동의 문구에는 수집 목적, 2027년 5월 31일 삭제와 consent version을 연결한다.

마감 전에는 `2027년 4월 24일까지 알려주세요`, 이후에는 `마감일이 지났지만 답변을 보내실 수 있습니다`를 표시한다. 완료 요약은 대상, 이름, 연락처, 참석 상태, 적용 가능한 인원·식사, 전달사항, 수정 시각과 `답변 수정` 버튼을 제공한다.

- [ ] **Step 4: 하객 UI와 회귀 테스트 통과 확인**

```bash
pnpm --filter @wedding-game/client test -- RsvpForm.test.tsx RsvpPanel.test.tsx GameWorld.test.tsx styles.test.ts
pnpm --filter @wedding-game/client typecheck
```

예상: 하객 제출·복원·수정·오류·입력 차단과 기존 월드 테스트가 통과한다.

- [ ] **Step 5: 하객 UI 커밋**

```bash
git add client/src/components/RsvpForm.tsx client/src/components/RsvpForm.test.tsx client/src/components/RsvpPanel.tsx client/src/components/RsvpPanel.test.tsx client/src/components/SpotModal.tsx client/src/components/GameWorld.test.tsx client/src/styles.css client/src/styles.test.ts
git commit -m "feat: build editable guest RSVP flow"
```

---

### Task 9: 비공개 RSVP 관리자 화면

**파일:**
- 생성: `client/src/components/RsvpAdminPage.tsx`
- 생성: `client/src/components/RsvpAdminPage.test.tsx`
- 수정: `client/src/App.tsx`
- 생성: `client/src/App.test.tsx`
- 수정: `client/src/styles.css`
- 수정: `client/src/styles.test.ts`

**인터페이스:**
- `RsvpAdminPage`가 session, 목록, 필터와 삭제 상태 소유
- `App`은 `new URLSearchParams(window.location.search).get("admin") === "rsvp"`일 때 관리자 화면 렌더링

- [ ] **Step 1: 관리자 진입과 운영 흐름 실패 테스트 작성**

다음 흐름을 Testing Library로 작성한다.

```ts
window.history.replaceState({}, "", "/?admin=rsvp");
render(<App />);
expect(screen.getByRole("heading", { name: "참석 답변 관리" })).toBeInTheDocument();
expect(screen.queryByRole("button", { name: "정원 입장" })).not.toBeInTheDocument();

fireEvent.change(screen.getByLabelText("관리자 비밀번호"), { target: { value: "correct" } });
fireEvent.click(screen.getByRole("button", { name: "로그인" }));
expect(await screen.findByText("참석 확정 총인원")).toBeInTheDocument();
```

추가로 세션 복원, 만료 재로그인, 이름·연락처 검색, side·attendance·meal 필터, 필터 초기화, 삭제 확인/취소, 삭제 후 집계 갱신, CSV 버튼 호출을 검사한다.

- [ ] **Step 2: 관리자 page 부재로 실패 확인**

```bash
pnpm --filter @wedding-game/client test -- RsvpAdminPage.test.tsx App.test.tsx
```

예상: 관리자 query에서도 입장 화면이 렌더링되어 실패한다.

- [ ] **Step 3: 로그인·대시보드·목록 구현**

관리자 상태는 `signed-out | signing-in | loading | ready | error`로 제한한다. API `401`은 session을 지우고 로그인으로, `429`는 재시도 시간을 표시하고 로그인 버튼을 일시 비활성화한다.

집계 영역은 전체 데이터 기준이며 검색·필터는 목록에만 적용한다. 데스크톱 표 열은 `대상/이름/연락처/상태/인원/식사/전달사항/수정/관리` 순서다. 모바일은 같은 정보를 라벨과 값의 행으로 바꾸며 카드 중첩을 사용하지 않는다. 삭제는 대상 이름을 포함한 확인 대화 후 실행한다.

CSV 버튼은 필터와 무관하게 서버에서 받은 전체 `RsvpAdminResult`를 `downloadRsvpCsv`에 전달한다.

- [ ] **Step 4: 관리자 UI·반응형·타입 검사 통과 확인**

```bash
pnpm --filter @wedding-game/client test -- RsvpAdminPage.test.tsx App.test.tsx styles.test.ts
pnpm --filter @wedding-game/client typecheck
```

예상: 관리자 로그인, 집계, 목록, 필터, 삭제, CSV와 query 진입 테스트가 통과한다.

- [ ] **Step 5: 관리자 화면 커밋**

```bash
git add client/src/components/RsvpAdminPage.tsx client/src/components/RsvpAdminPage.test.tsx client/src/App.tsx client/src/App.test.tsx client/src/styles.css client/src/styles.test.ts
git commit -m "feat: add private RSVP dashboard"
```

---

### Task 10: 전체 회귀, 실브라우저 검증과 배포

**파일:**
- 생성하지 않음: 운영 비밀번호와 세션 키는 파일로 만들지 않음

**인터페이스:**
- Worker secrets: `RSVP_ADMIN_PASSWORD_HASH`, `RSVP_ADMIN_SESSION_SECRET`, `RSVP_CLIENT_KEY_SECRET`
- Worker variable: `RSVP_ALLOWED_ORIGINS=https://po-mato.github.io,http://localhost:5173,http://127.0.0.1:5173`

- [ ] **Step 1: 전체 자동 검증 실행**

```bash
pnpm test
pnpm typecheck
pnpm build
git diff --check
```

예상: 맵 23개, 캐릭터 자산, shared, client, worker 전체 테스트와 타입 검사, 프로덕션 빌드가 모두 통과한다.

- [ ] **Step 2: 로컬 Worker·클라이언트 통합 검증**

터미널 1:

```bash
pnpm db:migrate:local
pnpm dev:worker
```

터미널 2:

```bash
VITE_WORKER_URL=http://127.0.0.1:8787 VITE_INVITATION_ID=sample-garden pnpm dev -- --host 127.0.0.1 --port 5173 --strictPort
```

브라우저에서 320x568, 390x844, 844x390과 데스크톱으로 신규 제출, 새로고침 후 요약, 수정, 메뉴·월드 두 진입점, 관리자 로그인·필터·CSV·삭제를 확인한다. 개발자 콘솔 오류, 가로 스크롤, 게임 이동 오염이 없어야 한다.

- [ ] **Step 3: 운영 D1 백업**

```bash
mkdir -p .superpowers/backups
pnpm --filter @wedding-game/worker exec wrangler d1 export wedding-game-invitation --remote --output .superpowers/backups/wedding-game-invitation-pre-rsvp.sql
```

예상: 비어 있지 않은 SQL 백업 파일이 생성된다. 백업 파일은 git에 추가하지 않는다.

- [ ] **Step 4: Worker Secret과 origin 설정**

사용자에게 관리자 비밀번호를 터미널의 비표시 입력으로 받은 뒤 Task 3의 스크립트로 PBKDF2 해시를 생성한다. 임시 파일에는 해시만 기록하고 secret 설정 직후 삭제한다. 세션 키와 client-key HMAC 키는 각각 OpenSSL로 생성한 32 byte 무작위 값을 직접 secret 입력으로 전달한다.

```bash
printf "RSVP 관리자 비밀번호: "
read -s RSVP_ADMIN_PASSWORD
printf "\n"
RSVP_ADMIN_PASSWORD="$RSVP_ADMIN_PASSWORD" node scripts/hash-rsvp-admin-password.mjs > /tmp/rsvp-admin-password-hash
unset RSVP_ADMIN_PASSWORD
pnpm --filter @wedding-game/worker exec wrangler secret put RSVP_ADMIN_PASSWORD_HASH < /tmp/rsvp-admin-password-hash
rm -f /tmp/rsvp-admin-password-hash
openssl rand -hex 32 | pnpm --filter @wedding-game/worker exec wrangler secret put RSVP_ADMIN_SESSION_SECRET
openssl rand -hex 32 | pnpm --filter @wedding-game/worker exec wrangler secret put RSVP_CLIENT_KEY_SECRET
```

`worker/wrangler.toml`의 `[vars]`에 Task 6에서 다음 공개 origin만 기록됐는지 확인한다.

```toml
[vars]
RSVP_ALLOWED_ORIGINS = "https://po-mato.github.io,http://localhost:5173,http://127.0.0.1:5173"
```

- [ ] **Step 5: 운영 D1과 Worker 순차 배포**

```bash
pnpm --filter @wedding-game/worker exec wrangler d1 migrations apply wedding-game-invitation --remote
pnpm --filter @wedding-game/worker exec wrangler deploy
```

예상: 0003 마이그레이션과 Worker 배포가 성공하고 cron trigger가 표시된다. 운영 API에서 허용 origin preflight는 204, 임의 origin은 403이어야 한다.

- [ ] **Step 6: 작업 트리 확인과 GitHub Pages 배포**

```bash
git status --short
git push origin main
gh run watch --exit-status
```

`git status`에서 계획한 기능 파일이 모두 커밋됐고 기존 미추적 캐릭터 원본과 `.superpowers/sdd` 보고서가 스테이징되지 않았는지 확인한 뒤 앞 작업의 커밋을 푸시한다.

- [ ] **Step 7: 공개 환경 최종 확인**

공개 주소 `https://po-mato.github.io/pixel-garden-invitation/`와 `?admin=rsvp`에서 다음을 확인한다.

- 신규 RSVP 제출과 완료 요약
- 새로고침 후 같은 응답 조회
- 수정 후 revision과 수정 시각 갱신
- 초대장 메뉴와 월드 RSVP 지점의 동일 흐름
- 관리자 로그인, 전체 집계, 필터, CSV, 삭제
- 잘못된 관리자 비밀번호와 만료 session 처리
- 일정 저장, 오시는 길, 방명록과 맵 이동 회귀
- 공개 JS·CSS hash가 성공한 GitHub Actions 산출물과 일치

- [ ] **Step 8: 완료 상태 기록**

계획 체크박스를 모두 갱신하고 테스트 수, Worker 배포 버전, D1 마이그레이션 결과, GitHub Pages run URL, 공개 asset hash와 실브라우저 확인 결과를 작업 보고서에 기록한다. 운영 비밀번호, 해시, 세션 키와 하객 개인정보는 기록하지 않는다.
