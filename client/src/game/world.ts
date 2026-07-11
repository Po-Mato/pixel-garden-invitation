import type { SpotId, WorldZoneId } from "@wedding-game/shared";

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

export type WorldDecorationKind =
  | "flower-bed"
  | "tree"
  | "lamp"
  | "banner"
  | "pond"
  | "bench"
  | "photo-frame"
  | "mailbox"
  | "table"
  | "fountain"
  | "flower-arch"
  | "petal-scatter"
  | "butterfly"
  | "topiary"
  | "string-lights"
  | "rose-pillar"
  | "gift-stack"
  | "dessert-cart"
  | "star-garland"
  | "flower-fence"
  | "lily-cluster"
  | "ribbon-post"
  | "aisle-bouquet"
  | "mosaic-star"
  | "tea-chair"
  | "party-flag";

export type WorldDecoration = Rect & {
  id: string;
  kind: WorldDecorationKind;
  label: string;
};

export type WorldPortal = Rect & {
  id: string;
  label: string;
  to: WorldZoneId;
  spawn: Point;
};

export type WorldZone = {
  id: WorldZoneId;
  label: string;
  subtitle: string;
  bounds: Rect;
  spawn: Point;
  blocked: Rect[];
  spots: WorldSpot[];
  npcs: WorldNpc[];
  portals: WorldPortal[];
  decorations: WorldDecoration[];
};

export type GardenWorld = WorldZone & {
  defaultZoneId: WorldZoneId;
  zones: WorldZone[];
};

const ceremonyZone: WorldZone = {
  id: "ceremony",
  label: "예식장",
  subtitle: "신랑신부와 예식 안내를 만나는 중앙 정원",
  bounds: { x: 0, y: 0, width: 390, height: 720 },
  spawn: { x: 195, y: 525 },
  blocked: [
    { x: 150, y: 48, width: 90, height: 82 },
    { x: 274, y: 154, width: 82, height: 70 },
    { x: 34, y: 332, width: 82, height: 70 }
  ],
  spots: [
    { id: "wedding-info", label: "예식 안내", x: 150, y: 48, width: 90, height: 82, actionRadius: 64 },
    { id: "couple", label: "신랑신부", x: 274, y: 154, width: 82, height: 70, actionRadius: 58 },
    { id: "story", label: "스토리", x: 34, y: 332, width: 82, height: 70, actionRadius: 58 }
  ],
  npcs: [
    { id: "groom", label: "신랑 이서준", x: 235, y: 280 },
    { id: "bride", label: "신부 김하린", x: 335, y: 280 }
  ],
  portals: [
    { id: "to-entrance", label: "입구", to: "entrance", x: 156, y: 642, width: 78, height: 44, spawn: { x: 195, y: 165 } },
    { id: "to-gallery", label: "갤러리", to: "gallery", x: 18, y: 468, width: 62, height: 48, spawn: { x: 255, y: 405 } },
    { id: "to-lounge", label: "라운지", to: "lounge", x: 310, y: 468, width: 62, height: 48, spawn: { x: 135, y: 405 } }
  ],
  decorations: [
    { id: "ceremony-fountain", kind: "fountain", label: "작은 분수", x: 172, y: 172, width: 46, height: 46 },
    { id: "ceremony-banner", kind: "banner", label: "웨딩 가랜드", x: 118, y: 16, width: 154, height: 24 },
    { id: "ceremony-flower-left", kind: "flower-bed", label: "장미 화단", x: 14, y: 214, width: 88, height: 42 },
    { id: "ceremony-flower-right", kind: "flower-bed", label: "장미 화단", x: 286, y: 350, width: 88, height: 42 },
    { id: "ceremony-tree-left", kind: "tree", label: "정원 나무", x: 12, y: 42, width: 54, height: 72 },
    { id: "ceremony-tree-right", kind: "tree", label: "정원 나무", x: 324, y: 42, width: 54, height: 72 },
    { id: "ceremony-lamp-left", kind: "lamp", label: "정원등", x: 112, y: 436, width: 24, height: 48 },
    { id: "ceremony-lamp-right", kind: "lamp", label: "정원등", x: 254, y: 436, width: 24, height: 48 },
    { id: "ceremony-bench", kind: "bench", label: "나무 벤치", x: 274, y: 596, width: 76, height: 36 },
    { id: "ceremony-lights", kind: "string-lights", label: "반짝이는 예식 조명", x: 88, y: 132, width: 214, height: 18 },
    { id: "ceremony-rose-left", kind: "rose-pillar", label: "장미 기둥", x: 96, y: 112, width: 30, height: 62 },
    { id: "ceremony-rose-right", kind: "rose-pillar", label: "장미 기둥", x: 242, y: 112, width: 30, height: 62 },
    { id: "ceremony-petals-one", kind: "petal-scatter", label: "흩날리는 꽃잎", x: 126, y: 278, width: 54, height: 32 },
    { id: "ceremony-petals-two", kind: "petal-scatter", label: "흩날리는 꽃잎", x: 216, y: 372, width: 58, height: 34 },
    { id: "ceremony-butterfly", kind: "butterfly", label: "정원 나비", x: 62, y: 414, width: 28, height: 24 },
    { id: "ceremony-aisle-left", kind: "aisle-bouquet", label: "버진로드 꽃장식", x: 132, y: 526, width: 30, height: 44 },
    { id: "ceremony-aisle-right", kind: "aisle-bouquet", label: "버진로드 꽃장식", x: 228, y: 526, width: 30, height: 44 },
    { id: "ceremony-ribbon-post", kind: "ribbon-post", label: "웨딩 리본 기둥", x: 86, y: 568, width: 26, height: 46 }
  ]
};

