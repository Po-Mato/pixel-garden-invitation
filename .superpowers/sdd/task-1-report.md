# Task 1 Report: Map Image URLs and Background Renderer

## Implementation

- Added `worldVisuals` with the shared zone list, all ten fallback/effect definitions, and base-URL-safe map asset resolution.
- Added `WorldMapArtwork`, including a decorative non-draggable background image, fallback color, effect elements, and image-error hiding.
- Rendered the artwork as the first `world-map__stage` child and added absolute pixel-rendered background CSS.
- Added URL/configuration, renderer behavior, and full portal-journey integration tests. The journey helper now supports the ceremony hall's 48-tile route.

## RED Verification

Command:

`pnpm --filter @wedding-game/client test -- worldVisuals.test.ts WorldMapArtwork.test.tsx`

Result: failed as intended. Both new suites failed to resolve the missing `./worldVisuals` and `./WorldMapArtwork` modules. Existing selected suites reported 159 passing tests.

Command:

`pnpm --filter @wedding-game/client test -- GameWorld.test.tsx`

Result: failed as intended after adding the integration assertion. The stage's first child was `world-path world-path--floor`, not `world-map-artwork`.

## GREEN Verification

Command:

`pnpm --filter @wedding-game/client test -- worldVisuals.test.ts WorldMapArtwork.test.tsx GameWorld.test.tsx`

Result: 25 test files passed, 174 tests passed.

Command:

`pnpm --filter @wedding-game/client test`

Result: 25 test files passed, 174 tests passed.

Command:

`pnpm --filter @wedding-game/client typecheck`

Result: passed with exit code 0.

## Changed Files

- `client/src/game/worldVisuals.ts`
- `client/src/game/worldVisuals.test.ts`
- `client/src/components/WorldMapArtwork.tsx`
- `client/src/components/WorldMapArtwork.test.tsx`
- `client/src/components/GameWorld.tsx`
- `client/src/components/GameWorld.test.tsx`
- `client/src/styles.css`
- `.superpowers/sdd/task-1-report.md`

## Self Review and Concerns

- Checked the required API, exact ten visual definitions, base URL normalization, renderer attributes/error behavior, stage ordering, CSS sizing/pixel rendering, and per-zone journey updates.
- `client/public/assets/maps/v2` currently contains no generated map images. Until later tasks add them, failed image loads reveal the configured fallback colors.
- Vitest emits an existing Node warning that `--localstorage-file` has no valid path; it does not affect test outcomes.
- Existing untracked `character-assets` directories were not modified or staged.

## Fix Review

### Findings Fixed

- Replaced `object-fit: fill` with `object-fit: contain` for map backgrounds. The existing artwork container retains its fallback background color around any unused space.
- Added an image key based on `visual.backgroundUrl`, so a zone URL change creates a new image element instead of retaining a prior imperative `hidden` state.

### RED Verification

Command:

`pnpm --filter @wedding-game/client test -- WorldMapArtwork.test.tsx styles.test.ts`

Result: failed as intended with two failures. The CSS rule contained `object-fit: fill`, and the error-hidden `home` image was reused after rerendering to `banquet`.

### GREEN Verification

Command:

`pnpm --filter @wedding-game/client test -- WorldMapArtwork.test.tsx styles.test.ts`

Result: 25 test files passed, 176 tests passed.

Command:

`pnpm --filter @wedding-game/client test -- worldVisuals.test.ts WorldMapArtwork.test.tsx GameWorld.test.tsx`

Result: 25 test files passed, 176 tests passed.

Command:

`pnpm --filter @wedding-game/client test`

Result: 25 test files passed, 176 tests passed.

Command:

`pnpm --filter @wedding-game/client typecheck`

Result: passed with exit code 0.

### Changed Files

- `client/src/components/WorldMapArtwork.tsx`
- `client/src/components/WorldMapArtwork.test.tsx`
- `client/src/styles.css`
- `client/src/styles.test.ts`
- `.superpowers/sdd/task-1-report.md`
