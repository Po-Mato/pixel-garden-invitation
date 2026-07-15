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
  bounds: bounds(480, 600),
  spawn: { x: 135, y: 405 },
  paths: [path("home-floor", "floor", 90, 150, 300, 390)],
  spots: [spot("directions", "오시는 길", 82, 82, 104, 78)],
  npcs: [],
  portals: [
    portal("home-to-neighborhood", "동네로 나가기", "neighborhood", { x: 195, y: 30, width: 90, height: 72 }, { x: 225, y: 135 }, "up", { x: 135, y: 285 })
  ],
  decorations: [
    decoration("home-window", "window", "아침빛 창문", 270, 65, 120, 82),
    decoration("home-sofa", "sofa", "거실 소파", 285, 210, 126, 72),
    decoration("home-table", "table", "작은 탁자", 185, 300, 74, 58),
    decoration("home-rack", "shoe-rack", "현관 신발장", 45, 430, 92, 72),
    decoration("home-door", "door", "현관문", 195, 30, 90, 72),
    decoration("home-plant", "topiary", "현관 화분", 320, 430, 48, 72),
    decoration("home-mail", "mailbox", "청첩장 보관함", 55, 205, 62, 68),
    decoration("home-lamp", "lamp", "거실 조명", 388, 315, 28, 54)
  ]
});

const neighborhoodZone = createZone({
  id: "neighborhood",
  label: "동네 거리",
  subtitle: "새벽빛 골목과 횡단보도를 지나 지하철역으로",
  journeyIndex: 1,
  bounds: bounds(960, 540),
  spawn: { x: 75, y: 285 },
  paths: [
    path("neighborhood-street", "street", 30, 210, 900, 180),
    path("neighborhood-crosswalk", "crosswalk", 450, 210, 150, 180)
  ],
  spots: [],
  npcs: [],
  portals: [
    portal("neighborhood-to-home", "집으로 돌아가기", "home", { x: 30, y: 220, width: 60, height: 120 }, { x: 75, y: 285 }, "left", { x: 225, y: 165 }),
    portal("neighborhood-to-station", "지하철역 들어가기", "subway-station", { x: 870, y: 195, width: 60, height: 150 }, { x: 855, y: 285 }, "right", { x: 135, y: 345 })
  ],
  decorations: [
    decoration("street-tree-1", "tree", "가로수", 135, 72, 58, 82),
    decoration("street-tree-2", "tree", "가로수", 345, 62, 58, 82),
    decoration("street-tree-3", "tree", "가로수", 660, 70, 58, 82),
    decoration("street-lamp-1", "lamp", "가로등", 250, 112, 28, 64),
    decoration("street-lamp-2", "lamp", "가로등", 730, 110, 28, 64),
    decoration("street-bench", "bench", "골목 벤치", 610, 410, 96, 42),
    decoration("street-sign", "crosswalk-sign", "횡단보도 표지", 462, 150, 40, 56),
    decoration("street-flower", "flower-bed", "골목 화단", 250, 415, 120, 46),
    decoration("street-station", "station-sign", "지하철역 간판", 820, 120, 118, 64)
  ]
});

