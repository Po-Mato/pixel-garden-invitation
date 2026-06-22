# Character Art Density Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework guest faces/proportions and upgrade bride/groom NPCs to high-density authored sprites without changing customization or realtime contracts.

**Architecture:** Keep guests on the existing layered `48x72` renderer. Add couple-only frame metadata for `96x144` NPC source/generated sheets, then update generator validation, audit, contact-sheet extraction, and `WeddingNpc` rendering to use the high-density NPC frames. Replace the authored source PNGs and regenerate ignored public assets.

**Tech Stack:** Node.js 20, pnpm, Sharp, React/Vite, Vitest, node:test.

---

### Task 1: Lock the High-Density NPC Contract

**Files:**
- Modify: `scripts/characterAssetGenerator.test.mjs`
- Modify: `client/src/components/WeddingNpc.test.tsx`

- [ ] Write failing tests expecting NPC source/generated dimensions of `192x144` idle and `288x576` walk.
- [ ] Add a renderer test that `WeddingNpc` exposes `--npc-frame-width: 96px`, `--npc-frame-height: 144px`, and size class hooks for high-density NPCs.
- [ ] Run `pnpm characters:test` and `pnpm --filter @wedding-game/client test -- WeddingNpc.test.tsx`; both must fail for the new expectations.

### Task 2: Update NPC Tooling for 96x144 Frames

**Files:**
- Modify: `scripts/generate-character-assets.mjs`
- Modify: `scripts/audit-character-assets.mjs`
- Modify: `scripts/render-character-contact-sheet.mjs`
- Modify: `scripts/characterAssetGenerator.test.mjs`

- [ ] Introduce explicit NPC frame constants: frame `96x144`, idle sheet `192x144`, walk sheet `288x576`.
- [ ] Keep all non-NPC frame extraction at `48x72`.
- [ ] Update couple audit to inspect NPC sheets with `96x144` frames and foot-bottom range scaled to `132-140`.
- [ ] Update contact-sheet couple/catalog NPC extraction to use `96x144` frames and preserve actual display-size previews.
- [ ] Run focused tests until the tooling contract passes.

### Task 3: Author High-Density Bride/Groom PNGs

**Files:**
- Modify: `character-assets/source/npc/groom-idle.png`
- Modify: `character-assets/source/npc/groom-walk.png`
- Modify: `character-assets/source/npc/bride-idle.png`
- Modify: `character-assets/source/npc/bride-walk.png`

- [ ] Re-author groom with `96x144` frames: refined face, layered dark hair, black tuxedo, satin lapels, white shirt, boutonniere, and clean shoe baseline.
- [ ] Re-author bride with `96x144` frames: refined face, long dark-brown waves, ivory lace gown, floral/pearl accents, bouquet, and clean shoe/dress baseline.
- [ ] Keep directional rows down/left/right/up and three walk columns.
- [ ] Run `pnpm characters:audit -- --scope=couple`.
- [ ] Render `.superpowers/character-review/couple-density-refresh.png` and visually inspect high-density rows.

### Task 4: Remove Alien-Like Guest Read

**Files:**
- Modify: `character-assets/source/base/masculine-idle.png`
- Modify: `character-assets/source/base/masculine-walk.png`
- Modify: `character-assets/source/base/feminine-idle.png`
- Modify: `character-assets/source/base/feminine-walk.png`
- Modify if needed: selected `character-assets/source/hair/*.png`
- Modify if needed: selected `character-assets/source/outfits/*.png`

- [ ] Soften base faces: smaller dark eye mass, clearer nose/mouth, warmer cheek pixels, less mask-like contrast.
- [ ] Slightly strengthen shoulders/upper torso while preserving baseline and outfit compatibility.
- [ ] Trim or reshape any default hair silhouettes that enlarge the head unnaturally at actual garden scale.
- [ ] Run `pnpm characters:audit -- --scope=base`, then focused hair/outfit audits if those files changed.
- [ ] Render `.superpowers/character-review/guest-humanization.png` and inspect at 1x and enlarged scale.

### Task 5: Renderer Integration and Full Verification

**Files:**
- Modify: `client/src/components/WeddingNpc.tsx`
- Modify: `client/src/styles.css`
- Modify as needed: `client/src/components/GameWorld.test.tsx`

- [ ] Update `WeddingNpc` to render high-density NPC sheets with frame-size CSS variables.
- [ ] Keep NPC clickable labels and garden placement readable at 390px.
- [ ] Run `pnpm characters:generate`.
- [ ] Run `pnpm characters:test`, `pnpm test`, `pnpm typecheck`, `pnpm build`, and `git diff --check`.
- [ ] Browser-verify local 390px customizer, garden NPCs, and realtime two-session appearance.

### Task 6: Publish and Production Verify

**Files:**
- No source changes expected after verification.

- [ ] Commit verified source/test/doc changes.
- [ ] Push `main`.
- [ ] Watch GitHub Pages workflow to success.
- [ ] Browser-verify production customizer, garden NPCs, and realtime appearance.
- [ ] Save final screenshots under `.superpowers/character-review/`.
