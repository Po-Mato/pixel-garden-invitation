import {
  invitationContent,
  realtimeWorldContract,
  type Direction,
  type SpotId,
  type WorldZoneId
} from "@wedding-game/shared";

export type Point = { x: number; y: number };
export type Rect = { x: number; y: number; width: number; height: number };

export type WorldSpot = Rect & {
  id: SpotId;
  label: string;
  actionRadius: number;
};

export type WorldPhotoSpotId = "lobby-photo-wall" | "bridal-flower-wall" | "ceremony-aisle";
export type WorldPhotoPose = "wave" | "flower-heart" | "hearts";
export type WorldPhotoCast = "bride" | "couple";

export type WorldPhotoSpot = Rect & {
  id: WorldPhotoSpotId;
  zoneId: WorldZoneId;
  label: string;
  sceneLabel: string;
  actionRadius: number;
  cast: WorldPhotoCast;
  backgroundCrop: Rect;
  previewPosition: string;
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
  | "party-flag"
  | "sofa"
  | "door"
  | "window"
  | "shoe-rack"
  | "crosswalk-sign"
  | "station-sign"
  | "train-seat"
  | "train-window"
  | "venue-sign"
  | "reception-desk"
  | "photo-wall"
  | "vanity"
  | "mirror"
  | "restroom-sink"
  | "stall"
  | "ceremony-seat"
  | "altar"
  | "banquet-table"
  | "buffet";

export type WorldDecoration = Rect & {
  id: string;
  kind: WorldDecorationKind;
  label: string;
  asset?: string;
  depthY?: number;
};

export type WorldPathKind =
  | "floor"
  | "street"
  | "crosswalk"
  | "platform"
  | "carriage"
  | "garden"
  | "lobby"
  | "corridor"
  | "aisle"
  | "banquet";

export type WorldPath = Rect & {
  id: string;
  kind: WorldPathKind;
};

export type WorldPortal = Rect & {
  id: string;
  label: string;
  to: WorldZoneId;
  approach: Point;
  entryTiles: Point[];
  facing: Direction;
  spawn: Point;
};

export const portalEntryTileSize = 30;

function createPortalEntryTiles(approach: Point, facing: Direction): Point[] {
  const offsets = [-portalEntryTileSize, 0, portalEntryTileSize];

  return offsets.map((offset) => (
    facing === "up" || facing === "down"
      ? { x: approach.x + offset, y: approach.y }
      : { x: approach.x, y: approach.y + offset }
  ));
}

export function portalEntryRect(portal: WorldPortal): Rect {
  const xs = portal.entryTiles.map((tile) => tile.x);
  const ys = portal.entryTiles.map((tile) => tile.y);
  const halfTile = portalEntryTileSize / 2;
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return {
    x: minX - halfTile,
    y: minY - halfTile,
    width: maxX - minX + portalEntryTileSize,
    height: maxY - minY + portalEntryTileSize
  };
}

export function pointInPortalEntry(portal: WorldPortal, point: Point): boolean {
  const halfTile = portalEntryTileSize / 2;

  return portal.entryTiles.some((tile) => (
    point.x >= tile.x - halfTile &&
    point.x <= tile.x + halfTile &&
    point.y >= tile.y - halfTile &&
    point.y <= tile.y + halfTile
  ));
}

export type WorldZone = {
  id: WorldZoneId;
  label: string;
  subtitle: string;
  theme: WorldZoneId;
  journeyIndex: number;
  bounds: Rect;
  cameraSafeBounds: Rect;
  spawn: Point;
  blocked: Rect[];
  paths: WorldPath[];
  spots: WorldSpot[];
  photoSpots: WorldPhotoSpot[];
  npcs: WorldNpc[];
  portals: WorldPortal[];
  decorations: WorldDecoration[];
};

export type GardenWorld = {
  defaultZoneId: WorldZoneId;
  zones: WorldZone[];
};

type ZoneInput = Omit<WorldZone, "theme" | "bounds" | "cameraSafeBounds" | "spawn" | "blocked" | "photoSpots"> & {
  blocked?: Rect[];
  photoSpots?: WorldPhotoSpot[];
};

const bounds = (width: number, height: number): Rect => ({ x: 0, y: 0, width, height });
const safeBounds = (width: number, height: number): Rect => ({ x: 30, y: 30, width: width - 60, height: height - 60 });

function createZone(input: ZoneInput): WorldZone {
  const realtime = realtimeWorldContract[input.id];
  const zoneBounds = bounds(realtime.bounds.width, realtime.bounds.height);

  return {
    ...input,
    theme: input.id,
    bounds: zoneBounds,
    cameraSafeBounds: safeBounds(zoneBounds.width, zoneBounds.height),
    spawn: { ...realtime.spawn },
    blocked: [...(input.blocked ?? []), ...input.spots],
    photoSpots: input.photoSpots ?? []
  };
}

const spot = (id: SpotId, label: string, x: number, y: number, width = 90, height = 72): WorldSpot => ({
  id,
  label,
  x,
  y,
  width,
  height,
  actionRadius: 72
});

const photoSpot = (
  id: WorldPhotoSpotId,
  zoneId: WorldZoneId,
  label: string,
  sceneLabel: string,
  rect: Rect,
  backgroundCrop: Rect,
  cast: WorldPhotoCast,
  previewPosition: string
): WorldPhotoSpot => ({
  id,
  zoneId,
  label,
  sceneLabel,
  ...rect,
  actionRadius: 84,
  cast,
  backgroundCrop,
  previewPosition
});

const path = (id: string, kind: WorldPathKind, x: number, y: number, width: number, height: number): WorldPath => ({
  id,
  kind,
  x,
  y,
  width,
  height
});

const decoration = (
  id: string,
  kind: WorldDecorationKind,
  label: string,
  x: number,
  y: number,
  width: number,
  height: number,
  visual?: { asset: string; depthY: number }
): WorldDecoration => ({ id, kind, label, x, y, width, height, ...visual });

const portal = (
  id: string,
  label: string,
  to: WorldZoneId,
  rect: Rect,
  approach: Point,
  facing: Direction,
  spawn: Point
): WorldPortal => ({
  id,
  label,
  to,
  ...rect,
  approach,
  entryTiles: createPortalEntryTiles(approach, facing),
  facing,
  spawn
});

const homeZone = createZone({
  id: "home",
  label: "우리 집",
  subtitle: "초대장을 챙겨 설레는 하루를 시작해요",
  journeyIndex: 0,
  paths: [
    path("home-floor", "floor", 90, 120, 420, 510),
    path("home-entry", "floor", 240, 60, 120, 120)
  ],
  spots: [spot("directions", "오시는 길", 90, 180, 120, 90)],
  npcs: [],
  portals: [
    portal("home-to-neighborhood", "동네로 나가기", "neighborhood", { x: 240, y: 30, width: 120, height: 90 }, { x: 285, y: 105 }, "up", { x: 135, y: 375 })
  ],
  blocked: [
    { x: 400, y: 110, width: 140, height: 290 },
    { x: 340, y: 290, width: 65, height: 135 },
    { x: 15, y: 565, width: 115, height: 130 },
    { x: 420, y: 480, width: 60, height: 90 }
  ],
  decorations: [
    decoration("home-window", "window", "아침빛 창문", 90, 600, 180, 90),
    decoration("home-sofa", "sofa", "거실 소파", 400, 110, 140, 290),
    decoration("home-table", "table", "작은 탁자", 340, 290, 65, 135),
    decoration("home-rack", "shoe-rack", "현관 신발장", 15, 565, 115, 130),
    decoration("home-door", "door", "현관문", 240, 30, 120, 90),
    decoration("home-plant", "topiary", "현관 화분", 420, 480, 60, 90, {
      asset: "topiary-foreground.png",
      depthY: 555
    }),
    decoration("home-mail", "mailbox", "청첩장 보관함", 90, 300, 90, 90),
    decoration("home-lamp", "lamp", "거실 조명", 450, 150, 30, 60)
  ]
});

const neighborhoodZone = createZone({
  id: "neighborhood",
  label: "동네 거리",
  subtitle: "새벽빛 골목과 횡단보도를 지나 지하철역으로",
  journeyIndex: 1,
  paths: [
    path("neighborhood-street", "street", 60, 240, 1080, 270),
    path("neighborhood-crosswalk", "crosswalk", 510, 180, 180, 390)
  ],
  spots: [],
  npcs: [],
  portals: [
    portal("neighborhood-to-home", "집으로 돌아가기", "home", { x: 30, y: 315, width: 90, height: 120 }, { x: 105, y: 375 }, "left", { x: 285, y: 135 }),
    portal("neighborhood-to-station", "지하철역 들어가기", "subway-station", { x: 1080, y: 300, width: 90, height: 150 }, { x: 1095, y: 375 }, "right", { x: 135, y: 435 })
  ],
  decorations: [
    decoration("street-tree-1", "tree", "가로수", 214, 90, 90, 150, {
      asset: "tree-canopy.png",
      depthY: 240
    }),
    decoration("street-tree-2", "tree", "가로수", 513, 90, 90, 150, {
      asset: "tree-canopy.png",
      depthY: 240
    }),
    decoration("street-tree-3", "tree", "가로수", 860, 90, 90, 150, {
      asset: "tree-canopy.png",
      depthY: 240
    }),
    decoration("street-lamp-1", "lamp", "가로등", 450, 120, 30, 75),
    decoration("street-lamp-2", "lamp", "가로등", 825, 120, 30, 75),
    decoration("street-bench", "bench", "골목 벤치", 210, 195, 90, 45),
    decoration("street-sign", "crosswalk-sign", "횡단보도 표지", 495, 180, 45, 60),
    decoration("street-flower", "flower-bed", "골목 화단", 720, 480, 210, 60),
    decoration("street-station", "station-sign", "지하철역 간판", 1020, 150, 120, 75)
  ]
});

const subwayStationZone = createZone({
  id: "subway-station",
  label: "지하철 역사",
  subtitle: "노선 안내와 안전선을 따라 승강장으로 이동해요",
  journeyIndex: 2,
  paths: [
    path("station-concourse", "floor", 60, 300, 600, 270),
    path("station-platform-approach", "corridor", 330, 240, 240, 390),
    path("station-platform", "platform", 600, 120, 210, 600)
  ],
  spots: [spot("directions", "지하철 오시는 길", 120, 150, 120, 90)],
  npcs: [],
  portals: [
    portal("station-to-neighborhood", "거리로 나가기", "neighborhood", { x: 30, y: 375, width: 90, height: 120 }, { x: 105, y: 435 }, "left", { x: 1065, y: 375 }),
    portal("station-to-train", "열차 타기", "subway-train", { x: 750, y: 360, width: 90, height: 150 }, { x: 735, y: 435 }, "right", { x: 135, y: 285 })
  ],
  decorations: [
    decoration("station-sign", "station-sign", "노선 안내판", 180, 90, 300, 60),
    decoration("station-bench-1", "bench", "대합실 벤치", 270, 150, 120, 45),
    decoration("station-bench-2", "bench", "대합실 벤치", 420, 150, 120, 45),
    decoration("station-lamp-1", "lamp", "역사 기둥", 570, 60, 60, 120),
    decoration("station-lamp-2", "lamp", "역사 기둥", 600, 660, 60, 120),
    decoration("station-door", "door", "열차 출입문", 750, 360, 90, 150)
  ]
});

const subwayTrainZone = createZone({
  id: "subway-train",
  label: "지하철 차량",
  subtitle: "도시의 빛이 흐르는 긴 객차를 지나 하차해요",
  journeyIndex: 3,
  paths: [path("train-carriage", "carriage", 60, 180, 1320, 210)],
  spots: [],
  npcs: [],
  portals: [
    portal("train-to-station", "역사로 내리기", "subway-station", { x: 30, y: 210, width: 90, height: 150 }, { x: 105, y: 285 }, "left", { x: 705, y: 435 }),
    portal("train-to-venue", "예식장역 내리기", "venue-exterior", { x: 1320, y: 210, width: 90, height: 150 }, { x: 1335, y: 285 }, "right", { x: 465, y: 765 })
  ],
  decorations: [
    decoration("train-window-1", "train-window", "도시 창문", 180, 60, 150, 90),
    decoration("train-window-2", "train-window", "도시 창문", 420, 60, 150, 90),
    decoration("train-window-3", "train-window", "도시 창문", 660, 60, 150, 90),
    decoration("train-window-4", "train-window", "도시 창문", 900, 60, 150, 90),
    decoration("train-window-5", "train-window", "도시 창문", 1140, 60, 150, 90),
    decoration("train-seat-1", "train-seat", "청록 좌석", 150, 390, 168, 58),
    decoration("train-seat-2", "train-seat", "청록 좌석", 390, 390, 168, 58),
    decoration("train-seat-3", "train-seat", "청록 좌석", 630, 390, 168, 58),
    decoration("train-seat-4", "train-seat", "청록 좌석", 870, 390, 168, 58),
    decoration("train-seat-5", "train-seat", "청록 좌석", 1110, 390, 168, 58),
    decoration("train-straps", "string-lights", "객차 손잡이", 240, 105, 960, 120, {
      asset: "strap-row-foreground.png",
      depthY: 420
    }),
    decoration("train-door-1", "door", "객차 문", 30, 210, 90, 150),
    decoration("train-door-2", "door", "객차 문", 1320, 210, 90, 150)
  ]
});

const venueExteriorZone = createZone({
  id: "venue-exterior",
  label: "예식장 앞",
  subtitle: "꽃 간판과 유리문 너머로 축하의 공간이 보여요",
  journeyIndex: 4,
  paths: [
    path("venue-garden", "garden", 90, 570, 780, 180),
    path("venue-plaza", "garden", 240, 300, 480, 360),
    path("venue-central", "garden", 390, 60, 180, 780)
  ],
  blocked: [{ x: 240, y: 450, width: 120, height: 120 }],
  spots: [],
  npcs: [],
  portals: [
    portal("venue-to-train", "지하철역으로 돌아가기", "subway-train", { x: 420, y: 810, width: 90, height: 60 }, { x: 465, y: 795 }, "down", { x: 1305, y: 285 }),
    portal("venue-to-lobby", "예식장 로비 들어가기", "lobby", { x: 405, y: 30, width: 120, height: 90 }, { x: 465, y: 105 }, "up", { x: 525, y: 765 })
  ],
  decorations: [
    decoration("venue-building", "venue-sign", "예식장 유리 파사드", 300, 60, 360, 120),
    decoration("venue-door", "door", "예식장 유리문", 405, 30, 120, 90),
    decoration("venue-arch", "flower-arch", "코랄 꽃 아치", 360, 180, 240, 180, {
      asset: "flower-arch-front.png",
      depthY: 360
    }),
    decoration("venue-fountain", "fountain", "작은 수경 요소", 240, 450, 120, 120),
    decoration("venue-tree-1", "tree", "예식장 나무", 120, 330, 90, 135),
    decoration("venue-tree-2", "tree", "예식장 나무", 750, 330, 90, 135),
    decoration("venue-flower-1", "flower-bed", "정원 화단", 105, 570, 150, 60),
    decoration("venue-flower-2", "flower-bed", "정원 화단", 705, 570, 150, 60),
    decoration("venue-lamp-1", "lamp", "정원 조명", 330, 255, 30, 60),
    decoration("venue-lamp-2", "lamp", "정원 조명", 600, 255, 30, 60),
    decoration("venue-bench", "bench", "대기 벤치", 645, 705, 120, 45)
  ]
});

const lobbyZone = createZone({
  id: "lobby",
  label: "예식장 로비",
  subtitle: "축의대와 포토월을 지나 원하는 공간으로 이동해요",
  journeyIndex: 5,
  paths: [
    path("lobby-main", "lobby", 90, 300, 900, 300),
    path("lobby-vertical", "corridor", 420, 90, 240, 720),
    path("lobby-upper", "lobby", 90, 180, 900, 180),
    path("lobby-lower", "lobby", 90, 540, 900, 240)
  ],
  spots: [
    spot("wedding-info", "예식 안내", 180, 180, 120, 90),
    spot("rsvp", "축의대", 300, 630, 120, 90),
    spot("gallery", "웨딩 갤러리", 690, 180, 120, 90),
    spot("story", "우리 이야기", 780, 630, 120, 90)
  ],
  photoSpots: [
    photoSpot(
      "lobby-photo-wall",
      "lobby",
      "로비 포토월",
      "꽃빛 로비에서 남기는 첫 장",
      { x: 630, y: 450, width: 120, height: 60 },
      { x: 420, y: 90, width: 540, height: 510 },
      "couple",
      "67% 35%"
    )
  ],
  npcs: [],
  portals: [
    portal("lobby-to-venue", "예식장 밖으로", "venue-exterior", { x: 480, y: 810, width: 120, height: 60 }, { x: 525, y: 795 }, "down", { x: 465, y: 135 }),
    portal("lobby-to-bridal", "신부 대기실", "bridal-room", { x: 30, y: 345, width: 90, height: 120 }, { x: 105, y: 405 }, "left", { x: 345, y: 525 }),
    portal("lobby-to-banquet", "연회장", "banquet", { x: 960, y: 345, width: 90, height: 120 }, { x: 975, y: 405 }, "right", { x: 135, y: 465 }),
    portal("lobby-to-hall", "예식홀", "ceremony-hall", { x: 480, y: 30, width: 120, height: 90 }, { x: 525, y: 105 }, "up", { x: 375, y: 1785 })
  ],
  blocked: [{ x: 450, y: 300, width: 180, height: 120 }],
  decorations: [
    decoration("lobby-desk", "reception-desk", "안내 데스크", 450, 320, 180, 120, {
      asset: "reception-desk-front.png",
      depthY: 420
    }),
    decoration("lobby-photo", "photo-wall", "꽃 포토월", 610, 180, 165, 96),
    decoration("lobby-sofa-1", "sofa", "로비 소파", 120, 520, 130, 72),
    decoration("lobby-sofa-2", "sofa", "로비 소파", 620, 500, 130, 72),
    decoration("lobby-flower-1", "flower-bed", "로비 꽃장식", 90, 210, 120, 46),
    decoration("lobby-flower-2", "flower-bed", "로비 꽃장식", 760, 210, 120, 46),
    decoration("lobby-lamp-1", "lamp", "진주 조명", 350, 180, 28, 58),
    decoration("lobby-lamp-2", "lamp", "진주 조명", 580, 180, 28, 58),
    decoration("lobby-banner", "banner", "환영 가랜드", 360, 90, 240, 36)
  ]
});

const bridalRoomZone = createZone({
  id: "bridal-room",
  label: "신부 대기실",
  subtitle: "꽃벽 앞 신부에게 축하 인사를 건네요",
  journeyIndex: 6,
  paths: [
    path("bridal-floor", "floor", 90, 90, 540, 450),
    path("bridal-entry", "floor", 300, 510, 120, 90)
  ],
  spots: [spot("couple", "신부에게 인사하기", 150, 150, 120, 90)],
  photoSpots: [
    photoSpot(
      "bridal-flower-wall",
      "bridal-room",
      "신부 대기실 포토존",
      "꽃벽 앞에서 신부와 함께",
      { x: 360, y: 360, width: 90, height: 60 },
      { x: 90, y: 60, width: 540, height: 510 },
      "bride",
      "50% 42%"
    )
  ],
  npcs: [{ id: "bride", label: `신부 ${invitationContent.event.couple.bride}`, x: 360, y: 285 }],
  portals: [
    portal("bridal-to-lobby", "로비로 돌아가기", "lobby", { x: 300, y: 540, width: 120, height: 60 }, { x: 345, y: 555 }, "down", { x: 135, y: 405 })
  ],
  blocked: [
    { x: 90, y: 330, width: 180, height: 90 },
    { x: 510, y: 240, width: 90, height: 120 }
  ],
  decorations: [
    decoration("bridal-flower-front", "flower-bed", "대기실 전경 꽃장식", 240, 300, 90, 120, {
      asset: "flower-arrangement-front.png",
      depthY: 420
    })
  ]
});

const ceremonyHallZone = createZone({
  id: "ceremony-hall",
  label: "예식홀",
  subtitle: "긴 버진로드 끝에서 두 사람의 약속을 함께해요",
  journeyIndex: 7,
  paths: [
    path("hall-aisle", "aisle", 300, 90, 180, 1740),
    path("hall-altar-cross", "aisle", 180, 120, 420, 240),
    path("hall-entry", "corridor", 240, 1740, 300, 120)
  ],
  spots: [spot("couple", "신랑신부", 180, 150, 90, 90)],
  photoSpots: [
    photoSpot(
      "ceremony-aisle",
      "ceremony-hall",
      "버진로드 포토존",
      "두 사람과 함께 남기는 축하의 순간",
      { x: 330, y: 390, width: 120, height: 60 },
      { x: 120, y: 30, width: 540, height: 510 },
      "couple",
      "50% 15%"
    )
  ],
  npcs: [
    { id: "groom", label: `신랑 ${invitationContent.event.couple.groom}`, x: 360, y: 255 },
    { id: "bride", label: `신부 ${invitationContent.event.couple.bride}`, x: 420, y: 255 }
  ],
  portals: [
    portal("hall-to-lobby", "로비로 돌아가기", "lobby", { x: 330, y: 1830, width: 120, height: 60 }, { x: 375, y: 1815 }, "down", { x: 525, y: 135 })
  ],
  decorations: [
    decoration("hall-ceremony-arch", "flower-arch", "예식홀 꽃 아치", 180, 30, 420, 300, {
      asset: "ceremony-arch-front.png",
      depthY: 330
    }),
    decoration("hall-altar-table-front", "altar", "예식홀 중앙 꽃 테이블", 300, 165, 180, 120, {
      asset: "altar-table-front.png",
      depthY: 240
    }),
    decoration("hall-altar", "altar", "웨딩 단상", 195, 105, 270, 105),
    decoration("hall-seat-l1", "ceremony-seat", "하객 좌석", 45, 360, 150, 120),
    decoration("hall-seat-r1", "ceremony-seat", "하객 좌석", 465, 360, 150, 120),
    decoration("hall-seat-l2", "ceremony-seat", "하객 좌석", 45, 690, 150, 120),
    decoration("hall-seat-r2", "ceremony-seat", "하객 좌석", 465, 690, 150, 120),
    decoration("hall-seat-l3", "ceremony-seat", "하객 좌석", 45, 1020, 150, 120),
    decoration("hall-seat-r3", "ceremony-seat", "하객 좌석", 465, 1020, 150, 120),
    decoration("hall-seat-l4", "ceremony-seat", "하객 좌석", 45, 1350, 150, 120),
    decoration("hall-seat-r4", "ceremony-seat", "하객 좌석", 465, 1350, 150, 120),
    decoration("hall-flowers-1", "aisle-bouquet", "버진로드 꽃장식", 240, 480, 60, 90, {
      asset: "aisle-bouquet-front.png",
      depthY: 570
    }),
    decoration("hall-flowers-2", "aisle-bouquet", "버진로드 꽃장식", 480, 720, 60, 90, {
      asset: "aisle-bouquet-front.png",
      depthY: 810
    }),
    decoration("hall-flowers-3", "aisle-bouquet", "버진로드 꽃장식", 240, 960, 60, 90, {
      asset: "aisle-bouquet-front.png",
      depthY: 1050
    }),
    decoration("hall-flowers-4", "aisle-bouquet", "버진로드 꽃장식", 480, 1200, 60, 90, {
      asset: "aisle-bouquet-front.png",
      depthY: 1290
    }),
    decoration("hall-lights", "string-lights", "예식홀 조명", 105, 260, 450, 32)
  ]
});

const restroomZone = createZone({
  id: "restroom",
  label: "화장실",
  subtitle: "연회장 옆 밝은 테라조 공간에서 잠시 단정히 준비해요",
  journeyIndex: 9,
  paths: [
    path("restroom-floor", "floor", 90, 150, 480, 390),
    path("restroom-entry", "floor", 60, 270, 90, 150)
  ],
  spots: [],
  npcs: [],
  portals: [
    portal("restroom-to-banquet", "연회장으로 돌아가기", "banquet", { x: 30, y: 285, width: 90, height: 120 }, { x: 105, y: 345 }, "left", { x: 1065, y: 465 })
  ],
  blocked: [
    { x: 150, y: 150, width: 240, height: 90 },
    { x: 420, y: 240, width: 150, height: 240 }
  ],
  decorations: [
    decoration("restroom-mirror-1", "mirror", "조명 거울", 150, 60, 105, 90),
    decoration("restroom-mirror-2", "mirror", "조명 거울", 285, 60, 105, 90),
    decoration("restroom-sinks", "restroom-sink", "세면대", 150, 150, 240, 90),
    decoration("restroom-plant", "topiary", "민트 화분", 240, 450, 60, 72),
    decoration("restroom-door", "door", "연회장 출입문", 30, 285, 90, 120),
    decoration("restroom-terrazzo", "mosaic-star", "테라조 포인트", 180, 450, 120, 60),
    decoration("restroom-lamp", "lamp", "화이트 조명", 450, 90, 36, 72)
  ]
});

const banquetZone = createZone({
  id: "banquet",
  label: "연회장",
  subtitle: "맛있는 식사와 축하 메시지를 함께 나눠요",
  journeyIndex: 8,
  paths: [
    path("banquet-floor", "banquet", 60, 90, 1080, 750),
    path("banquet-central", "corridor", 60, 360, 1080, 210)
  ],
  spots: [spot("guestbook", "축하 메시지", 990, 690, 120, 90)],
  npcs: [],
  portals: [
    portal("banquet-to-lobby", "로비로 돌아가기", "lobby", { x: 30, y: 405, width: 90, height: 120 }, { x: 105, y: 465 }, "left", { x: 945, y: 405 }),
    portal("banquet-to-restroom", "화장실", "restroom", { x: 1080, y: 405, width: 90, height: 120 }, { x: 1095, y: 465 }, "right", { x: 135, y: 345 })
  ],
  blocked: [
    { x: 210, y: 270, width: 240, height: 240 },
    { x: 690, y: 270, width: 240, height: 240 },
    { x: 210, y: 570, width: 240, height: 240 },
    { x: 690, y: 570, width: 240, height: 240 },
    { x: 450, y: 90, width: 300, height: 90 }
  ],
  decorations: [
    decoration("banquet-table-1", "banquet-table", "꽃장식 하객 테이블", 210, 270, 240, 240, {
      asset: "table-floral.png",
      depthY: 510
    }),
    decoration("banquet-table-2", "banquet-table", "식사 하객 테이블", 690, 270, 240, 240, {
      asset: "table-dining.png",
      depthY: 510
    }),
    decoration("banquet-table-3", "banquet-table", "식사 하객 테이블", 210, 570, 240, 240, {
      asset: "table-dining.png",
      depthY: 810
    }),
    decoration("banquet-table-4", "banquet-table", "꽃장식 하객 테이블", 690, 570, 240, 240, {
      asset: "table-floral.png",
      depthY: 810
    }),
    decoration("banquet-buffet", "buffet", "웨딩 뷔페", 450, 90, 300, 90),
    decoration("banquet-banner", "party-flag", "축하 가랜드", 360, 60, 480, 36),
    decoration("banquet-guestbook", "dessert-cart", "축하 메시지 콘솔", 990, 690, 120, 90),
    decoration("banquet-lobby-door", "door", "로비 출입문", 30, 405, 90, 120),
    decoration("banquet-restroom-door", "door", "화장실 출입문", 1080, 405, 90, 120)
  ]
});

export const gardenWorld: GardenWorld = {
  defaultZoneId: "home",
  zones: [
    homeZone,
    neighborhoodZone,
    subwayStationZone,
    subwayTrainZone,
    venueExteriorZone,
    lobbyZone,
    bridalRoomZone,
    ceremonyHallZone,
    banquetZone,
    restroomZone
  ]
};

export function getWorldZone(world: GardenWorld, zoneId: WorldZoneId): WorldZone {
  return world.zones.find((zone) => zone.id === zoneId) ?? world.zones[0];
}

export function getZoneForSpot(world: GardenWorld, spotId: SpotId): WorldZone {
  return world.zones.find((zone) => zone.spots.some((item) => item.id === spotId)) ?? getWorldZone(world, world.defaultZoneId);
}
