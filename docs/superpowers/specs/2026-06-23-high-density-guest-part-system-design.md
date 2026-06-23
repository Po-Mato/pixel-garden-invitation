# High-Density Guest Part System Design

Date: 2026-06-23  
Project root: `/Users/sjlee/Documents/New project 5`  
Status: Approach A selected; implementation pending written-spec review

## Goal

Replace the current low-density guest character assets with a high-density, swappable part system that can produce attractive wedding guest characters at the same perceived quality level as the approved bride/groom direction.

This design addresses two separate failures:

1. The current guest art is still visually weak. It passes technical checks but does not meet the desired beauty/detail bar.
2. The customization system composes layers, but the asset model is not explicit enough as a managed body-plus-parts library.

The new system must make the body/base separate from all other replaceable parts:

- Base body: family, skin tone, face, hands, body anchor.
- Hair: replaceable back/front hair parts.
- Outfit: replaceable clothing parts.
- Accessories: replaceable face, jewelry, neckwear, carry, and back-accessory parts.

## Non-Negotiable Direction

- Guest characters move from `48x72` source frames to `96x144` high-density source frames.
- The rendered garden footprint remains visually controlled so guests do not dominate the map.
- The approved bride/groom art remains the master quality reference.
- Guest quality target is at least 85% of the couple art direction.
- Current quick-fix `48x72` guest PNG edits are not the quality baseline. They are replacement candidates.
- Runtime code may compose, validate, palette-expand, and display authored parts. It must not procedurally draw final character geometry.
- Body/base can be selected by family and skin tone, but all visible styling beyond the body must come from swappable part assets.

## Root Cause

The poor guest quality comes from trying to solve an art-density problem inside a `48x72` grid. At that size:

- Facial refinement collapses into dark mask-like pixels.
- Hair silhouettes become blocky or top-heavy.
- Suit/dress material detail cannot survive at actual garden scale.
- Accessories are too small to read reliably.
- Automated checks can prove dimensions and alpha differences but cannot create enough visual detail.

Bride/groom quality improved only after moving them to denser `96x144` NPC frames. Guests need the same density strategy, but with a part-composition architecture instead of single complete NPC sheets.

## Asset Model

### Frame Contract

Guest source parts become:

- Walk source sheet: `288x576`, three `96x144` columns by four direction rows.
- Idle source sheet where needed: `192x144`, two `96x144` front-facing frames.
- Direction order: down, left, right, up.
- Walk columns: step 0, neutral, step 2.
- Transparent PNG, hard pixel edges, no antialiasing.

Generated files keep deterministic URLs under:

```text
client/public/characters/generated/
```

The generated guest output may either:

- remain high-density `96x144` and be rendered with CSS display scaling, or
- be downsampled only if nearest-neighbor downsampling still passes visual QA.

The preferred implementation is to keep generated guest parts at `96x144` and let the renderer decide display size.

### Part Groups

The managed guest part library has these groups:

| Group | Purpose | Source path | Palette expansion |
| --- | --- | --- | --- |
| `base` | Body, skin, face, hands, feet, body anchor | `character-assets/source/base` | skin palettes |
| `hair-back` | Hair behind body/outfit | `character-assets/source/hair` | hair palettes |
| `hair-front` | Hair over face/body | `character-assets/source/hair` | hair palettes |
| `outfit` | Clothing and shoes where applicable | `character-assets/source/outfits` | outfit palettes |
| `accessory-face` | Glasses and face overlays | `character-assets/source/accessories` | fixed colors |
| `accessory-jewelry` | Earrings, necklaces | `character-assets/source/accessories` | fixed colors |
| `accessory-neckwear` | Tie, bow tie, brooch | `character-assets/source/accessories` | fixed colors |
| `accessory-carry` | Handbags and carried items | `character-assets/source/accessories` | fixed colors |
| `accessory-back` | Shoulder bag/back accessory | `character-assets/source/accessories` | fixed colors |

The catalog remains the user-facing source of selectable IDs, but a new part manifest makes the asset system explicit:

```text
character-assets/guest-part-manifest.json
```

The manifest records:

- frame dimensions;
- source file for each catalog ID;
- generated file pattern;
- layer slot;
- compatibility constraints;
- quality-lock metadata;
- display scale rules.

## Layer Composition

Back-to-front order remains:

1. `back-accessory`
2. `back-hair`
3. `base`
4. `outfit`
5. `front-hair`
6. `face`
7. `jewelry`
8. `neckwear`
9. `carry`

The renderer must not hardcode URL patterns directly from the catalog alone. It should resolve layers through the guest part manifest so part files can be managed, audited, and swapped independently.

## Customizer Behavior

The customizer remains familiar to the user, but internally it becomes part-library driven.

Visible categories:

- 기본: family and skin tone.
- 헤어: hair style.
- 헤어 색: hair palette.
- 의상: outfit.
- 의상 색: outfit palette.
- 액세서리: face, jewelry, neckwear, carry.

Each option tile must render an actual composed high-density preview, not a symbolic placeholder.

When the user changes family:

- body/base resets to the selected family default;
- incompatible hair and outfit IDs reset;
- accessories may remain only if compatible with their declared slot and layer.

When the user changes a non-body part:

- only that part changes;
- body/base remains stable;
- other part selections remain stable unless compatibility rules require reset.

## Art Requirements

Guest parts must be authored to match the approved couple direction:

