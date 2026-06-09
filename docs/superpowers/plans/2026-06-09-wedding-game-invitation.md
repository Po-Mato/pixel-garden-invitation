# Wedding Game Invitation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the MVP for a mobile-first pixel garden wedding invitation with real-time guest presence, in-world RSVP, guestbook, story, gallery, and low-cost Cloudflare hosting.

**Architecture:** Use an npm workspace with three packages: `shared` for protocol/types/validation, `client` for the React/Vite static game app, and `worker` for Cloudflare Worker, Durable Object, and D1 endpoints. The client can run in offline solo mode, then connects to a Worker WebSocket room for real-time guest presence and Worker HTTP endpoints for saved RSVP/guestbook data.

**Tech Stack:** TypeScript, React, Vite, Vitest, Testing Library, Cloudflare Workers, Durable Objects, D1, Wrangler, GitHub Pages-compatible static build.

---

## Project Root

All paths are relative to:

`/Users/sjlee/Documents/New project 5`

## File Structure

Create this structure:

```text
package.json
tsconfig.base.json
.gitignore
docs/superpowers/plans/2026-06-09-wedding-game-invitation.md
docs/superpowers/specs/2026-06-09-wedding-game-invitation-design.md
shared/package.json
shared/tsconfig.json
shared/src/content.test.ts
shared/src/content.ts
shared/src/index.ts
shared/src/protocol.ts
shared/src/validation.ts
shared/src/validation.test.ts
client/package.json
client/index.html
client/tsconfig.json
client/vite.config.ts
client/src/App.tsx
client/src/main.tsx
client/src/styles.css
client/src/api/weddingApi.ts
client/src/components/BottomSheet.tsx
client/src/components/EntryScreen.test.tsx
client/src/components/EntryScreen.tsx
client/src/components/GameWorld.test.tsx
client/src/components/GameWorld.tsx
client/src/components/GuestbookPanel.test.tsx
client/src/components/GuestbookPanel.tsx
client/src/components/PixelAvatar.tsx
client/src/components/RsvpForm.test.tsx
client/src/components/RsvpForm.tsx
client/src/components/SpotModal.tsx
client/src/components/VirtualJoystick.test.tsx
client/src/components/VirtualJoystick.tsx
client/src/game/geometry.ts
client/src/game/geometry.test.ts
client/src/game/movement.ts
client/src/game/movement.test.ts
client/src/game/world.ts
client/src/realtime/realtimeClient.ts
client/src/realtime/realtimeClient.test.ts
client/src/test/setup.ts
worker/package.json
worker/tsconfig.json
worker/vitest.config.ts
worker/wrangler.toml
worker/migrations/0001_init.sql
worker/src/GardenRoom.test.ts
worker/src/GardenRoom.ts
worker/src/http.test.ts
worker/src/http.ts
worker/src/index.ts
worker/src/rateLimit.ts
worker/src/rateLimit.test.ts
worker/src/validation.ts
worker/src/validation.test.ts
```

Boundary rules:

- `shared` contains data contracts and validation helpers used by both client and Worker.
- `client` contains UI, local movement, spot interactions, and browser WebSocket/HTTP adapters.
- `worker` contains all Cloudflare runtime code, D1 writes, rate limiting, and room state.
- Do not put Worker secrets, Cloudflare account IDs, or generated deployment credentials in git.

## Execution Order

Run tasks in numeric order. Task 14A is part of the client movement work and must be completed immediately after Task 14, before Task 15 deployment configuration.

---

### Task 1: Workspace And Tooling

**Files:**
- Create: `package.json`
- Create: `tsconfig.base.json`
- Modify: `.gitignore`

- [ ] **Step 1: Write root workspace configuration**

Create `package.json`:

```json
{
  "name": "wedding-game-invitation",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "workspaces": [
    "shared",
    "client",
    "worker"
  ],
  "scripts": {
    "dev": "npm run dev -w client",
    "dev:worker": "npm run dev -w worker",
    "build": "npm run build -w shared && npm run build -w client && npm run build -w worker",
    "test": "npm run test -w shared && npm run test -w client && npm run test -w worker",
    "typecheck": "npm run typecheck -w shared && npm run typecheck -w client && npm run typecheck -w worker"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "typescript": "^5.5.0"
  }
}
```

- [ ] **Step 2: Write shared TypeScript base config**

Create `tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true
  }
}
```

- [ ] **Step 3: Update ignore rules**

Modify `.gitignore` so it contains:

```gitignore
.superpowers/
node_modules/
dist/
.wrangler/
.dev.vars
client/dist/
worker/dist/
coverage/
*.local
```

- [ ] **Step 4: Install workspace dependencies**

Run:

```bash
npm install
```

Expected: npm creates `package-lock.json` and exits with code 0.

- [ ] **Step 5: Run baseline commands**

Run:

```bash
npm run typecheck
```

Expected: FAIL because workspace packages do not exist yet.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.base.json .gitignore
git commit -m "chore: set up npm workspace"
```

---

### Task 2: Shared Protocol And Validation

**Files:**
- Create: `shared/package.json`
- Create: `shared/src/protocol.ts`
- Create: `shared/src/validation.ts`
- Create: `shared/src/index.ts`
- Create: `shared/src/validation.test.ts`

- [ ] **Step 1: Create shared package config**

Create `shared/package.json`:

```json
{
  "name": "@wedding-game/shared",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "devDependencies": {
    "vitest": "^4.1.8"
  }
}
```

Create `shared/tsconfig.json`:

```json
{
  "extends": "../tsconfig.base.json",
  "include": ["src"]
}
```

- [ ] **Step 2: Write failing validation tests**

Create `shared/src/validation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { clampNumber, parseClientMessage, sanitizeText } from "./validation";

describe("sanitizeText", () => {
  it("trims text and limits length", () => {
    expect(sanitizeText("  garden guest  ", 20)).toBe("garden guest");
    expect(sanitizeText("abcdef", 3)).toBe("abc");
  });

  it("removes control characters", () => {
    expect(sanitizeText("hi\u0000there\u001f", 20)).toBe("hithere");
  });
});

describe("clampNumber", () => {
  it("clamps to map bounds", () => {
    expect(clampNumber(-5, 0, 100)).toBe(0);
    expect(clampNumber(105, 0, 100)).toBe(100);
    expect(clampNumber(50, 0, 100)).toBe(50);
  });
});

describe("parseClientMessage", () => {
  it("accepts a valid join message", () => {
    expect(parseClientMessage({
      type: "join",
      nickname: "민지",
      avatar: "classic",
      color: "rose"
    })).toEqual({
      type: "join",
      nickname: "민지",
      avatar: "classic",
      color: "rose"
    });
  });

  it("rejects malformed messages", () => {
    expect(parseClientMessage({ type: "move", x: "bad" })).toBeNull();
    expect(parseClientMessage({ type: "unknown" })).toBeNull();
  });
});
```

- [ ] **Step 3: Run tests to verify failure**

Run:

```bash
npm run test -w shared
```

Expected: FAIL with imports from `./validation` not found.

- [ ] **Step 4: Add protocol types**

Create `shared/src/protocol.ts`:

```ts
export type AvatarType = "classic" | "suit" | "dress" | "hanbok";
export type AvatarColor = "rose" | "leaf" | "sky" | "gold" | "soil";
export type Direction = "up" | "down" | "left" | "right";

export type GuestProfile = {
  guestId: string;
  nickname: string;
  avatar: AvatarType;
  color: AvatarColor;
};

export type PositionState = {
  x: number;
  y: number;
  direction: Direction;
  moving: boolean;
  seq: number;
};

export type RoomGuest = GuestProfile & PositionState & {
  lastSeenAt: number;
};

export type ClientMessage =
  | { type: "join"; nickname: string; avatar: AvatarType; color: AvatarColor }
  | { type: "move"; x: number; y: number; direction: Direction; moving: boolean; seq: number }
  | { type: "ping" }
  | { type: "leave" };

export type ServerMessage =
  | { type: "welcome"; guestId: string; guests: RoomGuest[] }
  | { type: "guest_joined"; guest: RoomGuest }
  | { type: "guest_moved"; guestId: string; position: PositionState }
  | { type: "guest_left"; guestId: string }
  | { type: "room_state"; guests: RoomGuest[] }
  | { type: "error"; code: "bad_message" | "room_full" | "rate_limited" };
```

- [ ] **Step 5: Add validation helpers**

Create `shared/src/validation.ts`:

```ts
import type { AvatarColor, AvatarType, ClientMessage, Direction } from "./protocol";

const avatarTypes = new Set<AvatarType>(["classic", "suit", "dress", "hanbok"]);
const avatarColors = new Set<AvatarColor>(["rose", "leaf", "sky", "gold", "soil"]);
const directions = new Set<Direction>(["up", "down", "left", "right"]);

export function sanitizeText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, maxLength);
}

export function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseClientMessage(value: unknown): ClientMessage | null {
  if (!isRecord(value) || typeof value.type !== "string") return null;

  if (value.type === "join") {
    const nickname = sanitizeText(value.nickname, 16);
    if (!nickname) return null;
    if (!avatarTypes.has(value.avatar as AvatarType)) return null;
    if (!avatarColors.has(value.color as AvatarColor)) return null;
    return {
      type: "join",
      nickname,
      avatar: value.avatar as AvatarType,
      color: value.color as AvatarColor
    };
  }

  if (value.type === "move") {
    if (typeof value.x !== "number" || typeof value.y !== "number") return null;
    if (!directions.has(value.direction as Direction)) return null;
    if (typeof value.moving !== "boolean") return null;
    if (typeof value.seq !== "number" || !Number.isInteger(value.seq)) return null;
    return {
      type: "move",
      x: value.x,
      y: value.y,
      direction: value.direction as Direction,
      moving: value.moving,
      seq: value.seq
    };
  }

  if (value.type === "ping") return { type: "ping" };
  if (value.type === "leave") return { type: "leave" };
  return null;
}
```

- [ ] **Step 6: Export shared API**

Create `shared/src/index.ts`:

```ts
export * from "./protocol";
export * from "./validation";
```

- [ ] **Step 7: Run shared checks**

Run:

```bash
npm run test -w shared
npm run typecheck -w shared
```

Expected: both commands exit with code 0.

- [ ] **Step 8: Commit**

```bash
git add shared package-lock.json
git commit -m "feat: add shared realtime protocol"
```

---

### Task 3: Shared Wedding Content Seed

**Files:**
- Create: `shared/src/content.ts`
- Modify: `shared/src/index.ts`

- [ ] **Step 1: Add content test**

Create `shared/src/content.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { invitationContent } from "./content";