const entranceZone: WorldZone = {
  id: "entrance",
  label: "입구",
  subtitle: "오시는 길과 첫 안내를 확인하는 시작 구역",
  bounds: { x: 0, y: 0, width: 390, height: 720 },
  spawn: { x: 195, y: 165 },
  blocked: [
    { x: 40, y: 92, width: 104, height: 78 },
    { x: 246, y: 92, width: 104, height: 78 },
    { x: 150, y: 456, width: 90, height: 82 }
  ],
  spots: [
    { id: "directions", label: "오시는 길", x: 40, y: 92, width: 104, height: 78, actionRadius: 66 },
    { id: "wedding-info", label: "예식 안내", x: 246, y: 92, width: 104, height: 78, actionRadius: 66 }
  ],
  npcs: [],
  portals: [
    { id: "to-ceremony", label: "예식장", to: "ceremony", x: 150, y: 456, width: 90, height: 82, spawn: { x: 195, y: 585 } }
  ],
  decorations: [
    { id: "entrance-banner", kind: "banner", label: "환영 가랜드", x: 110, y: 24, width: 170, height: 30 },
    { id: "entrance-tree-left", kind: "tree", label: "입구 나무", x: 18, y: 208, width: 58, height: 76 },
    { id: "entrance-tree-right", kind: "tree", label: "입구 나무", x: 314, y: 208, width: 58, height: 76 },
    { id: "entrance-pond", kind: "pond", label: "연못", x: 22, y: 548, width: 108, height: 76 },
    { id: "entrance-bench", kind: "bench", label: "대기 벤치", x: 266, y: 568, width: 84, height: 38 },
    { id: "entrance-lamp-left", kind: "lamp", label: "입구 조명", x: 126, y: 330, width: 24, height: 48 },
    { id: "entrance-lamp-right", kind: "lamp", label: "입구 조명", x: 240, y: 330, width: 24, height: 48 },
    { id: "entrance-flowers", kind: "flower-bed", label: "환영 화단", x: 270, y: 642, width: 90, height: 38 },
    { id: "entrance-flower-arch", kind: "flower-arch", label: "환영 꽃 아치", x: 142, y: 188, width: 106, height: 102 },
    { id: "entrance-butterfly-left", kind: "butterfly", label: "환영 나비", x: 82, y: 286, width: 28, height: 24 },
    { id: "entrance-butterfly-right", kind: "butterfly", label: "환영 나비", x: 292, y: 438, width: 28, height: 24 },
    { id: "entrance-topiary", kind: "topiary", label: "리본 토피어리", x: 24, y: 348, width: 46, height: 70 },
    { id: "entrance-lights", kind: "string-lights", label: "환영 조명 줄", x: 92, y: 414, width: 206, height: 24 },
    { id: "entrance-petals", kind: "petal-scatter", label: "환영 꽃잎", x: 154, y: 292, width: 82, height: 34 },
    { id: "entrance-lilies", kind: "lily-cluster", label: "연못 수련", x: 42, y: 570, width: 62, height: 32 },
    { id: "entrance-ribbon-post", kind: "ribbon-post", label: "환영 리본 기둥", x: 278, y: 488, width: 28, height: 48 },
    { id: "entrance-flower-fence", kind: "flower-fence", label: "입구 꽃 울타리", x: 138, y: 666, width: 114, height: 30 }
  ]
};

