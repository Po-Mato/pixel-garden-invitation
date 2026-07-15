import type { Direction, SpotId, WorldZoneId } from "@wedding-game/shared";

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
  | "party-flag"
  | "sofa"
  | "door"
  | "window"
  | "shoe-rack"
  | "crosswalk-sign"
  | "station-sign"
  | "ticket-gate"
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
  facing: Direction;
  spawn: Point;
};

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
  npcs: WorldNpc[];
  portals: WorldPortal[];
  decorations: WorldDecoration[];
};

export type GardenWorld = {
  defaultZoneId: WorldZoneId;
  zones: WorldZone[];
};

type ZoneInput = Omit<WorldZone, "theme" | "cameraSafeBounds" | "blocked"> & {
  blocked?: Rect[];
};

const bounds = (width: number, height: number): Rect => ({ x: 0, y: 0, width, height });
const safeBounds = (width: number, height: number): Rect => ({ x: 30, y: 30, width: width - 60, height: height - 60 });

function createZone(input: ZoneInput): WorldZone {
  return {
    ...input,
    theme: input.id,
    cameraSafeBounds: safeBounds(input.bounds.width, input.bounds.height),
    blocked: [...(input.blocked ?? []), ...input.spots]
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
): WorldPortal => ({ id, label, to, ...rect, approach, facing, spawn });

const homeZone = createZone({
  id: "home",
  label: "우리 집",
  subtitle: "초대장을 챙겨 설레는 하루를 시작해요",
  journeyIndex: 0,
  bounds: bounds(600, 720),
  spawn: { x: 285, y: 555 },
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
    { x: 360, y: 240, width: 150, height: 90 },
    { x: 270, y: 330, width: 120, height: 90 },
    { x: 90, y: 480, width: 120, height: 120 },
    { x: 420, y: 480, width: 60, height: 90 }
  ],
  decorations: [
    decoration("home-window", "window", "아침빛 창문", 90, 600, 180, 90),
    decoration("home-sofa", "sofa", "거실 소파", 360, 240, 150, 90),
    decoration("home-table", "table", "작은 탁자", 270, 330, 120, 90),
    decoration("home-rack", "shoe-rack", "현관 신발장", 90, 480, 120, 120),
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
  bounds: bounds(1200, 660),
  spawn: { x: 135, y: 375 },
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
    decoration("street-tree-1", "tree", "가로수", 214, 120, 90, 150, {
      asset: "tree-canopy.png",
      depthY: 270
    }),
    decoration("street-tree-2", "tree", "가로수", 513, 90, 90, 150, {
      asset: "tree-canopy.png",
      depthY: 240
    }),
    decoration("street-tree-3", "tree", "가로수", 860, 120, 90, 150, {
      asset: "tree-canopy.png",
      depthY: 270
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
  subtitle: "노선 안내를 따라 개찰구와 승강장을 지나가요",
  journeyIndex: 2,
  bounds: bounds(900, 840),
  spawn: { x: 135, y: 435 },
  paths: [
    path("station-concourse", "floor", 60, 300, 600, 270),
    path("station-gate-corridor", "corridor", 330, 240, 240, 390),
    path("station-platform", "platform", 600, 120, 210, 600)
  ],
  spots: [spot("directions", "지하철 오시는 길", 120, 150, 120, 90)],
  npcs: [],
  portals: [
    portal("station-to-neighborhood", "거리로 나가기", "neighborhood", { x: 30, y: 375, width: 90, height: 120 }, { x: 105, y: 435 }, "left", { x: 1065, y: 375 }),
    portal("station-to-train", "열차 타기", "subway-train", { x: 750, y: 360, width: 90, height: 150 }, { x: 735, y: 435 }, "right", { x: 135, y: 285 })
  ],
  blocked: [
    { x: 360, y: 360, width: 60, height: 120 },
    { x: 450, y: 360, width: 60, height: 120 },
    { x: 540, y: 360, width: 60, height: 120 }
  ],
  decorations: [
    decoration("station-sign", "station-sign", "노선 안내판", 180, 90, 300, 60),
    decoration("station-gate-1", "ticket-gate", "개찰구", 360, 360, 60, 120, {
      asset: "ticket-gate-front.png",
      depthY: 480
    }),
    decoration("station-gate-2", "ticket-gate", "개찰구", 450, 360, 60, 120, {
      asset: "ticket-gate-front.png",
      depthY: 480
    }),
    decoration("station-gate-3", "ticket-gate", "개찰구", 540, 360, 60, 120, {
      asset: "ticket-gate-front.png",
      depthY: 480
    }),
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
  bounds: bounds(1440, 540),
  spawn: { x: 135, y: 285 },
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
  bounds: bounds(960, 900),
  spawn: { x: 465, y: 765 },
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
  bounds: bounds(1080, 900),
  spawn: { x: 525, y: 765 },
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
  npcs: [],
  portals: [
    portal("lobby-to-venue", "예식장 밖으로", "venue-exterior", { x: 480, y: 810, width: 120, height: 60 }, { x: 525, y: 795 }, "down", { x: 465, y: 135 }),
    portal("lobby-to-bridal", "신부 대기실", "bridal-room", { x: 30, y: 345, width: 90, height: 120 }, { x: 105, y: 405 }, "left", { x: 345, y: 525 }),
    portal("lobby-to-restroom", "화장실", "restroom", { x: 960, y: 345, width: 90, height: 120 }, { x: 975, y: 405 }, "right", { x: 135, y: 345 }),
    portal("lobby-to-hall", "예식홀", "ceremony-hall", { x: 480, y: 30, width: 120, height: 90 }, { x: 525, y: 105 }, "up", { x: 375, y: 1785 })
  ],
  blocked: [{ x: 450, y: 300, width: 180, height: 120 }],
  decorations: [
    decoration("lobby-desk", "reception-desk", "안내 데스크", 450, 300, 180, 120, {
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
  bounds: bounds(720, 630),
  spawn: { x: 345, y: 525 },
  paths: [
    path("bridal-floor", "floor", 90, 120, 420, 360),
    path("bridal-entry-corridor", "corridor", 300, 450, 90, 120)
  ],
  spots: [spot("couple", "신부에게 인사하기", 245, 95, 110, 80)],
  npcs: [{ id: "bride", label: "신부 김하린", x: 300, y: 225 }],
  portals: [
    portal("bridal-to-lobby", "로비로 돌아가기", "lobby", { x: 240, y: 450, width: 120, height: 60 }, { x: 285, y: 435 }, "down", { x: 135, y: 405 })
  ],
  decorations: [
    decoration("bridal-photo-wall", "photo-wall", "장미 꽃벽", 180, 45, 240, 72),
    decoration("bridal-sofa", "sofa", "아이보리 소파", 90, 250, 150, 78),
    decoration("bridal-vanity", "vanity", "신부 화장대", 400, 220, 110, 78),
    decoration("bridal-mirror", "mirror", "대형 거울", 430, 80, 90, 116),
    decoration("bridal-flower-1", "flower-bed", "대기실 꽃장식", 70, 90, 92, 48),
    decoration("bridal-flower-2", "flower-bed", "대기실 꽃장식", 440, 350, 92, 48),
    decoration("bridal-lamp", "lamp", "드레스 조명", 355, 190, 30, 62),
    decoration("bridal-door", "door", "로비 출입문", 240, 450, 120, 60)
  ]
});

const ceremonyHallZone = createZone({
  id: "ceremony-hall",
  label: "예식홀",
  subtitle: "긴 버진로드 끝에서 두 사람의 약속을 함께해요",
  journeyIndex: 7,
  bounds: bounds(780, 1920),
  spawn: { x: 375, y: 1785 },
  paths: [
    path("hall-aisle", "aisle", 240, 120, 180, 1560),
    path("hall-entry-corridor", "corridor", 300, 1620, 120, 240)
  ],
  spots: [spot("couple", "신랑신부", 255, 105, 150, 72)],
  npcs: [
    { id: "groom", label: "신랑 이서준", x: 270, y: 270 },
    { id: "bride", label: "신부 김하린", x: 390, y: 270 }
  ],
  portals: [
    portal("hall-to-lobby", "로비로 돌아가기", "lobby", { x: 255, y: 1680, width: 150, height: 90 }, { x: 315, y: 1635 }, "down", { x: 525, y: 135 }),
    portal("hall-to-banquet", "연회장으로", "banquet", { x: 255, y: 30, width: 150, height: 72 }, { x: 315, y: 195 }, "up", { x: 525, y: 705 })
  ],
  decorations: [
    decoration("hall-altar", "altar", "웨딩 단상", 195, 105, 270, 105),
    decoration("hall-seat-l1", "ceremony-seat", "하객 좌석", 45, 360, 150, 120),
    decoration("hall-seat-r1", "ceremony-seat", "하객 좌석", 465, 360, 150, 120),
    decoration("hall-seat-l2", "ceremony-seat", "하객 좌석", 45, 690, 150, 120),
    decoration("hall-seat-r2", "ceremony-seat", "하객 좌석", 465, 690, 150, 120),
    decoration("hall-seat-l3", "ceremony-seat", "하객 좌석", 45, 1020, 150, 120),
    decoration("hall-seat-r3", "ceremony-seat", "하객 좌석", 465, 1020, 150, 120),
    decoration("hall-seat-l4", "ceremony-seat", "하객 좌석", 45, 1350, 150, 120),
    decoration("hall-seat-r4", "ceremony-seat", "하객 좌석", 465, 1350, 150, 120),
    decoration("hall-flowers-1", "aisle-bouquet", "버진로드 꽃장식", 205, 520, 35, 52),
    decoration("hall-flowers-2", "aisle-bouquet", "버진로드 꽃장식", 420, 960, 35, 52),
    decoration("hall-lights", "string-lights", "예식홀 조명", 105, 260, 450, 32)
  ]
});

const restroomZone = createZone({
  id: "restroom",
  label: "화장실",
  subtitle: "밝은 테라조 공간에서 잠시 단정히 준비해요",
  journeyIndex: 8,
  bounds: bounds(540, 600),
  spawn: { x: 105, y: 315 },
  paths: [path("restroom-floor", "floor", 60, 150, 420, 360)],
  spots: [],
  npcs: [],
  portals: [
    portal("restroom-to-lobby", "로비로 돌아가기", "lobby", { x: 30, y: 255, width: 72, height: 120 }, { x: 105, y: 315 }, "left", { x: 945, y: 405 })
  ],
  blocked: [{ x: 300, y: 70, width: 180, height: 160 }],
  decorations: [
    decoration("restroom-mirror-1", "mirror", "큰 거울", 110, 60, 120, 92),
    decoration("restroom-mirror-2", "mirror", "큰 거울", 250, 60, 120, 92),
    decoration("restroom-sink-1", "restroom-sink", "세면대", 120, 160, 92, 58),
    decoration("restroom-sink-2", "restroom-sink", "세면대", 260, 160, 92, 58),
    decoration("restroom-stall-1", "stall", "화장실 칸", 330, 300, 78, 150),
    decoration("restroom-stall-2", "stall", "화장실 칸", 420, 300, 78, 150),
    decoration("restroom-plant", "topiary", "민트 화분", 140, 430, 50, 72),
    decoration("restroom-door", "door", "로비 출입문", 30, 255, 72, 120)
  ]
});

const banquetZone = createZone({
  id: "banquet",
  label: "연회장",
  subtitle: "맛있는 식사와 축하 메시지로 여정을 마무리해요",
  journeyIndex: 9,
  bounds: bounds(1080, 840),
  spawn: { x: 525, y: 735 },
  paths: [path("banquet-floor", "banquet", 60, 90, 960, 660)],
  spots: [spot("guestbook", "축하 메시지", 835, 105, 120, 84)],
  npcs: [],
  portals: [
    portal("banquet-to-hall", "예식홀로 돌아가기", "ceremony-hall", { x: 465, y: 750, width: 150, height: 60 }, { x: 525, y: 735 }, "down", { x: 315, y: 375 })
  ],
  decorations: [
    decoration("banquet-table-1", "banquet-table", "원형 하객 테이블", 150, 180, 150, 150),
    decoration("banquet-table-2", "banquet-table", "원형 하객 테이블", 435, 180, 150, 150),
    decoration("banquet-table-3", "banquet-table", "원형 하객 테이블", 720, 180, 150, 150),
    decoration("banquet-table-4", "banquet-table", "원형 하객 테이블", 150, 450, 150, 150),
    decoration("banquet-table-5", "banquet-table", "원형 하객 테이블", 435, 450, 150, 150),
    decoration("banquet-table-6", "banquet-table", "원형 하객 테이블", 720, 450, 150, 150),
    decoration("banquet-buffet", "buffet", "웨딩 뷔페", 900, 260, 120, 300),
    decoration("banquet-banner", "party-flag", "축하 가랜드", 300, 65, 480, 36),
    decoration("banquet-dessert", "dessert-cart", "디저트 카트", 60, 640, 105, 68),
    decoration("banquet-door", "door", "예식홀 출입문", 465, 750, 150, 60)
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
    restroomZone,
    banquetZone
  ]
};

export function getWorldZone(world: GardenWorld, zoneId: WorldZoneId): WorldZone {
  return world.zones.find((zone) => zone.id === zoneId) ?? world.zones[0];
}

export function getZoneForSpot(world: GardenWorld, spotId: SpotId): WorldZone {
  return world.zones.find((zone) => zone.spots.some((item) => item.id === spotId)) ?? getWorldZone(world, world.defaultZoneId);
}