const subwayStationZone = createZone({
  id: "subway-station",
  label: "지하철 역사",
  subtitle: "노선 안내를 따라 개찰구와 승강장을 지나가요",
  journeyIndex: 2,
  bounds: bounds(720, 720),
  spawn: { x: 105, y: 345 },
  paths: [
    path("station-concourse", "floor", 60, 240, 600, 240),
    path("station-platform", "platform", 420, 60, 180, 600)
  ],
  spots: [spot("directions", "지하철 오시는 길", 95, 80, 110, 78)],
  npcs: [],
  portals: [
    portal("station-to-neighborhood", "거리로 나가기", "neighborhood", { x: 30, y: 285, width: 72, height: 120 }, { x: 105, y: 345 }, "left", { x: 825, y: 285 }),
    portal("station-to-train", "열차 타기", "subway-train", { x: 585, y: 285, width: 84, height: 120 }, { x: 555, y: 345 }, "right", { x: 135, y: 255 })
  ],
  blocked: [{ x: 280, y: 265, width: 100, height: 70 }],
  decorations: [
    decoration("station-sign", "station-sign", "노선 안내판", 250, 72, 220, 58),
    decoration("station-gate-1", "ticket-gate", "개찰구", 270, 255, 54, 82),
    decoration("station-gate-2", "ticket-gate", "개찰구", 330, 255, 54, 82),
    decoration("station-gate-3", "ticket-gate", "개찰구", 390, 255, 54, 82),
    decoration("station-bench", "bench", "승강장 의자", 470, 500, 112, 46),
    decoration("station-lamp-1", "lamp", "역사 조명", 220, 430, 26, 54),
    decoration("station-lamp-2", "lamp", "역사 조명", 470, 430, 26, 54),
    decoration("station-door", "door", "열차 출입문", 590, 286, 72, 116)
  ]
});

const subwayTrainZone = createZone({
  id: "subway-train",
  label: "지하철 차량",
  subtitle: "도시의 빛이 흐르는 긴 객차를 지나 하차해요",
  journeyIndex: 3,
  bounds: bounds(1080, 480),
  spawn: { x: 105, y: 255 },
  paths: [path("train-carriage", "carriage", 60, 150, 960, 210)],
  spots: [],
  npcs: [],
  portals: [
    portal("train-to-station", "역사로 내리기", "subway-station", { x: 30, y: 180, width: 72, height: 150 }, { x: 105, y: 255 }, "left", { x: 525, y: 345 }),
    portal("train-to-venue", "예식장역 내리기", "venue-exterior", { x: 978, y: 180, width: 72, height: 150 }, { x: 975, y: 255 }, "right", { x: 135, y: 375 })
  ],
  decorations: [
    decoration("train-window-1", "train-window", "도시 창문", 165, 75, 150, 74),
    decoration("train-window-2", "train-window", "도시 창문", 465, 75, 150, 74),
    decoration("train-window-3", "train-window", "도시 창문", 765, 75, 150, 74),
    decoration("train-seat-1", "train-seat", "청록 좌석", 150, 330, 168, 58),
    decoration("train-seat-2", "train-seat", "청록 좌석", 456, 330, 168, 58),
    decoration("train-seat-3", "train-seat", "청록 좌석", 762, 330, 168, 58),
    decoration("train-lights", "string-lights", "객차 손잡이 조명", 180, 155, 720, 24),
    decoration("train-door-1", "door", "객차 문", 30, 180, 72, 150),
    decoration("train-door-2", "door", "객차 문", 978, 180, 72, 150)
  ]
});

const venueExteriorZone = createZone({
  id: "venue-exterior",
  label: "예식장 앞",
  subtitle: "꽃 간판과 유리문 너머로 축하의 공간이 보여요",
  journeyIndex: 4,
  bounds: bounds(840, 720),
  spawn: { x: 105, y: 375 },
  paths: [path("venue-garden", "garden", 60, 300, 720, 180)],
  spots: [],
  npcs: [],
  portals: [
    portal("venue-to-train", "지하철역으로 돌아가기", "subway-train", { x: 30, y: 315, width: 72, height: 120 }, { x: 105, y: 375 }, "left", { x: 945, y: 255 }),
    portal("venue-to-lobby", "예식장 로비 들어가기", "lobby", { x: 690, y: 285, width: 96, height: 150 }, { x: 675, y: 375 }, "right", { x: 135, y: 405 })
  ],
  decorations: [
    decoration("venue-building", "venue-sign", "예식장 간판", 260, 72, 330, 90),
    decoration("venue-door", "door", "예식장 유리문", 690, 285, 96, 150),
    decoration("venue-arch", "flower-arch", "코랄 꽃 아치", 600, 235, 120, 138),
    decoration("venue-tree-1", "tree", "예식장 나무", 120, 120, 72, 94),
    decoration("venue-tree-2", "tree", "예식장 나무", 610, 500, 72, 94),
    decoration("venue-flower-1", "flower-bed", "입구 화단", 180, 500, 150, 48),
    decoration("venue-flower-2", "flower-bed", "입구 화단", 420, 530, 150, 48),
    decoration("venue-lamp", "lamp", "드롭오프 조명", 360, 215, 30, 62),
    decoration("venue-bench", "bench", "대기 벤치", 90, 570, 110, 46)
  ]
});