const galleryZone: WorldZone = {
  id: "gallery",
  label: "갤러리",
  subtitle: "사진과 연애 스토리를 따라 걷는 전시 구역",
  bounds: { x: 0, y: 0, width: 390, height: 720 },
  spawn: { x: 255, y: 405 },
  blocked: [
    { x: 48, y: 110, width: 96, height: 78 },
    { x: 48, y: 312, width: 96, height: 78 },
    { x: 150, y: 580, width: 90, height: 70 }
  ],
  spots: [
    { id: "gallery", label: "갤러리", x: 48, y: 110, width: 96, height: 78, actionRadius: 66 },
    { id: "story", label: "스토리", x: 48, y: 312, width: 96, height: 78, actionRadius: 66 }
  ],
  npcs: [],
  portals: [
    { id: "to-ceremony", label: "예식장", to: "ceremony", x: 300, y: 386, width: 62, height: 48, spawn: { x: 105, y: 495 } }
  ],
  decorations: [
    { id: "gallery-frame-one", kind: "photo-frame", label: "웨딩 사진 액자", x: 222, y: 70, width: 72, height: 86 },
    { id: "gallery-frame-two", kind: "photo-frame", label: "추억 사진 액자", x: 300, y: 178, width: 62, height: 76 },
    { id: "gallery-frame-three", kind: "photo-frame", label: "데이트 사진 액자", x: 198, y: 278, width: 70, height: 84 },
    { id: "gallery-lamp", kind: "lamp", label: "전시 조명", x: 166, y: 132, width: 24, height: 48 },
    { id: "gallery-bench", kind: "bench", label: "감상 벤치", x: 42, y: 478, width: 90, height: 40 },
    { id: "gallery-flowers", kind: "flower-bed", label: "전시 화단", x: 252, y: 510, width: 104, height: 42 },
    { id: "gallery-tree", kind: "tree", label: "보랏빛 정원 나무", x: 20, y: 606, width: 58, height: 76 },
    { id: "gallery-stars", kind: "star-garland", label: "별빛 전시 가랜드", x: 154, y: 28, width: 210, height: 30 },
    { id: "gallery-lights", kind: "string-lights", label: "전시 조명 줄", x: 154, y: 194, width: 206, height: 24 },
    { id: "gallery-petals", kind: "petal-scatter", label: "라벤더 꽃잎", x: 154, y: 400, width: 78, height: 34 },
    { id: "gallery-butterfly", kind: "butterfly", label: "라벤더 나비", x: 326, y: 286, width: 28, height: 24 },
    { id: "gallery-topiary", kind: "topiary", label: "별 리본 토피어리", x: 304, y: 612, width: 48, height: 70 },
    { id: "gallery-frame-four", kind: "photo-frame", label: "약속 사진 액자", x: 148, y: 566, width: 64, height: 78 },
    { id: "gallery-mosaic-one", kind: "mosaic-star", label: "전시 모자이크 별", x: 162, y: 236, width: 30, height: 30 },
    { id: "gallery-mosaic-two", kind: "mosaic-star", label: "전시 모자이크 별", x: 278, y: 346, width: 30, height: 30 },
    { id: "gallery-flower-fence", kind: "flower-fence", label: "라벤더 꽃 울타리", x: 92, y: 650, width: 138, height: 30 }
  ]
};

