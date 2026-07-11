# Realtime Resilience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep realtime wedding guests connected across transient network failures and allow Durable Object rooms to hibernate without losing active guest state.

**Architecture:** Store each joined guest snapshot and movement throttle timestamp in the WebSocket serialized attachment, then rebuild room snapshots from `DurableObjectState.getWebSockets()`. Add a client connection supervisor that reconnects with bounded exponential backoff and obtains the latest zone, coordinates, direction, and appearance before each attempt.

**Tech Stack:** TypeScript, React 18, Vitest, Cloudflare Durable Objects Hibernation WebSocket API, browser WebSocket API.

## Global Constraints

- Work only in `/Users/sjlee/Documents/New project 5`.
- Keep the current branch and worktree; do not create another worktree.
- Do not commit or push without an explicit user request.
- Keep offline movement and invitation interactions available during reconnects.
- Preserve the invitation-level Durable Object sharding model and four existing zone identifiers.
- Use test-first red-green cycles for every behavior change.

---

### Task 1: Hibernatable room connections

**Files:**
- Modify: `worker/src/GardenRoom.ts`
- Modify: `worker/src/GardenRoom.test.ts`

**Interfaces:**
- Produces: `webSocketMessage`, `webSocketClose`, and `webSocketError` Durable Object event handlers.
- Persists: `{ kind: "guest", guest: RoomGuest, lastMoveAt: number }` via `serializeAttachment`.

- [ ] Add failing tests proving a second `GardenRoom` instance can recover joined and moved guests from socket attachments.
- [ ] Run `pnpm exec vitest run src/GardenRoom.test.ts --reporter=verbose` in `worker` and confirm failures are caused by missing attachment recovery.
- [ ] Replace per-instance socket state with Hibernation API acceptance, attachment validation, and `getWebSockets()` snapshots.
- [ ] Re-run the focused Worker test and confirm it passes.

### Task 2: Reconnecting client connection supervisor

**Files:**
- Modify: `client/src/realtime/realtimeClient.ts`
- Modify: `client/src/realtime/realtimeClient.test.ts`

**Interfaces:**
- Produces: `connectRealtimeWithRetry(url, getJoin, handlers, options)` returning `{ send, close }`.
- Backoff: `500ms`, `1000ms`, `2000ms`, `4000ms`, capped at `8000ms`.

- [ ] Add failing fake-timer tests for retry scheduling, backoff reset after open, latest join state, and intentional close cancellation.
- [ ] Run the focused client realtime test and confirm expected failures.
- [ ] Implement the supervisor around the existing single-socket parser and adapter.
- [ ] Re-run the focused realtime test and confirm it passes.

### Task 3: Restore latest game position after reconnect

**Files:**
- Modify: `client/src/components/GameWorld.tsx`
- Modify: `client/src/components/GameWorld.test.tsx`

**Interfaces:**
- Consumes: `connectRealtimeWithRetry` and a live join-state getter.
- Produces: a stationary `move` snapshot with the current zone and position after every `welcome`.

- [ ] Add failing GameWorld tests for reconnect status transitions and latest lounge position restoration.
- [ ] Run the focused GameWorld test and confirm expected failures.
- [ ] Track active zone in a ref, use the reconnecting connection, and send the current snapshot after `welcome`.
- [ ] Re-run the focused GameWorld test and confirm it passes.

### Task 4: Worker configuration and integration verification

**Files:**
- Modify: `worker/wrangler.toml` only where current schema and project compatibility require it.
- Verify: all changed files.

- [ ] Validate Wrangler configuration against `node_modules/wrangler/config-schema.json`.
- [ ] Run Worker and client test suites, workspace typecheck, and production build.
- [ ] Start the local Worker and a Worker-connected client.
- [ ] Verify two direct WebSocket clients receive join and zone movement events.
- [ ] Terminate the Worker, verify the browser enters reconnecting state, restart it, and verify the latest zone is restored.
- [ ] Stop all local verification servers.

