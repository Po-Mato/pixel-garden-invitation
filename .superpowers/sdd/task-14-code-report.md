# Task 14 Code Report

## Scope

- `banquet` world contract only. No image, manifest, or character-assets files were changed.
- No new worktree was created and nothing was pushed.

## RED

- Added Task 14 assertions for banquet `1200x930`, spawn `(585,795)`, final floor/central paths, guestbook spot, six table blockers, buffet blocker, return portal `(540,840,120,60)` with approach `(585,825)`, hall return spawn `(375,165)`, six `table-front.png` depth overlays, and removal of `banquet-arrival`.
- Added A* coverage from banquet spawn to the guestbook-adjacent tile `(915,165)` and return portal approach.
- Extended GameWorld integration coverage for banquet map dimensions, table overlay depth, guestbook modal, return fade, and final hall position `(375,165)`.
- Added worker clamp coverage for banquet `1200x930`.

Expected RED failures were observed in client world/pathfinding/GameWorld tests and worker GardenRoom tests against the previous Task 12-compatible banquet data.

## GREEN

- Updated `client/src/game/world.ts` banquet data to the Task 14 geometry.
- Updated `worker/src/GardenRoom.ts` banquet bounds to `1200x930`.
- Preserved `hall-to-banquet` destination `(585,795)`.

## Verification

- `pnpm --filter @wedding-game/client test -- world.test.ts pathfinding.test.ts GameWorld.test.tsx GuestbookPanel.test.tsx` PASS
- `pnpm --filter @wedding-game/worker test -- GardenRoom.test.ts` PASS
- `pnpm --filter @wedding-game/client test` PASS
- `pnpm --filter @wedding-game/worker test` PASS
- `pnpm typecheck` PASS

`pnpm maps:build -- --zone banquet` was not run because `client/public/assets/maps/v2/banquet` and `map-assets/reference/v2/banquet` do not exist yet, and this task explicitly excludes image and manifest work.
