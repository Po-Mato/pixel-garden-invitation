import type { WorldZoneId } from "./protocol";

export type RealtimeWorldZoneContract = Readonly<{
  spawn: Readonly<{ x: number; y: number }>;
  bounds: Readonly<{ width: number; height: number }>;
}>;

export const realtimeWorldContract = {
  home: { spawn: { x: 285, y: 555 }, bounds: { width: 600, height: 720 } },
  neighborhood: { spawn: { x: 135, y: 375 }, bounds: { width: 1200, height: 660 } },
  "subway-station": { spawn: { x: 135, y: 435 }, bounds: { width: 900, height: 840 } },
  "subway-train": { spawn: { x: 135, y: 285 }, bounds: { width: 1440, height: 540 } },
  "venue-exterior": { spawn: { x: 465, y: 765 }, bounds: { width: 960, height: 900 } },
  lobby: { spawn: { x: 525, y: 765 }, bounds: { width: 1080, height: 900 } },
  "bridal-room": { spawn: { x: 345, y: 525 }, bounds: { width: 720, height: 630 } },
  "ceremony-hall": { spawn: { x: 375, y: 1785 }, bounds: { width: 780, height: 1920 } },
  banquet: { spawn: { x: 135, y: 465 }, bounds: { width: 1200, height: 930 } },
  restroom: { spawn: { x: 135, y: 345 }, bounds: { width: 660, height: 660 } }
} as const satisfies Readonly<Record<WorldZoneId, RealtimeWorldZoneContract>>;
