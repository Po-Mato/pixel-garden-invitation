# Zoned Realtime Wedding World Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Synchronize guest zones through the realtime room and make all four map zones feel like distinct pixel-game locations.

**Architecture:** Keep one invitation-level Durable Object and extend its position contract with a shared `WorldZoneId`. Store decorative map props in the zone model and render them as a non-interactive layer behind gameplay entities.

**Tech Stack:** TypeScript, React 18, Vite, Vitest, Testing Library, Cloudflare Worker and Durable Objects, CSS pixel art.

## Global Constraints

- Work only in `/Users/sjlee/Documents/New project 5`.
- Keep the existing branch and worktree; do not create another worktree.
- Do not commit or push without an explicit user request.
- Preserve offline solo play, tap movement, joystick movement, and current invitation content.
- Use test-first red-green cycles for behavior changes.

---

### Task 1: Shared zone-aware realtime contract

**Files:**
- Modify: `shared/src/protocol.ts`
- Modify: `shared/src/validation.ts`
- Test: `shared/src/validation.test.ts`

**Interfaces:**
- Produces: `WorldZoneId`, `worldZoneIds`, and zone-aware `PositionState`/`ClientMessage` types.

- [ ] Add failing parsing tests for valid and invalid zone-aware join and move messages.
- [ ] Run the focused shared test and confirm the expected failure.
- [ ] Add the shared zone type and validation.
- [ ] Re-run the focused shared test and confirm it passes.

### Task 2: Zone-aware Durable Object state

**Files:**
- Modify: `worker/src/GardenRoom.ts`
- Test: `worker/src/GardenRoom.test.ts`

**Interfaces:**
- Consumes: shared `WorldZoneId` and zone-aware messages.
- Produces: clamped `guest_moved` broadcasts containing `zoneId`.

- [ ] Add failing tests for ceremony spawn, zone transitions, and per-zone coordinate clamping.
- [ ] Run the focused Worker test and confirm the expected failure.
- [ ] Add per-zone bounds and include `zoneId` in guest snapshots and broadcasts.
- [ ] Re-run the focused Worker test and confirm it passes.

### Task 3: Client synchronization and zone filtering

**Files:**
- Modify: `client/src/realtime/realtimeClient.ts`
- Modify: `client/src/components/GameWorld.tsx`
- Test: `client/src/realtime/realtimeClient.test.ts`
- Test: `client/src/components/GameWorld.test.tsx`

**Interfaces:**
- Consumes: zone-aware shared messages.
- Produces: immediate zone transition messages and same-zone remote rendering.

- [ ] Add failing parser and GameWorld tests for zone payloads, transition sends, and guest filtering.
- [ ] Run focused client tests and confirm the expected failures.
- [ ] Carry `zoneId` through parsing, movement, transition sends, and rendering filters.
- [ ] Re-run focused client tests and confirm they pass.

### Task 4: Distinct pixel-map decoration layers

**Files:**
- Modify: `client/src/game/world.ts`
- Modify: `client/src/game/geometry.test.ts`
- Create: `client/src/components/WorldDecoration.tsx`
- Modify: `client/src/components/GameWorld.tsx`
- Modify: `client/src/styles.css`

**Interfaces:**
- Produces: `WorldDecoration` data and a non-interactive rendered decoration layer.

- [ ] Add failing world-data tests requiring distinctive decoration sets in every zone.
- [ ] Run the focused world test and confirm the expected failure.
- [ ] Add decoration data, component rendering, and zone-specific pixel styling.
- [ ] Re-run the focused world test and confirm it passes.

### Task 5: Integration verification

**Files:**
- Verify all modified files.

- [ ] Run shared, Worker, and client focused tests.
- [ ] Run workspace typecheck.
- [ ] Run the production build.
- [ ] Start local client and Worker servers where feasible.
- [ ] Verify entry, all zone tabs, portals, modal actions, and same-zone guest visibility at a mobile viewport.
- [ ] Capture fresh screenshots for ceremony, entrance, gallery, and lounge.