- attractive, human, wedding-guest appropriate;
- refined eyes and face contour;
- layered hair with strand clusters and highlights;
- clear outfit materials: satin, wool, silk, lace, knit, leather, metal;
- readable silhouettes at actual mobile garden size;
- no alien/mask face;
- no square heads;
- no recolor-only differences between different hairstyles or outfit IDs;
- no bride-exclusive train/gown/bouquet composition;
- no groom-exclusive boutonniere/tuxedo treatment copied into guest outfits.

The base body should be intentionally plain enough to combine with all outfits, but not low-quality. It still owns the face and body proportions.

## Catalog Scope

The current catalog counts remain unchanged:

- two families;
- five skin tones;
- sixteen hairstyles;
- six hair colors;
- ten outfits;
- four outfit palettes per outfit;
- ten accessories.

No new customization categories are introduced in this pass. The work is a quality and architecture upgrade, not catalog expansion.

## Tooling Changes

### Generator

`scripts/generate-character-assets.mjs` must support guest `96x144` part dimensions while preserving existing bride/groom NPC handling.

Required constants:

- guest frame: `96x144`;
- guest idle sheet: `192x144`;
- guest walk sheet: `288x576`;
- couple NPC frame: remains `96x144`;
- old `48x72` output assumptions removed from guest generation and renderer tests.

### Audit

The asset audit must verify:

- all catalog IDs have manifest entries;
- every manifest entry has a source file;
- source dimensions match the high-density contract;
- generated dimensions match the high-density contract;
- each layer uses only allowed marker/fixed colors;
- base/body foot baseline is stable;
- each hairstyle has a distinct silhouette within family;
- each outfit has a distinct silhouette within family;
- front-hair leaves a readable face window;
- accessory non-empty frames align to the correct body anchor;
- generated guest output count matches catalog-derived expectations.

### Contact Sheets

Contact sheet tooling must include:

- all hair styles in a canonical dark-brown palette;
- all hair colors on representative styles;
- all outfits in their palettes;
- all accessories by slot;
- representative full composed guests;
- actual display-size samples and enlarged nearest-neighbor samples.

The review sheet must make it obvious whether parts are interchangeable and aligned.

## Renderer Changes

`CharacterSprite` must become dimension-aware:

- guest frame width/height are read from manifest metadata;
- CSS variables define source frame size and display size;
- walking frame offsets use the configured source frame size;
- idle frame offsets use the configured idle source size;
- layer failures hide only the failed layer, not the whole character.

World display target:

- guests should remain visually close to the current world footprint;
- exact CSS display size is decided during implementation after mobile QA;
- source pixels stay high-density even if displayed smaller.

Customizer preview target:

- larger than world display;
- nearest-neighbor scaling only;
- no blur.

## Data Flow

1. `shared/character-catalog.json` defines selectable IDs and compatibility.
2. `character-assets/guest-part-manifest.json` maps IDs to source/generated assets and layer slots.
3. The generator reads catalog, palettes, and manifest.
4. The generator creates deterministic generated PNGs.
5. The client resolves selected `CharacterAppearance` through the manifest.
6. `CharacterSprite` renders the resulting high-density layers.
7. Realtime payloads remain unchanged because `CharacterAppearance` IDs do not change.

## Testing Strategy

Use test-first implementation.

Required RED tests before implementation:

- generator rejects old `144x288` guest source sheets for guest parts;
- generator accepts `288x576` guest walk sheets and `192x144` guest idle sheets;
- manifest must contain every body, hair, outfit, and accessory ID;
- `resolveCharacterLayers` resolves via manifest metadata rather than hardcoded paths;
- `getWalkFrameStyle` supports configurable `96x144` frame sizes;
- `CharacterSprite` renders CSS variables for guest frame and display dimensions;
- contact sheet samples decode `96x144` guest frames;
- audit fails when two different hairstyles or outfits share a silhouette.

Required final verification:

```bash
pnpm characters:audit
pnpm characters:test
pnpm test
pnpm typecheck
pnpm build
```

Browser verification:

- desktop customizer;
- `390px` mobile customizer;
- enter garden flow;
- movement in all directions;
- accessory slot changes;
- bride/groom NPCs still crisp;
- no horizontal overflow;
- no console error/warn;
- generated guest appearance remains stable across reload.

## Migration Plan

1. Add manifest and tests while the old guest assets still exist.
2. Update generator/audit/contact-sheet tooling to support high-density guest parts.
3. Update client frame math, layer resolution, and sprite CSS for configurable dimensions.
4. Replace guest base body source assets.
5. Replace all hair source assets.
6. Replace all outfit source assets.
7. Replace all accessory source assets.
8. Regenerate assets and contact sheets.
9. Run full automated and browser verification.
10. Remove or quarantine rejected low-density guest source assumptions.

## Out of Scope

- New catalog counts.
- New realtime protocol fields.
- New animation states beyond existing idle/walk.
- Changing map layout or collision rules.
- Replacing bride/groom approved reference.
- Runtime procedural drawing of final art.
- AI generation at runtime.

## Acceptance Criteria

This work is complete only when:

- guests no longer read as cheap, alien, or blocky at actual mobile display size;
- hair, outfit, and accessories are managed as explicit swappable part assets;
- body/base remains stable while non-body parts can be changed independently;
- all selectable catalog IDs resolve through the manifest;
- high-density generated parts render correctly in customizer and garden;
- contact sheets show clear before/after quality improvement;
- automated tests, typecheck, build, and browser QA pass.
