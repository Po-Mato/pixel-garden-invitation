import type { SpotId } from "@wedding-game/shared";

export type Point = { x: number; y: number };
export type Rect = { x: number; y: number; width: number; height: number };

export type WorldSpot = Rect & {
  id: SpotId;
  label: string;
  actionRadius: number;
};

export type WorldNpc = {
  id: "groom" | "bride";
  label: string;
  x: number;
  y: number;
};

export type GardenWorld = {
  bounds: Rect;
  spawn: Point;
  blocked: Rect[];
  spots: WorldSpot[];
  npcs: WorldNpc[];
};

export const gardenWorld: GardenWorld = {
  bounds: { x: 0, y: 0, width: 390, height: 720 },
  spawn: { x: 195, y: 525 },
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
  ],
  npcs: [
    { id: "groom", label: "신랑 이서준", x: 255, y: 255 },
    { id: "bride", label: "신부 김하린", x: 315, y: 255 }
  ]
};
