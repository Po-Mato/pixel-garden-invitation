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