const lobbyZone = createZone({
  id: "lobby",
  label: "예식장 로비",
  subtitle: "축의대와 포토월을 지나 원하는 공간으로 이동해요",
  journeyIndex: 5,
  bounds: bounds(960, 780),
  spawn: { x: 105, y: 405 },
  paths: [
    path("lobby-main", "lobby", 60, 300, 840, 210),
    path("lobby-cross", "corridor", 420, 90, 150, 600)
  ],
  spots: [
    spot("wedding-info", "예식 안내", 180, 90, 108, 78),
    spot("rsvp", "축의대", 315, 585, 108, 78),
    spot("gallery", "웨딩 갤러리", 590, 90, 108, 78),
    spot("story", "우리 이야기", 720, 585, 108, 78)
  ],
  npcs: [],
  portals: [
    portal("lobby-to-venue", "예식장 밖으로", "venue-exterior", { x: 30, y: 345, width: 72, height: 120 }, { x: 105, y: 405 }, "left", { x: 645, y: 375 }),
    portal("lobby-to-bridal", "신부 대기실", "bridal-room", { x: 432, y: 30, width: 96, height: 90 }, { x: 465, y: 135 }, "up", { x: 285, y: 405 }),
    portal("lobby-to-restroom", "화장실", "restroom", { x: 858, y: 345, width: 72, height: 120 }, { x: 855, y: 405 }, "right", { x: 135, y: 315 }),
    portal("lobby-to-hall", "예식홀", "ceremony-hall", { x: 432, y: 660, width: 96, height: 90 }, { x: 465, y: 645 }, "down", { x: 315, y: 1605 })
  ],
  decorations: [
    decoration("lobby-desk", "reception-desk", "안내 데스크", 410, 205, 150, 72),
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
  bounds: bounds(600, 540),
  spawn: { x: 285, y: 435 },
  paths: [path("bridal-floor", "floor", 90, 120, 420, 360)],
  spots: [spot("couple", "신부에게 인사하기", 245, 95, 110, 80)],
  npcs: [{ id: "bride", label: "신부 김하린", x: 300, y: 225 }],
  portals: [
    portal("bridal-to-lobby", "로비로 돌아가기", "lobby", { x: 240, y: 450, width: 120, height: 60 }, { x: 285, y: 435 }, "down", { x: 465, y: 165 })
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
  bounds: bounds(660, 1800),
  spawn: { x: 315, y: 1635 },
  paths: [path("hall-aisle", "aisle", 240, 120, 180, 1560)],
  spots: [spot("couple", "신랑신부", 255, 105, 150, 72)],
  npcs: [
    { id: "groom", label: "신랑 이서준", x: 270, y: 270 },
    { id: "bride", label: "신부 김하린", x: 390, y: 270 }
  ],
  portals: [
    portal("hall-to-lobby", "로비로 돌아가기", "lobby", { x: 255, y: 1680, width: 150, height: 90 }, { x: 315, y: 1635 }, "down", { x: 465, y: 615 }),
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
    portal("restroom-to-lobby", "로비로 돌아가기", "lobby", { x: 30, y: 255, width: 72, height: 120 }, { x: 105, y: 315 }, "left", { x: 825, y: 405 })
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
