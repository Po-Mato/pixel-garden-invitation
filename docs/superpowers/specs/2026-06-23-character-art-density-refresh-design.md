# Character Art Density Refresh Design

## Goal

Remove the “alien-like” guest impression and make the bride/groom NPCs read as refined, high-density protagonist sprites instead of broken low-resolution detail clusters.

## Approved Direction

- Guest characters stay on the existing `48x72` frame system.
- Bride and groom NPCs move to a couple-only `96x144` frame system.
- The garden display size for bride/groom remains visually close to the current NPC footprint; the sprite pixel grid becomes denser rather than simply larger.
- Production code must still only copy, validate, compose, and display authored PNGs. It must not generate runtime character geometry.

## Guest Art Requirements

Guest source art must be adjusted where it causes alien-like readings:

- Reduce oversized dark eye/mask mass in base faces.
- Add warmer face shaping through softer cheek, nose, and mouth pixels.
- Reduce top-heavy hair silhouettes where they enlarge the head unnaturally.
- Give shoulders and upper torso enough visual weight that the face does not dominate the body.
- Keep all generated catalog IDs, customization options, realtime payloads, and `48x72` animation offsets unchanged.

## Bride/Groom NPC Requirements

Bride and groom NPC source files become:

- `groom-idle.png`: `192x144`, two `96x144` frames.
- `groom-walk.png`: `288x576`, twelve `96x144` frames.
- `bride-idle.png`: `192x144`, two `96x144` frames.
- `bride-walk.png`: `288x576`, twelve `96x144` frames.

Generated files keep the same URLs:

- `characters/generated/npc/groom__idle.png`
- `characters/generated/npc/groom__walk.png`
- `characters/generated/npc/bride__idle.png`
- `characters/generated/npc/bride__walk.png`

The `WeddingNpc` renderer must use `96x144` background frames and show them at approximately the previous world footprint. The output should preserve the approved couple hierarchy: black tuxedo, satin lapel read, boutonniere, ivory lace gown, bouquet, refined face, and layered hair.

## Tooling Requirements

- Generator source validation must accept the high-density NPC dimensions.
- Couple audit must inspect NPCs with `96x144` frame dimensions and updated foot-baseline bounds.
- Contact sheet couple mode must extract and display `96x144` NPC frames, including actual display-size comparison.
- Catalog mode must still render all 153 catalog samples and include the high-density NPC rows.
- Existing guest generated assets remain `48x72` frame-based.

## Verification Requirements

- Unit tests must fail before implementation for the new NPC dimensions.
- `pnpm characters:audit -- --scope=couple` passes.
- `pnpm characters:audit -- --scope=base` passes after guest face/base polish.
- `pnpm characters:test`, `pnpm test`, `pnpm typecheck`, and `pnpm build` pass.
- Browser verification at `390x844` confirms:
  - No horizontal overflow.
  - Guest avatars look human and readable at actual garden scale.
  - Bride/groom NPCs are crisp, high-density, and not visually broken.
  - NPC labels and click panels still work.
  - Realtime guest appearance still renders exact selected layers.