const loungeZone: WorldZone = {
  id: "lounge",
  label: "라운지",
  subtitle: "참석 답변과 축하 메시지를 남기는 하객 구역",
  bounds: { x: 0, y: 0, width: 390, height: 720 },
  spawn: { x: 135, y: 405 },
  blocked: [
    { x: 246, y: 110, width: 96, height: 78 },
    { x: 246, y: 312, width: 96, height: 78 },
    { x: 150, y: 580, width: 90, height: 70 }
  ],
  spots: [
    { id: "rsvp", label: "RSVP", x: 246, y: 110, width: 96, height: 78, actionRadius: 66 },
    { id: "guestbook", label: "방명록", x: 246, y: 312, width: 96, height: 78, actionRadius: 66 }
  ],
  npcs: [],
  portals: [
    { id: "to-ceremony", label: "예식장", to: "ceremony", x: 28, y: 386, width: 62, height: 48, spawn: { x: 285, y: 495 } }
  ],
  decorations: [
    { id: "lounge-mailbox", kind: "mailbox", label: "축하 우편함", x: 62, y: 104, width: 58, height: 66 },
    { id: "lounge-table-one", kind: "table", label: "하객 테이블", x: 102, y: 220, width: 72, height: 54 },
    { id: "lounge-table-two", kind: "table", label: "하객 테이블", x: 162, y: 320, width: 72, height: 54 },
    { id: "lounge-bench", kind: "bench", label: "휴식 벤치", x: 36, y: 524, width: 92, height: 40 },
    { id: "lounge-lamp", kind: "lamp", label: "라운지 조명", x: 196, y: 102, width: 24, height: 48 },
    { id: "lounge-flowers", kind: "flower-bed", label: "라운지 화단", x: 246, y: 492, width: 112, height: 42 },
    { id: "lounge-tree", kind: "tree", label: "그늘 나무", x: 18, y: 622, width: 58, height: 76 },
    { id: "lounge-gifts", kind: "gift-stack", label: "축하 선물 더미", x: 42, y: 192, width: 54, height: 54 },
    { id: "lounge-dessert-cart", kind: "dessert-cart", label: "웨딩 디저트 카트", x: 112, y: 450, width: 94, height: 62 },
    { id: "lounge-lights", kind: "string-lights", label: "티파티 조명 줄", x: 36, y: 32, width: 318, height: 26 },
    { id: "lounge-topiary", kind: "topiary", label: "하트 토피어리", x: 310, y: 610, width: 48, height: 72 },
    { id: "lounge-petals", kind: "petal-scatter", label: "축하 꽃잎", x: 164, y: 570, width: 72, height: 34 },
    { id: "lounge-table-three", kind: "table", label: "미니 티 테이블", x: 116, y: 86, width: 64, height: 50 },
    { id: "lounge-chair-left", kind: "tea-chair", label: "리본 티 체어", x: 70, y: 272, width: 40, height: 46 },
    { id: "lounge-chair-right", kind: "tea-chair", label: "리본 티 체어", x: 202, y: 260, width: 40, height: 46 },
    { id: "lounge-party-flags", kind: "party-flag", label: "축하 파티 플래그", x: 98, y: 410, width: 182, height: 28 }
  ]
};

export const gardenWorld: GardenWorld = {
  ...ceremonyZone,
  defaultZoneId: "ceremony",
  zones: [entranceZone, ceremonyZone, galleryZone, loungeZone]
};

export function getWorldZone(world: GardenWorld, zoneId: WorldZoneId): WorldZone {
  return world.zones.find((zone) => zone.id === zoneId) ?? world;
}

export function getZoneForSpot(world: GardenWorld, spotId: SpotId): WorldZone {
  return world.zones.find((zone) => zone.spots.some((spot) => spot.id === spotId)) ?? world;
}