describe("invitationContent", () => {
  it("contains every MVP world spot", () => {
    expect(invitationContent.spots.map((spot) => spot.id)).toEqual([
      "wedding-info",
      "directions",
      "rsvp",
      "guestbook",
      "couple",
      "gallery",
      "story"
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
npm run test -w shared
```

Expected: FAIL because `shared/src/content.ts` does not exist.

- [ ] **Step 3: Add seed content**

Create `shared/src/content.ts`:

```ts
export type SpotId =
  | "wedding-info"
  | "directions"
  | "rsvp"
  | "guestbook"
  | "couple"
  | "gallery"
  | "story";

export type InvitationSpot = {
  id: SpotId;
  title: string;
  actionLabel: string;
  body: string;
};

export const invitationContent = {
  coupleNames: "이서준 & 김하린",
  weddingDate: "2027-05-15",
  weddingTime: "토요일 오후 1시",
  venueName: "라온가든 웨딩홀",
  venueAddress: "서울특별시 강남구 테헤란로 123",
  spots: [
    {
      id: "wedding-info",
      title: "예식 안내",
      actionLabel: "예식 보기",
      body: "2027년 5월 15일 토요일 오후 1시, 라온가든 웨딩홀에서 예식이 진행됩니다."
    },
    {
      id: "directions",
      title: "오시는 길",
      actionLabel: "길 찾기",
      body: "지하철 2호선 역삼역 3번 출구에서 도보 7분입니다. 주차는 웨딩홀 지하 주차장을 이용해 주세요."
    },
    {
      id: "rsvp",
      title: "참석 답변",
      actionLabel: "답변하기",
      body: "참석 여부와 동행 인원을 알려주세요."
    },
    {
      id: "guestbook",
      title: "방명록 우체통",
      actionLabel: "축하 쓰기",
      body: "두 사람에게 축하 메시지를 남겨주세요."
    },
    {
      id: "couple",
      title: "신랑신부 정원",
      actionLabel: "소개 보기",
      body: "서로의 계절을 함께 걷기로 한 두 사람을 소개합니다."
    },
    {
      id: "gallery",
      title: "사진 갤러리",
      actionLabel: "사진 보기",
      body: "두 사람이 함께한 순간들을 모았습니다."
    },
    {
      id: "story",
      title: "연애 스토리 꽃길",
      actionLabel: "스토리 보기",
      body: "첫 만남부터 결혼식까지 이어진 이야기를 따라 걸어보세요."
    }
  ] satisfies InvitationSpot[]
};
```

Modify `shared/src/index.ts`:

```ts
export * from "./content";
export * from "./protocol";
export * from "./validation";
```

- [ ] **Step 4: Run shared checks**

Run:

```bash
npm run test -w shared
npm run typecheck -w shared
```

Expected: both commands exit with code 0.

- [ ] **Step 5: Commit**

```bash
git add shared/src/content.ts shared/src/content.test.ts shared/src/index.ts
git commit -m "feat: add invitation seed content"
```

---

### Task 4: Client Scaffold

**Files:**
- Create: `client/package.json`
- Create: `client/index.html`
- Create: `client/tsconfig.json`
- Create: `client/vite.config.ts`
- Create: `client/src/main.tsx`
- Create: `client/src/App.tsx`
- Create: `client/src/styles.css`
- Create: `client/src/test/setup.ts`

- [ ] **Step 1: Create client package config**

Create `client/package.json`:

```json
{
  "name": "@wedding-game/client",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -p tsconfig.json && vite build",
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@vitejs/plugin-react": "^4.3.0",
    "@wedding-game/shared": "file:../shared",
    "vite": "^5.4.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.4.0",
    "@testing-library/react": "^15.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "jsdom": "^24.1.0",
    "typescript": "^5.5.0",
    "vitest": "^4.1.8"
  }
}
```

Create `client/tsconfig.json`:

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src", "vite.config.ts"]
}
```

Create `client/vite.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["src/test/setup.ts"]
  }
});
```

- [ ] **Step 2: Create HTML and React entry**

Create `client/index.html`:

```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>Garden Wedding Invitation</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Create `client/src/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

Create `client/src/main.tsx`:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

Create `client/src/App.tsx`:

```tsx
export function App() {
  return (
    <main className="app-shell">
      <section className="phone-frame">
        <h1>Garden Wedding</h1>
        <p>픽셀 정원 청첩장을 준비하고 있습니다.</p>
      </section>
    </main>
  );
}
```

Create `client/src/styles.css`:

```css
:root {
  color: #29211e;
  background: #fffaf1;
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
}

button,
input,
textarea,
select {
  font: inherit;
}

.app-shell {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 20px;
  background:
    radial-gradient(circle at 15% 10%, rgba(216, 117, 121, 0.18), transparent 28%),
    radial-gradient(circle at 85% 0%, rgba(97, 125, 88, 0.18), transparent 30%),
    linear-gradient(180deg, #fffaf1, #efe4d5);
}

.phone-frame {
  width: min(100%, 430px);
  min-height: min(780px, calc(100vh - 40px));
  padding: 24px;
  border: 8px solid #2f2926;
  border-radius: 32px;
  background: #fff9ec;
  box-shadow: 0 28px 72px rgba(55, 42, 34, 0.22);
}
```

- [ ] **Step 3: Install client dependencies**

Run:

```bash
npm install
```

Expected: exits with code 0 and updates `package-lock.json`.

- [ ] **Step 4: Run client checks**

Run:

```bash
npm run typecheck -w client
npm run build -w client
```

Expected: both commands exit with code 0.

- [ ] **Step 5: Commit**

```bash
git add client package-lock.json
git commit -m "feat: scaffold client app"
```

---

### Task 5: World Geometry And Movement

**Files:**
- Create: `client/src/game/world.ts`
- Create: `client/src/game/geometry.ts`
- Create: `client/src/game/geometry.test.ts`
- Create: `client/src/game/movement.ts`
- Create: `client/src/game/movement.test.ts`

- [ ] **Step 1: Write failing geometry tests**

Create `client/src/game/geometry.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getNearbySpot, isBlocked, clampToWorld } from "./geometry";
import { gardenWorld } from "./world";

describe("world geometry", () => {
  it("clamps the player inside the world", () => {
    expect(clampToWorld({ x: -10, y: 900 }, gardenWorld.bounds)).toEqual({ x: 0, y: 720 });
  });

  it("detects blocked booth rectangles", () => {
    expect(isBlocked({ x: 180, y: 96 }, gardenWorld)).toBe(true);
    expect(isBlocked({ x: 210, y: 340 }, gardenWorld)).toBe(false);
  });

  it("finds the nearest actionable spot", () => {
    expect(getNearbySpot({ x: 200, y: 114 }, gardenWorld)?.id).toBe("wedding-info");
    expect(getNearbySpot({ x: 210, y: 340 }, gardenWorld)).toBeNull();
  });
});
```

- [ ] **Step 2: Write failing movement tests**

Create `client/src/game/movement.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { computeNextPosition, directionFromVector } from "./movement";
import { gardenWorld } from "./world";

describe("movement", () => {
  it("moves toward a target with a fixed speed", () => {
    expect(computeNextPosition({
      current: { x: 100, y: 100 },
      target: { x: 130, y: 100 },
      deltaMs: 100,
      speed: 120,
      world: gardenWorld
    })).toEqual({ x: 112, y: 100 });
  });

  it("stops when close to target", () => {
    expect(computeNextPosition({
      current: { x: 100, y: 100 },
      target: { x: 103, y: 100 },
      deltaMs: 100,
      speed: 120,
      world: gardenWorld
    })).toEqual({ x: 103, y: 100 });
  });

  it("returns a direction from a joystick vector", () => {
    expect(directionFromVector({ x: 0, y: -1 })).toBe("up");
    expect(directionFromVector({ x: 2, y: 0.5 })).toBe("right");
  });
});
```

- [ ] **Step 3: Run tests to verify failure**

Run:

```bash
npm run test -w client -- client/src/game
```

Expected: FAIL because `geometry`, `movement`, and `world` modules do not exist.

- [ ] **Step 4: Add world model**

Create `client/src/game/world.ts`:

```ts
import type { SpotId } from "@wedding-game/shared";

export type Point = { x: number; y: number };
export type Rect = { x: number; y: number; width: number; height: number };

export type WorldSpot = Rect & {
  id: SpotId;
  label: string;
  actionRadius: number;
};

export type GardenWorld = {
  bounds: Rect;
  spawn: Point;
  blocked: Rect[];
  spots: WorldSpot[];
};

export const gardenWorld: GardenWorld = {
  bounds: { x: 0, y: 0, width: 390, height: 720 },
  spawn: { x: 195, y: 520 },
  blocked: [
    { x: 150, y: 48, width: 90, height: 82 },
    { x: 34, y: 154, width: 82, height: 70 },
    { x: 274, y: 154, width: 82, height: 70 },
    { x: 34, y: 332, width: 82, height: 70 },
    { x: 274, y: 332, width: 82, height: 70 },
    { x: 34, y: 580, width: 82, height: 70 },
    { x: 274, y: 580, width: 82, height: 70 }
  ],
  spots: [
    { id: "wedding-info", label: "예식 안내", x: 150, y: 48, width: 90, height: 82, actionRadius: 64 },
    { id: "story", label: "스토리", x: 34, y: 154, width: 82, height: 70, actionRadius: 58 },
    { id: "couple", label: "신랑신부", x: 274, y: 154, width: 82, height: 70, actionRadius: 58 },
    { id: "gallery", label: "갤러리", x: 34, y: 332, width: 82, height: 70, actionRadius: 58 },
    { id: "guestbook", label: "방명록", x: 274, y: 332, width: 82, height: 70, actionRadius: 58 },
    { id: "directions", label: "오시는 길", x: 34, y: 580, width: 82, height: 70, actionRadius: 58 },
    { id: "rsvp", label: "RSVP", x: 274, y: 580, width: 82, height: 70, actionRadius: 58 }
  ]
};
```

- [ ] **Step 5: Add geometry helpers**

Create `client/src/game/geometry.ts`:

```ts
import type { GardenWorld, Point, Rect, WorldSpot } from "./world";

export function clampToWorld(point: Point, bounds: Rect): Point {
  return {
    x: Math.min(bounds.x + bounds.width, Math.max(bounds.x, point.x)),
    y: Math.min(bounds.y + bounds.height, Math.max(bounds.y, point.y))
  };
}

export function pointInRect(point: Point, rect: Rect): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

export function isBlocked(point: Point, world: GardenWorld): boolean {
  return world.blocked.some((rect) => pointInRect(point, rect));
}

function center(rect: Rect): Point {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function getNearbySpot(point: Point, world: GardenWorld): WorldSpot | null {
  return world.spots.find((spot) => distance(point, center(spot)) <= spot.actionRadius) ?? null;
}
```

- [ ] **Step 6: Add movement helpers**

Create `client/src/game/movement.ts`:

```ts
import type { Direction } from "@wedding-game/shared";
import { clampToWorld, isBlocked } from "./geometry";
import type { GardenWorld, Point } from "./world";

export type MoveInput = {
  current: Point;
  target: Point;
  deltaMs: number;
  speed: number;
  world: GardenWorld;
};

export function computeNextPosition(input: MoveInput): Point {
  const dx = input.target.x - input.current.x;
  const dy = input.target.y - input.current.y;
  const distance = Math.hypot(dx, dy);
  const maxStep = (input.speed * input.deltaMs) / 1000;

  if (distance <= maxStep) {
    return isBlocked(input.target, input.world)
      ? input.current
      : clampToWorld(input.target, input.world.bounds);
  }

  const next = clampToWorld({
    x: input.current.x + (dx / distance) * maxStep,
    y: input.current.y + (dy / distance) * maxStep
  }, input.world.bounds);

  return isBlocked(next, input.world) ? input.current : next;
}

export function directionFromVector(vector: Point): Direction {
  if (Math.abs(vector.x) > Math.abs(vector.y)) {
    return vector.x >= 0 ? "right" : "left";
  }
  return vector.y >= 0 ? "down" : "up";
}
```

- [ ] **Step 7: Run client game tests**

Run:

```bash
npm run test -w client -- client/src/game
```

Expected: all game tests pass.

- [ ] **Step 8: Commit**

```bash
git add client/src/game
git commit -m "feat: add garden world movement"
```

---

### Task 6: Entry Screen And Avatar Selection

**Files:**
- Create: `client/src/components/EntryScreen.tsx`
- Create: `client/src/components/PixelAvatar.tsx`
- Modify: `client/src/App.tsx`
- Modify: `client/src/styles.css`

- [ ] **Step 1: Write failing entry screen test**

Create `client/src/components/EntryScreen.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EntryScreen } from "./EntryScreen";

describe("EntryScreen", () => {
  it("submits nickname, avatar, and color", () => {
    const onEnter = vi.fn();
    render(<EntryScreen onEnter={onEnter} />);

    fireEvent.change(screen.getByLabelText("닉네임"), { target: { value: "하객1" } });
    fireEvent.click(screen.getByRole("button", { name: "드레스" }));
    fireEvent.click(screen.getByRole("button", { name: "하늘" }));
    fireEvent.click(screen.getByRole("button", { name: "정원 입장" }));

    expect(onEnter).toHaveBeenCalledWith({
      nickname: "하객1",
      avatar: "dress",
      color: "sky"
    });
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
npm run test -w client -- EntryScreen
```

Expected: FAIL because `EntryScreen` does not exist.

- [ ] **Step 3: Add avatar component**

Create `client/src/components/PixelAvatar.tsx`:

```tsx
import type { AvatarColor, AvatarType } from "@wedding-game/shared";

type PixelAvatarProps = {
  avatar: AvatarType;
  color: AvatarColor;
  label?: string;
  className?: string;
};

export function PixelAvatar({ avatar, color, label, className = "" }: PixelAvatarProps) {
  return (
    <div className={`pixel-avatar pixel-avatar--${avatar} pixel-avatar--${color} ${className}`} aria-label={label}>
      <span className="pixel-avatar__head" />
      <span className="pixel-avatar__body" />
    </div>
  );
}
```

- [ ] **Step 4: Add entry screen**

Create `client/src/components/EntryScreen.tsx`:

```tsx
import { useState } from "react";
import type { AvatarColor, AvatarType } from "@wedding-game/shared";
import { PixelAvatar } from "./PixelAvatar";

export type EntryProfile = {
  nickname: string;
  avatar: AvatarType;
  color: AvatarColor;
};

type EntryScreenProps = {
  onEnter: (profile: EntryProfile) => void;
};

const avatarOptions: Array<{ value: AvatarType; label: string }> = [
  { value: "classic", label: "클래식" },
  { value: "suit", label: "수트" },
  { value: "dress", label: "드레스" },
  { value: "hanbok", label: "한복" }
];

const colorOptions: Array<{ value: AvatarColor; label: string }> = [
  { value: "rose", label: "장미" },
  { value: "leaf", label: "잎새" },
  { value: "sky", label: "하늘" },
  { value: "gold", label: "금빛" },
  { value: "soil", label: "흙빛" }
];

export function EntryScreen({ onEnter }: EntryScreenProps) {
  const [nickname, setNickname] = useState("");
  const [avatar, setAvatar] = useState<AvatarType>("classic");
  const [color, setColor] = useState<AvatarColor>("rose");

  const canEnter = nickname.trim().length > 0;

  return (
    <section className="entry-screen">
      <div className="entry-screen__preview">
        <PixelAvatar avatar={avatar} color={color} label="선택한 캐릭터" />
      </div>
      <h1>서준 & 하린의 정원</h1>
      <label className="field">
        <span>닉네임</span>
        <input
          value={nickname}
          maxLength={16}
          onChange={(event) => setNickname(event.target.value)}
        />
      </label>
      <div className="choice-group" aria-label="캐릭터 선택">
        {avatarOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            className={avatar === option.value ? "choice choice--selected" : "choice"}
            onClick={() => setAvatar(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="choice-group" aria-label="색상 선택">
        {colorOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            className={color === option.value ? "choice choice--selected" : "choice"}
            onClick={() => setColor(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <button
        className="primary-button"
        type="button"
        disabled={!canEnter}
        onClick={() => onEnter({ nickname: nickname.trim(), avatar, color })}
      >
        정원 입장
      </button>
    </section>
  );
}
```

- [ ] **Step 5: Wire entry screen into App**

Modify `client/src/App.tsx`:

```tsx
import { useState } from "react";
import { EntryScreen, type EntryProfile } from "./components/EntryScreen";

export function App() {
  const [profile, setProfile] = useState<EntryProfile | null>(null);

  return (
    <main className="app-shell">
      <section className="phone-frame">
        {profile ? (
          <div className="entered-state">
            <h1>{profile.nickname}님, 환영합니다</h1>
            <p>정원 월드를 불러오는 중입니다.</p>
          </div>
        ) : (
          <EntryScreen onEnter={setProfile} />
        )}
      </section>
    </main>
  );
}
```

- [ ] **Step 6: Add entry styles**

Append to `client/src/styles.css`:

```css
.entry-screen {
  display: grid;
  gap: 18px;
  align-content: center;
  min-height: calc(100vh - 112px);
}

.entry-screen h1 {
  margin: 0;
  font-family: Georgia, "Times New Roman", serif;
  font-size: 34px;
  line-height: 1.1;
}

.entry-screen__preview {
  display: grid;
  place-items: center;
  min-height: 110px;
}

.field {
  display: grid;
  gap: 8px;
  color: #29211e;
  font-weight: 800;
}

.field input,
.field textarea,
.field select {
  width: 100%;
  border: 2px solid rgba(41, 33, 30, 0.22);
  border-radius: 8px;
  padding: 12px 14px;
  background: #fffaf1;
  color: #29211e;
}

.choice-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.choice,
.primary-button {
  border: 2px solid #2f2926;
  border-radius: 999px;
  padding: 10px 14px;
  background: #fffaf1;
  color: #29211e;
  font-weight: 900;
  box-shadow: 0 4px 0 rgba(41, 33, 30, 0.18);
}

.choice--selected,
.primary-button {
  background: #d87579;
  color: #fffaf1;
}

.primary-button:disabled {
  opacity: 0.45;
}

.pixel-avatar {
  position: relative;
  width: 30px;
  height: 34px;
  image-rendering: pixelated;
}

.pixel-avatar__head,
.pixel-avatar__body {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  border: 2px solid #2f2926;
}

.pixel-avatar__head {
  top: 0;
  width: 18px;
  height: 16px;
  background: #f1c3a4;
}

.pixel-avatar__body {
  bottom: 0;
  width: 24px;
  height: 20px;
  background: #d87579;
}

.pixel-avatar--leaf .pixel-avatar__body { background: #617d58; }
.pixel-avatar--sky .pixel-avatar__body { background: #5e9fb7; }
.pixel-avatar--gold .pixel-avatar__body { background: #c9983f; }
.pixel-avatar--soil .pixel-avatar__body { background: #9b7353; }
.pixel-avatar--suit .pixel-avatar__head { box-shadow: 0 -6px 0 #2f2926; }
.pixel-avatar--dress .pixel-avatar__body { border-radius: 2px 2px 10px 10px; }
.pixel-avatar--hanbok .pixel-avatar__body { box-shadow: inset 8px 0 0 rgba(255,255,255,0.35); }
```

- [ ] **Step 7: Run checks**

Run:

```bash
npm run test -w client -- EntryScreen
npm run typecheck -w client
```

Expected: both commands exit with code 0.

- [ ] **Step 8: Commit**

```bash
git add client/src
git commit -m "feat: add garden entry screen"
```

---

### Task 7: Garden World Rendering And Spot Modals

**Files:**
- Create: `client/src/components/BottomSheet.tsx`
- Create: `client/src/components/GameWorld.tsx`
- Create: `client/src/components/SpotModal.tsx`
- Modify: `client/src/App.tsx`
- Modify: `client/src/styles.css`

- [ ] **Step 1: Write failing world render test**

Create `client/src/components/GameWorld.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GameWorld } from "./GameWorld";

describe("GameWorld", () => {
  it("renders all MVP spots", () => {
    render(<GameWorld profile={{ nickname: "하객1", avatar: "classic", color: "rose" }} />);
    expect(screen.getByText("예식 안내")).toBeInTheDocument();
    expect(screen.getByText("오시는 길")).toBeInTheDocument();
    expect(screen.getByText("RSVP")).toBeInTheDocument();
    expect(screen.getByText("방명록")).toBeInTheDocument();
    expect(screen.getByText("신랑신부")).toBeInTheDocument();
    expect(screen.getByText("갤러리")).toBeInTheDocument();
    expect(screen.getByText("스토리")).toBeInTheDocument();
  });

  it("opens a spot modal from an action button", () => {
    render(<GameWorld profile={{ nickname: "하객1", avatar: "classic", color: "rose" }} />);
    fireEvent.click(screen.getByRole("button", { name: "예식 보기" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("예식 안내");
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
npm run test -w client -- GameWorld
```

Expected: FAIL because `GameWorld` does not exist.

- [ ] **Step 3: Add bottom sheet**

Create `client/src/components/BottomSheet.tsx`:

```tsx
import type { ReactNode } from "react";

type BottomSheetProps = {
  title: string;
  onClose: () => void;
  children: ReactNode;
};

export function BottomSheet({ title, onClose, children }: BottomSheetProps) {
  return (
    <div className="sheet-backdrop">
      <section className="bottom-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <header className="bottom-sheet__header">
          <h2>{title}</h2>
          <button type="button" onClick={onClose} aria-label="닫기">닫기</button>
        </header>
        <div className="bottom-sheet__body">{children}</div>
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Add spot modal**

Create `client/src/components/SpotModal.tsx`:

```tsx
import { invitationContent, type SpotId } from "@wedding-game/shared";
import { BottomSheet } from "./BottomSheet";

type SpotModalProps = {
  spotId: SpotId;
  onClose: () => void;
};

export function SpotModal({ spotId, onClose }: SpotModalProps) {
  const spot = invitationContent.spots.find((item) => item.id === spotId);
  if (!spot) return null;

  return (
    <BottomSheet title={spot.title} onClose={onClose}>
      <p>{spot.body}</p>
    </BottomSheet>
  );
}
```

- [ ] **Step 5: Add garden world component**

Create `client/src/components/GameWorld.tsx`:

```tsx
import { invitationContent, type SpotId } from "@wedding-game/shared";
import { useState } from "react";
import type { EntryProfile } from "./EntryScreen";
import { PixelAvatar } from "./PixelAvatar";
import { SpotModal } from "./SpotModal";
import { gardenWorld } from "../game/world";

type GameWorldProps = {
  profile: EntryProfile;
};

export function GameWorld({ profile }: GameWorldProps) {
  const [activeSpotId, setActiveSpotId] = useState<SpotId | null>(null);

  return (
    <section className="game-world" aria-label="정원 월드">
      <div className="world-map">
        <div className="world-path world-path--vertical" />
        <div className="world-path world-path--horizontal" />
        {gardenWorld.spots.map((spot) => {
          const content = invitationContent.spots.find((item) => item.id === spot.id);
          return (
            <button
              key={spot.id}
              type="button"
              className={`world-spot world-spot--${spot.id}`}
              style={{ left: spot.x, top: spot.y, width: spot.width, height: spot.height }}
              onClick={() => setActiveSpotId(spot.id)}
            >
              <span>{spot.label}</span>
              <small>{content?.actionLabel}</small>
            </button>
          );
        })}
        <div className="player" style={{ left: gardenWorld.spawn.x, top: gardenWorld.spawn.y }}>
          <PixelAvatar avatar={profile.avatar} color={profile.color} label={profile.nickname} />
          <span>{profile.nickname}</span>
        </div>
      </div>
      <div className="world-actions">
        {invitationContent.spots.map((spot) => (
          <button key={spot.id} type="button" onClick={() => setActiveSpotId(spot.id)}>
            {spot.actionLabel}
          </button>
        ))}
      </div>
      {activeSpotId && <SpotModal spotId={activeSpotId} onClose={() => setActiveSpotId(null)} />}
    </section>
  );
}
```

- [ ] **Step 6: Wire world into App**

Modify `client/src/App.tsx`:

```tsx
import { useState } from "react";
import { EntryScreen, type EntryProfile } from "./components/EntryScreen";
import { GameWorld } from "./components/GameWorld";

export function App() {
  const [profile, setProfile] = useState<EntryProfile | null>(null);

  return (
    <main className="app-shell">
      <section className="phone-frame">
        {profile ? <GameWorld profile={profile} /> : <EntryScreen onEnter={setProfile} />}
      </section>
    </main>
  );
}
```

- [ ] **Step 7: Add world styles**

Append to `client/src/styles.css`:

```css
.game-world {
  position: relative;
  min-height: calc(100vh - 112px);
}

.world-map {
  position: relative;
  width: 100%;
  aspect-ratio: 390 / 720;
  overflow: hidden;
  border-radius: 22px;
  background-color: #cdddb5;
  background-image:
    linear-gradient(90deg, rgba(97,125,88,.12) 1px, transparent 1px),
    linear-gradient(rgba(97,125,88,.12) 1px, transparent 1px);
  background-size: 24px 24px;
}

.world-path {
  position: absolute;
  background: #d2b47f;
}

.world-path--vertical {
  left: 42%;
  top: 0;
  width: 16%;
  height: 100%;
}

.world-path--horizontal {
  left: 0;
  top: 42%;
  width: 100%;
  height: 12%;
  background: #c9a970;
}

.world-spot {
  position: absolute;
  display: grid;
  place-items: center;
  border: 3px solid #2c2522;
  border-radius: 6px;
  background: #fff9ec;
  color: #29211e;
  font-size: 12px;
  font-weight: 900;
  text-align: center;
  box-shadow: 0 8px 0 rgba(41,33,30,.18);
}

.world-spot small {
  font-size: 10px;
  color: #71655f;
}

.player {
  position: absolute;
  transform: translate(-50%, -50%);
  display: grid;
  justify-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 900;
  color: #29211e;
}

.world-actions {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 12px 0 0;
}

.world-actions button {
  white-space: nowrap;
  border: 2px solid #2f2926;
  border-radius: 999px;
  padding: 9px 12px;
  background: #fffaf1;
  color: #29211e;
  font-weight: 900;
}

.sheet-backdrop {
  position: absolute;
  inset: 0;
  display: grid;
  align-items: end;
  background: rgba(41, 33, 30, 0.24);
}

.bottom-sheet {
  border-radius: 18px 18px 0 0;
  border: 2px solid #2f2926;
  background: #fff9ec;
  padding: 18px;
}

.bottom-sheet__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.bottom-sheet__header h2 {
  margin: 0;
  font-size: 22px;
}

.bottom-sheet__header button {
  border: 2px solid #2f2926;
  border-radius: 999px;
  padding: 8px 10px;
  background: #fffaf1;
  font-weight: 900;
}
```

- [ ] **Step 8: Run checks**

Run:

```bash
npm run test -w client -- GameWorld
npm run typecheck -w client
```

Expected: both commands exit with code 0.

- [ ] **Step 9: Commit**

```bash
git add client/src
git commit -m "feat: render garden world spots"
```

---

### Task 8: RSVP And Guestbook UI

**Files:**
- Create: `client/src/api/weddingApi.ts`
- Create: `client/src/components/RsvpForm.tsx`
- Create: `client/src/components/GuestbookPanel.tsx`
- Modify: `client/src/components/SpotModal.tsx`

- [ ] **Step 1: Write failing RSVP and guestbook tests**

Create `client/src/components/RsvpForm.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RsvpForm } from "./RsvpForm";

describe("RsvpForm", () => {
  it("submits attendance data", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<RsvpForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("이름"), { target: { value: "이승재" } });
    fireEvent.change(screen.getByLabelText("참석 여부"), { target: { value: "yes" } });
    fireEvent.change(screen.getByLabelText("동행 인원"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "참석 답변 보내기" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({
      guestName: "이승재",
      attendance: "yes",
      partySize: 2,
      note: ""
    }));
  });
});
```

Create `client/src/components/GuestbookPanel.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GuestbookPanel } from "./GuestbookPanel";

describe("GuestbookPanel", () => {
  it("submits a guestbook message", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<GuestbookPanel nickname="하객1" messages={[]} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("축하 메시지"), { target: { value: "축하합니다" } });
    fireEvent.click(screen.getByRole("button", { name: "메시지 남기기" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({
      nickname: "하객1",
      message: "축하합니다"
    }));
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm run test -w client -- RsvpForm GuestbookPanel
```

Expected: FAIL because both components do not exist.

- [ ] **Step 3: Add API adapter**

Create `client/src/api/weddingApi.ts`:

```ts
export type RsvpPayload = {
  guestName: string;
  attendance: "yes" | "no" | "unsure";
  partySize: number;
  note: string;
};

export type GuestbookPayload = {
  nickname: string;
  message: string;
};

export type GuestbookMessage = {
  id: string;
  nickname: string;
  message: string;
  createdAt: string;
};

const apiBase = import.meta.env.VITE_WORKER_URL ?? "";
const invitationId = import.meta.env.VITE_INVITATION_ID ?? "sample-garden";

async function postJson(path: string, body: unknown): Promise<void> {
  const response = await fetch(`${apiBase}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
}

export function submitRsvp(payload: RsvpPayload): Promise<void> {
  return postJson(`/api/invitations/${invitationId}/rsvps`, payload);
}

export function submitGuestbook(payload: GuestbookPayload): Promise<void> {
  return postJson(`/api/invitations/${invitationId}/guestbook`, payload);
}
```

- [ ] **Step 4: Add RSVP form**

Create `client/src/components/RsvpForm.tsx`:

```tsx
import { useState } from "react";
import type { RsvpPayload } from "../api/weddingApi";

type RsvpFormProps = {
  onSubmit: (payload: RsvpPayload) => Promise<void>;
};

export function RsvpForm({ onSubmit }: RsvpFormProps) {
  const [guestName, setGuestName] = useState("");
  const [attendance, setAttendance] = useState<RsvpPayload["attendance"]>("yes");
  const [partySize, setPartySize] = useState(1);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "sent" | "error">("idle");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    try {
      await onSubmit({ guestName: guestName.trim(), attendance, partySize, note: note.trim() });
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  }

  return (
    <form className="form-stack" onSubmit={handleSubmit}>
      <label className="field">
        <span>이름</span>
        <input value={guestName} maxLength={30} onChange={(event) => setGuestName(event.target.value)} required />
      </label>
      <label className="field">
        <span>참석 여부</span>
        <select value={attendance} onChange={(event) => setAttendance(event.target.value as RsvpPayload["attendance"])}>
          <option value="yes">참석</option>
          <option value="no">불참</option>
          <option value="unsure">미정</option>
        </select>
      </label>
      <label className="field">
        <span>동행 인원</span>
        <input
          type="number"
          min={1}
          max={10}
          value={partySize}
          onChange={(event) => setPartySize(Number(event.target.value))}
        />
      </label>
      <label className="field">
        <span>메모</span>
        <textarea value={note} maxLength={160} onChange={(event) => setNote(event.target.value)} />
      </label>
      <button className="primary-button" type="submit" disabled={status === "submitting"}>
        참석 답변 보내기
      </button>
      {status === "sent" && <p className="form-status">답변을 받았습니다.</p>}
      {status === "error" && <p className="form-status form-status--error">전송에 실패했습니다. 다시 시도해 주세요.</p>}
    </form>
  );
}
```

- [ ] **Step 5: Add guestbook panel**

Create `client/src/components/GuestbookPanel.tsx`:

```tsx
import { useState } from "react";
import type { GuestbookMessage, GuestbookPayload } from "../api/weddingApi";

type GuestbookPanelProps = {
  nickname: string;
  messages: GuestbookMessage[];
  onSubmit: (payload: GuestbookPayload) => Promise<void>;
};

export function GuestbookPanel({ nickname, messages, onSubmit }: GuestbookPanelProps) {
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "sent" | "error">("idle");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    try {
      await onSubmit({ nickname, message: message.trim() });
      setMessage("");
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="guestbook-panel">
      <form className="form-stack" onSubmit={handleSubmit}>
        <label className="field">
          <span>축하 메시지</span>
          <textarea value={message} maxLength={240} onChange={(event) => setMessage(event.target.value)} required />
        </label>
        <button className="primary-button" type="submit" disabled={status === "submitting"}>
          메시지 남기기
        </button>
      </form>
      {status === "sent" && <p className="form-status">메시지를 남겼습니다.</p>}
      {status === "error" && <p className="form-status form-status--error">전송에 실패했습니다. 다시 시도해 주세요.</p>}
      <ul className="guestbook-list">
        {messages.map((item) => (
          <li key={item.id}>
            <strong>{item.nickname}</strong>
            <span>{item.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 6: Wire forms into spot modal**

Modify `client/src/components/SpotModal.tsx`:

```tsx
import { invitationContent, type SpotId } from "@wedding-game/shared";
import { submitGuestbook, submitRsvp } from "../api/weddingApi";
import { BottomSheet } from "./BottomSheet";
import { GuestbookPanel } from "./GuestbookPanel";
import { RsvpForm } from "./RsvpForm";

type SpotModalProps = {
  spotId: SpotId;
  nickname: string;
  onClose: () => void;
};

export function SpotModal({ spotId, nickname, onClose }: SpotModalProps) {
  const spot = invitationContent.spots.find((item) => item.id === spotId);
  if (!spot) return null;

  return (
    <BottomSheet title={spot.title} onClose={onClose}>
      <p>{spot.body}</p>
      {spotId === "rsvp" && <RsvpForm onSubmit={submitRsvp} />}
      {spotId === "guestbook" && <GuestbookPanel nickname={nickname} messages={[]} onSubmit={submitGuestbook} />}
    </BottomSheet>
  );
}
```

Modify `client/src/components/GameWorld.tsx` where `SpotModal` is rendered:

```tsx
{activeSpotId && (
  <SpotModal
    spotId={activeSpotId}
    nickname={profile.nickname}
    onClose={() => setActiveSpotId(null)}
  />
)}
```

- [ ] **Step 7: Add form styles**

Append to `client/src/styles.css`:

```css
.form-stack {
  display: grid;
  gap: 12px;
  margin-top: 14px;
}

.field textarea {
  min-height: 90px;
  resize: vertical;
}

.form-status {
  margin: 8px 0 0;
  color: #617d58;
  font-weight: 800;
}

.form-status--error {
  color: #b94444;
}

.guestbook-list {
  display: grid;
  gap: 10px;
  margin: 14px 0 0;
  padding: 0;
  list-style: none;
}

.guestbook-list li {
  display: grid;
  gap: 3px;
  padding: 10px;
  border: 1px solid rgba(41, 33, 30, 0.16);
  border-radius: 8px;
  background: rgba(255, 250, 241, 0.7);
}
```

- [ ] **Step 8: Run checks**

Run:

```bash
npm run test -w client -- RsvpForm GuestbookPanel GameWorld
npm run typecheck -w client
```

Expected: both commands exit with code 0.

- [ ] **Step 9: Commit**

```bash
git add client/src
git commit -m "feat: add rsvp and guestbook UI"
```

---

### Task 9: Worker Scaffold And D1 Schema

**Files:**
- Create: `worker/package.json`
- Create: `worker/tsconfig.json`
- Create: `worker/vitest.config.ts`
- Create: `worker/wrangler.toml`
- Create: `worker/migrations/0001_init.sql`
- Create: `worker/src/index.ts`

- [ ] **Step 1: Create worker package config**

Create `worker/package.json`:

```json
{
  "name": "@wedding-game/worker",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "build": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@wedding-game/shared": "file:../shared"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20240620.0",
    "typescript": "^5.5.0",
    "vitest": "^4.1.8",
    "wrangler": "^3.62.0"
  }
}
```

Create `worker/tsconfig.json`:

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "types": ["@cloudflare/workers-types", "vitest/globals"]
  },
  "include": ["src", "vitest.config.ts"]
}
```

Create `worker/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node"
  }
});
```

- [ ] **Step 2: Create Cloudflare config**

Create `worker/wrangler.toml`:

```toml
name = "wedding-game-invitation"
main = "src/index.ts"
compatibility_date = "2026-06-09"

[[durable_objects.bindings]]
name = "GARDEN_ROOM"
class_name = "GardenRoom"

[[migrations]]
tag = "v1"
new_sqlite_classes = ["GardenRoom"]

[[d1_databases]]
binding = "DB"
database_name = "wedding-game-invitation"
database_id = "00000000-0000-0000-0000-000000000000"
```

- [ ] **Step 3: Create D1 migration**

Create `worker/migrations/0001_init.sql`:

```sql
CREATE TABLE IF NOT EXISTS invitations (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  wedding_date TEXT NOT NULL,
  venue_name TEXT NOT NULL,
  venue_address TEXT NOT NULL,
  config_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rsvps (
  id TEXT PRIMARY KEY,
  invitation_id TEXT NOT NULL,
  guest_name TEXT NOT NULL,
  attendance TEXT NOT NULL CHECK (attendance IN ('yes', 'no', 'unsure')),
  party_size INTEGER NOT NULL CHECK (party_size >= 1 AND party_size <= 10),
  note TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (invitation_id) REFERENCES invitations(id)
);

CREATE TABLE IF NOT EXISTS guestbook_messages (
  id TEXT PRIMARY KEY,
  invitation_id TEXT NOT NULL,
  nickname TEXT NOT NULL,
  message TEXT NOT NULL,
  is_hidden INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (invitation_id) REFERENCES invitations(id)
);

CREATE TABLE IF NOT EXISTS moderation_events (
  id TEXT PRIMARY KEY,
  invitation_id TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('guestbook')),
  target_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('hide', 'show')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (invitation_id) REFERENCES invitations(id)
);

INSERT OR IGNORE INTO invitations (
  id,
  slug,
  title,
  wedding_date,
  venue_name,
  venue_address,
  config_json
) VALUES (
  'sample-garden',
  'sample-garden',
  '서준 & 하린의 정원',
  '2027-05-15',
  '라온가든 웨딩홀',
  '서울특별시 강남구 테헤란로 123',
  '{}'
);
```

- [ ] **Step 4: Add minimal Worker entry**

Create `worker/src/index.ts`:

```ts
export interface Env {
  DB: D1Database;
  GARDEN_ROOM: DurableObjectNamespace;
}

export { GardenRoom } from "./GardenRoom";

export default {
  async fetch(): Promise<Response> {
    return new Response("Wedding game worker is running", {
      headers: { "content-type": "text/plain; charset=utf-8" }
    });
  }
};
```

Create `worker/src/GardenRoom.ts`:

```ts
export class GardenRoom {
  constructor(private readonly state: DurableObjectState) {}

  async fetch(): Promise<Response> {
    return new Response("Garden room is running", {
      headers: { "content-type": "text/plain; charset=utf-8" }
    });
  }
}
```

- [ ] **Step 5: Install worker dependencies**

Run:

```bash
npm install
```

Expected: exits with code 0 and updates `package-lock.json`.

- [ ] **Step 6: Apply local D1 migration**

Run:

```bash
npm exec -w worker wrangler d1 migrations apply wedding-game-invitation --local
```

Expected: exits with code 0 and reports that `0001_init.sql` was applied to the local D1 database.

- [ ] **Step 7: Run worker checks**

Run:

```bash
npm run typecheck -w worker
```

Expected: exits with code 0.

- [ ] **Step 8: Commit**

```bash
git add worker package-lock.json
git commit -m "feat: scaffold cloudflare worker"
```

---

### Task 10: Worker Validation And Rate Limiting

**Files:**
- Create: `worker/src/validation.ts`
- Create: `worker/src/validation.test.ts`
- Create: `worker/src/rateLimit.ts`
- Create: `worker/src/rateLimit.test.ts`

- [ ] **Step 1: Write failing Worker validation tests**

Create `worker/src/validation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseGuestbookPayload, parseRsvpPayload } from "./validation";

describe("parseRsvpPayload", () => {
  it("accepts a valid RSVP", () => {
    expect(parseRsvpPayload({
      guestName: "이승재",
      attendance: "yes",
      partySize: 2,
      note: "주차 필요"
    })).toEqual({
      guestName: "이승재",
      attendance: "yes",
      partySize: 2,
      note: "주차 필요"
    });
  });

  it("rejects invalid RSVP data", () => {
    expect(parseRsvpPayload({ guestName: "", attendance: "bad", partySize: 99 })).toBeNull();
  });
});

describe("parseGuestbookPayload", () => {
  it("accepts a valid guestbook message", () => {
    expect(parseGuestbookPayload({ nickname: "하객1", message: "축하합니다" })).toEqual({
      nickname: "하객1",
      message: "축하합니다"
    });
  });

  it("rejects empty messages", () => {
    expect(parseGuestbookPayload({ nickname: "하객1", message: "   " })).toBeNull();
  });
});
```

Create `worker/src/rateLimit.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { MemoryRateLimiter } from "./rateLimit";

describe("MemoryRateLimiter", () => {
  it("allows requests under the limit", () => {
    const limiter = new MemoryRateLimiter({ limit: 2, windowMs: 1000 });
    expect(limiter.allow("a", 0)).toBe(true);
    expect(limiter.allow("a", 100)).toBe(true);
  });

  it("blocks requests over the limit", () => {
    const limiter = new MemoryRateLimiter({ limit: 2, windowMs: 1000 });
    limiter.allow("a", 0);
    limiter.allow("a", 100);
    expect(limiter.allow("a", 200)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm run test -w worker -- validation rateLimit
```

Expected: FAIL because validation and rateLimit modules do not exist.

- [ ] **Step 3: Add Worker validation**

Create `worker/src/validation.ts`:

```ts
import { sanitizeText } from "@wedding-game/shared";

export type RsvpPayload = {
  guestName: string;
  attendance: "yes" | "no" | "unsure";
  partySize: number;
  note: string;
};

export type GuestbookPayload = {
  nickname: string;
  message: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseRsvpPayload(value: unknown): RsvpPayload | null {
  if (!isRecord(value)) return null;
  const guestName = sanitizeText(value.guestName, 30);
  const note = sanitizeText(value.note ?? "", 160);
  const attendance = value.attendance;
  const partySize = Number(value.partySize);

  if (!guestName) return null;
  if (attendance !== "yes" && attendance !== "no" && attendance !== "unsure") return null;
  if (!Number.isInteger(partySize) || partySize < 1 || partySize > 10) return null;

  return { guestName, attendance, partySize, note };
}

export function parseGuestbookPayload(value: unknown): GuestbookPayload | null {
  if (!isRecord(value)) return null;
  const nickname = sanitizeText(value.nickname, 16);
  const message = sanitizeText(value.message, 240);
  if (!nickname || !message) return null;
  return { nickname, message };
}
```

- [ ] **Step 4: Add rate limiter**

Create `worker/src/rateLimit.ts`:

```ts
type RateLimiterOptions = {
  limit: number;
  windowMs: number;
};

export class MemoryRateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(private readonly options: RateLimiterOptions) {}

  allow(key: string, now = Date.now()): boolean {
    const start = now - this.options.windowMs;
    const current = (this.hits.get(key) ?? []).filter((timestamp) => timestamp > start);
    if (current.length >= this.options.limit) {
      this.hits.set(key, current);
      return false;
    }
    current.push(now);
    this.hits.set(key, current);
    return true;
  }
}
```

- [ ] **Step 5: Run worker tests**

Run:

```bash
npm run test -w worker -- validation rateLimit
npm run typecheck -w worker
```

Expected: both commands exit with code 0.

- [ ] **Step 6: Commit**

```bash
git add worker/src/validation.ts worker/src/validation.test.ts worker/src/rateLimit.ts worker/src/rateLimit.test.ts
git commit -m "feat: add worker validation helpers"
```

---

### Task 11: D1 HTTP Endpoints

**Files:**
- Create: `worker/src/http.ts`
- Modify: `worker/src/index.ts`

- [ ] **Step 1: Write failing HTTP tests**

Create `worker/src/http.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { handleApiRequest } from "./http";

function createDb() {
  const run = vi.fn().mockResolvedValue({ success: true });
  const bind = vi.fn(() => ({ run }));
  const prepare = vi.fn(() => ({ bind }));
  return { db: { prepare } as unknown as D1Database, prepare, bind, run };
}

describe("handleApiRequest", () => {
  it("stores RSVP submissions", async () => {
    const { db, prepare, run } = createDb();
    const request = new Request("https://worker.test/api/invitations/sample-garden/rsvps", {
      method: "POST",
      body: JSON.stringify({ guestName: "이승재", attendance: "yes", partySize: 2, note: "" }),
      headers: { "content-type": "application/json" }
    });

    const response = await handleApiRequest(request, db, "127.0.0.1");

    expect(response.status).toBe(201);
    expect(prepare).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO rsvps"));
    expect(run).toHaveBeenCalled();
  });

  it("rejects malformed guestbook submissions", async () => {
    const { db } = createDb();
    const request = new Request("https://worker.test/api/invitations/sample-garden/guestbook", {
      method: "POST",
      body: JSON.stringify({ nickname: "하객1", message: "" }),
      headers: { "content-type": "application/json" }
    });

    const response = await handleApiRequest(request, db, "127.0.0.1");

    expect(response.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
npm run test -w worker -- http
```

Expected: FAIL because `handleApiRequest` does not exist.

- [ ] **Step 3: Add HTTP handler**

Create `worker/src/http.ts`:

```ts
import { MemoryRateLimiter } from "./rateLimit";
import { parseGuestbookPayload, parseRsvpPayload } from "./validation";

const writeLimiter = new MemoryRateLimiter({ limit: 10, windowMs: 60_000 });

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type"
    }
  });
}

function id(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function handleApiRequest(request: Request, db: D1Database, clientKey: string): Promise<Response> {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  if (!writeLimiter.allow(clientKey)) {
    return json({ error: "rate_limited" }, 429);
  }

  const url = new URL(request.url);
  const match = url.pathname.match(/^\/api\/invitations\/([^/]+)\/(rsvps|guestbook)$/);
  if (!match) return json({ error: "not_found" }, 404);

  const invitationId = match[1];
  const resource = match[2];
  const payload = await readJson(request);

  if (resource === "rsvps") {
    const rsvp = parseRsvpPayload(payload);
    if (!rsvp) return json({ error: "bad_request" }, 400);
    await db.prepare(`
      INSERT INTO rsvps (id, invitation_id, guest_name, attendance, party_size, note)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(id("rsvp"), invitationId, rsvp.guestName, rsvp.attendance, rsvp.partySize, rsvp.note).run();
    return json({ ok: true }, 201);
  }

  const guestbook = parseGuestbookPayload(payload);
  if (!guestbook) return json({ error: "bad_request" }, 400);
  await db.prepare(`
    INSERT INTO guestbook_messages (id, invitation_id, nickname, message)
    VALUES (?, ?, ?, ?)
  `).bind(id("guestbook"), invitationId, guestbook.nickname, guestbook.message).run();
  return json({ ok: true }, 201);
}
```

- [ ] **Step 4: Wire HTTP handler**

Modify `worker/src/index.ts`:

```ts
import { handleApiRequest } from "./http";

export interface Env {
  DB: D1Database;
  GARDEN_ROOM: DurableObjectNamespace;
}

export { GardenRoom } from "./GardenRoom";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      const clientKey = request.headers.get("cf-connecting-ip") ?? "local";
      return handleApiRequest(request, env.DB, clientKey);
    }

    return new Response("Wedding game worker is running", {
      headers: { "content-type": "text/plain; charset=utf-8" }
    });
  }
};
```

- [ ] **Step 5: Run worker checks**

Run:

```bash
npm run test -w worker -- http
npm run typecheck -w worker
```

Expected: both commands exit with code 0.

- [ ] **Step 6: Commit**

```bash
git add worker/src/http.ts worker/src/http.test.ts worker/src/index.ts
git commit -m "feat: add rsvp and guestbook endpoints"
```

---

### Task 12: Durable Object Room

**Files:**
- Modify: `worker/src/GardenRoom.ts`
- Modify: `worker/src/index.ts`

- [ ] **Step 1: Write failing room unit test**

Create `worker/src/GardenRoom.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createGuestSnapshot, removeGuest } from "./GardenRoom";

describe("GardenRoom helpers", () => {
  it("creates a room guest snapshot", () => {
    expect(createGuestSnapshot("guest_1", {
      type: "join",
      nickname: "하객1",
      avatar: "classic",
      color: "rose"
    }, 1000)).toMatchObject({
      guestId: "guest_1",
      nickname: "하객1",
      avatar: "classic",
      color: "rose",
      x: 195,
      y: 520,
      direction: "down",
      moving: false,
      seq: 0,
      lastSeenAt: 1000
    });
  });

  it("removes guests by id", () => {
    const guests = new Map([["guest_1", createGuestSnapshot("guest_1", {
      type: "join",
      nickname: "하객1",
      avatar: "classic",
      color: "rose"
    }, 1000)]]);
    removeGuest(guests, "guest_1");
    expect(guests.size).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
npm run test -w worker -- GardenRoom
```

Expected: FAIL because helper exports do not exist.

- [ ] **Step 3: Implement room helpers and WebSocket handling**

Modify `worker/src/GardenRoom.ts`:

```ts
import { clampNumber, parseClientMessage, type ClientMessage, type RoomGuest, type ServerMessage } from "@wedding-game/shared";

type GuestSocket = {
  guestId: string;
  socket: WebSocket;
};

const spawn = { x: 195, y: 520 };
const bounds = { minX: 0, maxX: 390, minY: 0, maxY: 720 };

export function createGuestSnapshot(guestId: string, message: Extract<ClientMessage, { type: "join" }>, now: number): RoomGuest {
  return {
    guestId,
    nickname: message.nickname,
    avatar: message.avatar,
    color: message.color,
    x: spawn.x,
    y: spawn.y,
    direction: "down",
    moving: false,
    seq: 0,
    lastSeenAt: now
  };
}

export function removeGuest(guests: Map<string, RoomGuest>, guestId: string): void {
  guests.delete(guestId);
}

function encode(message: ServerMessage): string {
  return JSON.stringify(message);
}

export class GardenRoom {
  private readonly guests = new Map<string, RoomGuest>();
  private readonly sockets = new Map<WebSocket, GuestSocket>();

  constructor(private readonly state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.acceptSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  private acceptSocket(socket: WebSocket): void {
    socket.accept();
    socket.addEventListener("message", (event) => this.handleMessage(socket, event.data));
    socket.addEventListener("close", () => this.disconnect(socket));
    socket.addEventListener("error", () => this.disconnect(socket));
  }

  private handleMessage(socket: WebSocket, raw: unknown): void {
    const parsed = typeof raw === "string" ? parseClientMessage(JSON.parse(raw)) : null;
    if (!parsed) {
      socket.send(encode({ type: "error", code: "bad_message" }));
      return;
    }

    if (parsed.type === "join") {
      const guestId = `guest_${crypto.randomUUID()}`;
      const guest = createGuestSnapshot(guestId, parsed, Date.now());
      this.guests.set(guestId, guest);
      this.sockets.set(socket, { guestId, socket });
      socket.send(encode({ type: "welcome", guestId, guests: [...this.guests.values()] }));
      this.broadcast({ type: "guest_joined", guest }, socket);
      return;
    }

    const current = this.sockets.get(socket);
    if (!current) {
      socket.send(encode({ type: "error", code: "bad_message" }));
      return;
    }

    if (parsed.type === "move") {
      const guest = this.guests.get(current.guestId);
      if (!guest) return;
      const position = {
        x: clampNumber(parsed.x, bounds.minX, bounds.maxX),
        y: clampNumber(parsed.y, bounds.minY, bounds.maxY),
        direction: parsed.direction,
        moving: parsed.moving,
        seq: parsed.seq
      };
      this.guests.set(current.guestId, { ...guest, ...position, lastSeenAt: Date.now() });
      this.broadcast({ type: "guest_moved", guestId: current.guestId, position }, socket);
      return;
    }

    if (parsed.type === "ping") {
      const guest = this.guests.get(current.guestId);
      if (guest) this.guests.set(current.guestId, { ...guest, lastSeenAt: Date.now() });
      return;
    }

    if (parsed.type === "leave") {
      this.disconnect(socket);
    }
  }

  private broadcast(message: ServerMessage, except?: WebSocket): void {
    const payload = encode(message);
    for (const { socket } of this.sockets.values()) {
      if (socket !== except) socket.send(payload);
    }
  }

  private disconnect(socket: WebSocket): void {
    const current = this.sockets.get(socket);
    if (!current) return;
    this.sockets.delete(socket);
    removeGuest(this.guests, current.guestId);
    this.broadcast({ type: "guest_left", guestId: current.guestId });
  }
}
```

- [ ] **Step 4: Route room WebSocket requests**

Modify `worker/src/index.ts`:

```ts
import { handleApiRequest } from "./http";

export interface Env {
  DB: D1Database;
  GARDEN_ROOM: DurableObjectNamespace;
}

export { GardenRoom } from "./GardenRoom";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      const clientKey = request.headers.get("cf-connecting-ip") ?? "local";
      return handleApiRequest(request, env.DB, clientKey);
    }

    const roomMatch = url.pathname.match(/^\/rooms\/([^/]+)$/);
    if (roomMatch) {
      const id = env.GARDEN_ROOM.idFromName(roomMatch[1]);
      return env.GARDEN_ROOM.get(id).fetch(request);
    }

    return new Response("Wedding game worker is running", {
      headers: { "content-type": "text/plain; charset=utf-8" }
    });
  }
};
```

- [ ] **Step 5: Run worker checks**

Run:

```bash
npm run test -w worker -- GardenRoom
npm run typecheck -w worker
```

Expected: both commands exit with code 0.

- [ ] **Step 6: Commit**

```bash
git add worker/src/GardenRoom.ts worker/src/GardenRoom.test.ts worker/src/index.ts
git commit -m "feat: add durable object room"
```

---

### Task 13: Client Realtime Adapter And Offline Mode

**Files:**
- Create: `client/src/realtime/realtimeClient.ts`
- Create: `client/src/realtime/realtimeClient.test.ts`
- Modify: `client/src/components/GameWorld.tsx`

- [ ] **Step 1: Write failing realtime adapter tests**

Create `client/src/realtime/realtimeClient.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { createMoveThrottle, getRoomUrl } from "./realtimeClient";

describe("getRoomUrl", () => {
  it("builds a worker websocket URL", () => {
    expect(getRoomUrl("https://worker.example.com", "sample-garden")).toBe("wss://worker.example.com/rooms/sample-garden");
  });
});

describe("createMoveThrottle", () => {
  it("limits movement messages to 10fps", () => {
    const send = vi.fn();
    const throttle = createMoveThrottle(send, 100);
    throttle({ type: "move", x: 1, y: 1, direction: "down", moving: true, seq: 1 }, 0);
    throttle({ type: "move", x: 2, y: 2, direction: "down", moving: true, seq: 2 }, 50);
    throttle({ type: "move", x: 3, y: 3, direction: "down", moving: true, seq: 3 }, 100);
    expect(send).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
npm run test -w client -- realtimeClient
```

Expected: FAIL because `realtimeClient` does not exist.

- [ ] **Step 3: Add realtime adapter**

Create `client/src/realtime/realtimeClient.ts`:

```ts
import type { ClientMessage, ServerMessage } from "@wedding-game/shared";

export function getRoomUrl(workerUrl: string, invitationId: string): string {
  const url = new URL(workerUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = `/rooms/${invitationId}`;
  return url.toString();
}

export function createMoveThrottle(send: (message: ClientMessage) => void, intervalMs: number) {
  let lastSentAt = -Infinity;
  return (message: Extract<ClientMessage, { type: "move" }>, now: number) => {
    if (now - lastSentAt >= intervalMs) {
      lastSentAt = now;
      send(message);
    }
  };
}

export type RealtimeHandlers = {
  onOpen: () => void;
  onClose: () => void;
  onMessage: (message: ServerMessage) => void;
};

export function connectRealtime(url: string, join: Extract<ClientMessage, { type: "join" }>, handlers: RealtimeHandlers) {
  const socket = new WebSocket(url);

  socket.addEventListener("open", () => {
    handlers.onOpen();
    socket.send(JSON.stringify(join));
  });

  socket.addEventListener("close", handlers.onClose);
  socket.addEventListener("error", handlers.onClose);
  socket.addEventListener("message", (event) => {
    try {
      handlers.onMessage(JSON.parse(event.data) as ServerMessage);
    } catch {
      handlers.onMessage({ type: "error", code: "bad_message" });
    }
  });

  return {
    send(message: ClientMessage) {
      if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
    },
    close() {
      socket.close();
    }
  };
}
```

- [ ] **Step 4: Add visible offline status to GameWorld**

Modify `client/src/components/GameWorld.tsx` to add state:

```tsx
const [realtimeStatus] = useState<"offline" | "connecting" | "online">("offline");
```

Add this inside the returned `section` before `world-map`:

```tsx
<div className={`realtime-pill realtime-pill--${realtimeStatus}`}>
  {realtimeStatus === "online" ? "실시간 정원" : "오프라인 정원"}
</div>
```

- [ ] **Step 5: Add status styles**

Append to `client/src/styles.css`:

```css
.realtime-pill {
  position: absolute;
  z-index: 2;
  top: 12px;
  left: 12px;
  border: 2px solid #2f2926;
  border-radius: 999px;
  padding: 7px 10px;
  background: #fffaf1;
  font-size: 12px;
  font-weight: 900;
}

.realtime-pill--online {
  background: #617d58;
  color: #fffaf1;
}
```

- [ ] **Step 6: Run checks**

Run:

```bash
npm run test -w client -- realtimeClient GameWorld
npm run typecheck -w client
```

Expected: both commands exit with code 0.

- [ ] **Step 7: Commit**

```bash
git add client/src/realtime client/src/components/GameWorld.tsx client/src/styles.css
git commit -m "feat: add realtime client adapter"
```

---

### Task 14: Connect Client Movement And Remote Guests

**Files:**
- Modify: `client/src/components/GameWorld.tsx`
- Modify: `client/src/styles.css`

- [ ] **Step 1: Add integration behavior test**

Modify `client/src/components/GameWorld.test.tsx` to add:

```tsx
it("moves the player when the map is clicked", () => {
  render(<GameWorld profile={{ nickname: "하객1", avatar: "classic", color: "rose" }} />);
  const map = screen.getByLabelText("정원 지도");
  fireEvent.click(map, { clientX: 250, clientY: 300 });
  expect(screen.getByLabelText("하객1")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test**

Run:

```bash
npm run test -w client -- GameWorld
```

Expected: FAIL because the map does not expose `정원 지도` and click movement is not wired.

- [ ] **Step 3: Add local movement loop**

Modify `client/src/components/GameWorld.tsx` with this complete component:

```tsx
import { invitationContent, type RoomGuest, type SpotId } from "@wedding-game/shared";
import { useEffect, useRef, useState } from "react";
import type { EntryProfile } from "./EntryScreen";
import { PixelAvatar } from "./PixelAvatar";
import { SpotModal } from "./SpotModal";
import { computeNextPosition } from "../game/movement";
import { gardenWorld, type Point } from "../game/world";

type GameWorldProps = {
  profile: EntryProfile;
};

const speed = 120;

export function GameWorld({ profile }: GameWorldProps) {
  const [activeSpotId, setActiveSpotId] = useState<SpotId | null>(null);
  const [position, setPosition] = useState<Point>(gardenWorld.spawn);
  const [target, setTarget] = useState<Point | null>(null);
  const [remoteGuests] = useState<RoomGuest[]>([]);
  const [realtimeStatus] = useState<"offline" | "connecting" | "online">("offline");
  const lastFrameRef = useRef<number | null>(null);

  useEffect(() => {
    let frame = 0;
    function tick(now: number) {
      if (lastFrameRef.current === null) lastFrameRef.current = now;
      const deltaMs = now - lastFrameRef.current;
      lastFrameRef.current = now;
      if (target) {
        setPosition((current) => computeNextPosition({ current, target, deltaMs, speed, world: gardenWorld }));
      }
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);

  function handleMapClick(event: React.MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * gardenWorld.bounds.width;
    const y = ((event.clientY - rect.top) / rect.height) * gardenWorld.bounds.height;
    setTarget({ x, y });
  }

  return (
    <section className="game-world" aria-label="정원 월드">
      <div className={`realtime-pill realtime-pill--${realtimeStatus}`}>
        {realtimeStatus === "online" ? "실시간 정원" : "오프라인 정원"}
      </div>
      <div className="world-map" aria-label="정원 지도" onClick={handleMapClick}>
        <div className="world-path world-path--vertical" />
        <div className="world-path world-path--horizontal" />
        {gardenWorld.spots.map((spot) => {
          const content = invitationContent.spots.find((item) => item.id === spot.id);
          return (
            <button
              key={spot.id}
              type="button"
              className={`world-spot world-spot--${spot.id}`}
              style={{ left: spot.x, top: spot.y, width: spot.width, height: spot.height }}
              onClick={(event) => {
                event.stopPropagation();
                setActiveSpotId(spot.id);
              }}
            >
              <span>{spot.label}</span>
              <small>{content?.actionLabel}</small>
            </button>
          );
        })}
        {remoteGuests.map((guest) => (
          <div key={guest.guestId} className="player player--remote" style={{ left: guest.x, top: guest.y }}>
            <PixelAvatar avatar={guest.avatar} color={guest.color} label={guest.nickname} />
            <span>{guest.nickname}</span>
          </div>
        ))}
        <div className="player" style={{ left: position.x, top: position.y }}>
          <PixelAvatar avatar={profile.avatar} color={profile.color} label={profile.nickname} />
          <span>{profile.nickname}</span>
        </div>
      </div>
      <div className="world-actions">
        {invitationContent.spots.map((spot) => (
          <button key={spot.id} type="button" onClick={() => setActiveSpotId(spot.id)}>
            {spot.actionLabel}
          </button>
        ))}
      </div>
      {activeSpotId && (
        <SpotModal
          spotId={activeSpotId}
          nickname={profile.nickname}
          onClose={() => setActiveSpotId(null)}
        />
      )}
    </section>
  );
}
```

- [ ] **Step 4: Add remote guest style**

Append to `client/src/styles.css`:

```css
.player--remote {
  opacity: 0.82;
}
```

- [ ] **Step 5: Run checks**

Run:

```bash
npm run test -w client -- GameWorld
npm run typecheck -w client
```

Expected: both commands exit with code 0.

- [ ] **Step 6: Commit**

```bash
git add client/src/components/GameWorld.tsx client/src/components/GameWorld.test.tsx client/src/styles.css
git commit -m "feat: add local map movement"
```

---

### Task 15: Deployment Configuration

**Files:**
- Create: `.github/workflows/pages.yml`
- Create: `client/.env.example`
- Create: `worker/.dev.vars.example`
- Modify: `README.md`

- [ ] **Step 1: Add GitHub Pages workflow**

Create `.github/workflows/pages.yml`:

```yaml
name: Deploy client to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run test
      - run: npm run build
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: client/dist
      - uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Add environment examples**

Create `client/.env.example`:

```bash
VITE_WORKER_URL=https://wedding-game-invitation.example.workers.dev
VITE_INVITATION_ID=sample-garden
```

Create `worker/.dev.vars.example`:

```bash
ADMIN_TOKEN=change-this-local-token
```

- [ ] **Step 3: Add README**

Create `README.md`:

```md
# Wedding Game Invitation

Mobile-first pixel garden wedding invitation with real-time guest presence.

## Local Development

Install dependencies:

```bash
npm install
```

Run the client:

```bash
npm run dev
```

Run the Worker:

```bash
npm run dev:worker
```

Run checks:

```bash
npm run test
npm run typecheck
npm run build
```

## Architecture

- `client`: React/Vite static app for GitHub Pages.
- `worker`: Cloudflare Worker, Durable Object room, and D1 endpoints.
- `shared`: shared protocol, content seed, and validation helpers.

## Deployment

The client deploys to GitHub Pages from `.github/workflows/pages.yml`.
The Worker deploys with Wrangler after a real D1 database is created and `worker/wrangler.toml` is updated with the production database ID.
```

- [ ] **Step 4: Run checks**

Run:

```bash
npm run test
npm run typecheck
npm run build
```

Expected: all commands exit with code 0.

- [ ] **Step 5: Commit**

```bash
git add .github client/.env.example worker/.dev.vars.example README.md
git commit -m "chore: add deployment documentation"
```

---

### Task 16: Browser Verification

**Files:**
- No source changes expected unless verification finds defects.

- [ ] **Step 1: Start client dev server**

Run:

```bash
npm run dev -- --host 127.0.0.1
```

Expected: Vite prints a localhost URL.

- [ ] **Step 2: Open the app in the Browser plugin**

Open the Vite URL in the in-app Browser.

Expected:

- Entry screen is visible.
- Nickname input is usable.
- Avatar and color choices visibly change the preview.
- `정원 입장` transitions to the garden map.

- [ ] **Step 3: Verify mobile viewport**

Use a mobile-sized viewport around 390 by 844.

Expected:

- No horizontal overflow.
- Phone frame fits.
- World map, action buttons, and bottom sheet are readable.
- Tap-to-move does not block spot buttons.

- [ ] **Step 4: Verify desktop viewport**

Use a desktop viewport around 1280 by 900.

Expected:

- App remains centered.
- It does not stretch the game map awkwardly.
- Pixel map and UI remain legible.

- [ ] **Step 5: Verify Worker locally**

Run:

```bash
npm run dev:worker
```

Expected: Wrangler starts a local Worker URL.

Submit a sample RSVP request:

```bash
curl -i \
  -X POST \
  -H 'content-type: application/json' \
  --data '{"guestName":"이승재","attendance":"yes","partySize":2,"note":""}' \
  http://127.0.0.1:8787/api/invitations/sample-garden/rsvps
```

Expected: HTTP 201 with `{"ok":true}`.

- [ ] **Step 6: Final commit if fixes were needed**

If verification required source fixes:

```bash
git add <fixed-files>
git commit -m "fix: address verification issues"
```

If no fixes were needed, do not create an empty commit.

---

## Self-Review

Spec coverage:

- Public nickname-first entry: Task 6.
- Avatar type and color selection: Task 6.
- Garden festival pixel world: Tasks 5, 7, 14.
- Tap-to-move: Tasks 5 and 14.
- Virtual joystick: Task 14A, executed immediately after Task 14.
- Real-time protocol and 10fps throttle: Tasks 2, 12, 13.
- Durable Object room: Task 12.
- D1 schema and saved data: Tasks 9, 11.
- RSVP and guestbook UI: Task 8.
- GitHub Pages deployment: Task 15.
- Error handling offline state: Task 13.
- Mobile/desktop verification: Task 16.

---

### Task 14A: Virtual Joystick Control

**Files:**
- Create: `client/src/components/VirtualJoystick.tsx`
- Create: `client/src/components/VirtualJoystick.test.tsx`
- Modify: `client/src/components/GameWorld.tsx`
- Modify: `client/src/styles.css`

- [ ] **Step 1: Write failing joystick test**

Create `client/src/components/VirtualJoystick.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VirtualJoystick } from "./VirtualJoystick";

describe("VirtualJoystick", () => {
  it("reports a normalized movement vector while dragging", () => {
    const onVectorChange = vi.fn();
    render(<VirtualJoystick onVectorChange={onVectorChange} />);

    const control = screen.getByLabelText("가상 조이스틱");
    fireEvent.pointerDown(control, { clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(control, { clientX: 130, clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(control, { pointerId: 1 });

    expect(onVectorChange).toHaveBeenCalledWith({ x: 1, y: 0 });
    expect(onVectorChange).toHaveBeenLastCalledWith({ x: 0, y: 0 });
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
npm run test -w client -- VirtualJoystick
```

Expected: FAIL because `VirtualJoystick` does not exist.

- [ ] **Step 3: Add joystick component**

Create `client/src/components/VirtualJoystick.tsx`:

```tsx
import { useRef, useState } from "react";
import type { Point } from "../game/world";

type VirtualJoystickProps = {
  onVectorChange: (vector: Point) => void;
};

const radius = 30;

function normalize(dx: number, dy: number): Point {
  const distance = Math.hypot(dx, dy);
  if (distance === 0) return { x: 0, y: 0 };
  const limited = Math.min(distance, radius);
  const x = (dx / distance) * (limited / radius);
  const y = (dy / distance) * (limited / radius);
  return {
    x: Number(x.toFixed(2)),
    y: Number(y.toFixed(2))
  };
}

export function VirtualJoystick({ onVectorChange }: VirtualJoystickProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [thumb, setThumb] = useState<Point>({ x: 0, y: 0 });

  function update(clientX: number, clientY: number) {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const vector = normalize(clientX - centerX, clientY - centerY);
    setThumb({ x: vector.x * radius, y: vector.y * radius });
    onVectorChange(vector);
  }

  function release() {
    setThumb({ x: 0, y: 0 });
    onVectorChange({ x: 0, y: 0 });
  }

  return (
    <div
      ref={rootRef}
      className="virtual-joystick"
      role="application"
      aria-label="가상 조이스틱"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        update(event.clientX, event.clientY);
      }}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) update(event.clientX, event.clientY);
      }}
      onPointerUp={release}
      onPointerCancel={release}
    >
      <span style={{ transform: `translate(${thumb.x}px, ${thumb.y}px)` }} />
    </div>
  );
}
```

- [ ] **Step 4: Wire joystick into GameWorld**

Modify `client/src/components/GameWorld.tsx`:

Add import:

```tsx
import { VirtualJoystick } from "./VirtualJoystick";
import { directionFromVector } from "../game/movement";
```

Add state:

```tsx
const [joystickVector, setJoystickVector] = useState<Point>({ x: 0, y: 0 });
```

Inside the animation loop, before the target movement block:

```tsx
if (Math.hypot(joystickVector.x, joystickVector.y) > 0.05) {
  setPosition((current) => computeNextPosition({
    current,
    target: {
      x: current.x + joystickVector.x * 120,
      y: current.y + joystickVector.y * 120
    },
    deltaMs,
    speed,
    world: gardenWorld
  }));
  return;
}
```

Add below `world-actions`:

```tsx
<VirtualJoystick
  onVectorChange={(vector) => {
    setJoystickVector(vector);
    if (Math.hypot(vector.x, vector.y) > 0.05) {
      setTarget(null);
      directionFromVector(vector);
    }
  }}
/>
```

- [ ] **Step 5: Add joystick styles**

Append to `client/src/styles.css`:

```css
.virtual-joystick {
  position: absolute;
  left: 18px;
  bottom: 18px;
  width: 78px;
  height: 78px;
  border: 2px solid rgba(44, 37, 34, 0.72);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.52);
  touch-action: none;
  display: grid;
  place-items: center;
}

.virtual-joystick span {
  width: 28px;
  height: 28px;
  border-radius: 999px;
  background: rgba(44, 37, 34, 0.55);
}
```

- [ ] **Step 6: Run checks**

Run:

```bash
npm run test -w client -- VirtualJoystick GameWorld
npm run typecheck -w client
```

Expected: both commands exit with code 0.

- [ ] **Step 7: Commit**

```bash
git add client/src/components/VirtualJoystick.tsx client/src/components/VirtualJoystick.test.tsx client/src/components/GameWorld.tsx client/src/styles.css
git commit -m "feat: add virtual joystick movement"
```

---

## Execution Notes

- Use a fresh task branch or worktree before implementation if this repository is shared with other work.
- Keep each task commit small; do not batch unrelated tasks.
- Run the task-specific checks before each commit.
- Run full `npm run test`, `npm run typecheck`, and `npm run build` before browser verification.
- The Worker `wrangler.toml` uses a development D1 ID. Replace `database_id` only when creating the real Cloudflare D1 database during deployment.
