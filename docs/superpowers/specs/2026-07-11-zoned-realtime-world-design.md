# Zoned Realtime Wedding World Design

Date: 2026-07-11
Project root: `/Users/sjlee/Documents/New project 5`
Status: Approved continuation of the zoned-map implementation

## Goal

Complete the separated-map experience so each zone feels like a distinct pixel-game location and realtime guests appear only in the zone they currently occupy.

## Confirmed Direction

- Keep one Durable Object per invitation so the live guest list remains continuous while guests travel.
- Add `zoneId` to the shared realtime position contract instead of opening a different WebSocket room per zone.
- Use the same four zone identifiers everywhere: `entrance`, `ceremony`, `gallery`, and `lounge`.
- Validate and clamp coordinates against the selected zone on the server.
- Render only remote guests whose `zoneId` matches the local active zone.
- Model decorative pixel props as zone data so layout, tests, and rendering share one source of truth.
- Preserve offline solo play and the existing tap/joystick movement behavior.
- Do not add chat, quests, collectibles, or a minimap in this iteration.

## Architecture

### Shared protocol

`WorldZoneId` lives in `shared/src/protocol.ts`. `PositionState`, `RoomGuest`, `join`, and `move` carry the current zone. Client and Worker validation reject unknown zone values.

### Realtime room

The invitation continues to map to one `GardenRoom`. New guests enter the ceremony spawn. Every accepted movement updates both coordinates and zone atomically in the in-memory guest snapshot. The server clamps coordinates using bounds for the supplied zone before broadcasting `guest_moved`.

### Client state

Zone travel immediately updates local state and sends a stationary realtime move for the destination spawn. Normal movement messages include the active zone. Incoming room state remains a complete invitation-level roster, while rendering filters it to `activeZone.id`.

### Map presentation

Each zone defines lightweight decoration records with a semantic kind, label, position, and size. A dedicated presentational component renders them behind spots, portals, NPCs, and players. Decorations are non-interactive and excluded from collision unless they are explicitly represented in the zone's existing blocked rectangles.

## Error Handling

- Invalid or missing `zoneId` in client messages returns `bad_message`.
- Invalid `zoneId` in server payloads is rejected by the browser parser.
- A failed realtime connection leaves local zone travel and interactions working in offline mode.
- A direct zone change always resets target movement and sends a stationary destination snapshot when online.

## Testing

- Shared tests prove valid zones parse and unknown zones fail.
- Worker tests prove guests spawn in the ceremony and zone moves are clamped and broadcast.
- Client realtime tests prove server payloads preserve zone identity.
- GameWorld tests prove zone travel emits a zone-aware move and remote guests are visible only in matching zones.
- World-data tests prove each zone has distinctive decoration content.
- Typecheck, production build, and mobile browser checks cover integration and visual behavior.

