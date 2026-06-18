# Character Art Rework Design

Date: 2026-06-19  
Project root: `/Users/sjlee/Documents/New project 5`  
Status: Approved design

## Goal

Replace every current procedurally drawn character asset with refined, hand-authored pixel art that faithfully carries the previously approved bride and groom design into the game.

The existing character customization, realtime protocol, catalog IDs, rendering order, movement rules, and `48x72` world footprint remain intact. This project changes the character art and the source-asset production pipeline, not the product behavior.

## Approved Reference

The official art reference is the bride and groom concept recovered from Codex session:

```text
019eabf9-3872-7d40-9d46-157edc38abc5
```

Recovered local file:

```text
/Users/sjlee/Documents/New project 5/.superpowers/brainstorm/69276-1781819877/content/recovered-originals/selected-bride-groom-reference.png
```

Reference properties:

- PNG dimensions: `1536x1024`.
- SHA-256: `2b15858e5e16a7210181b79cbf94aa1041df3bc5cb255a76f41a36c1d553458a`.
- Groom: black fitted tuxedo, satin lapels, crisp white shirt, black bow tie, white boutonniere, polished black shoes, layered dark hair.
- Bride: waist-length dark-brown waves, ivory lace gown, floral hair ornament, pearl details, bouquet, layered fabric folds and train.
- The upper-row designs define facial rendering, hair, materials, and formalwear detail.
- The lower-row compact designs define the proportions and readability target for gameplay.

The implementation must preserve a committed copy of this reference inside the repository before replacing production art. The checksum above is the acceptance check for that copy.

## Approved Art Direction

### Proportions

Use the approved A2 balanced proportion:

- Frame size remains `48x72`.
- The head occupies approximately 25% of total character height.
- Neck, torso, arms, and legs are visibly longer than the current block-shaped assets.
- The body remains compact enough for the existing garden map but must not read as super-deformed.
- Feet share a stable anchor and center axis across every direction and animation frame.

The following shapes are explicitly prohibited:

- Large square or rectangular heads.
- Single-block torsos.
- Stick-like arms or legs.
- Identical silhouettes distinguished only by color.
- Flat one-tone hair or clothing.

### Face

Use the approved F1 clear and refined facial style:

- Long, clearly readable eyes with controlled highlights.
- Small mouth and restrained blush.
- Refined eyebrows and face contour.
- Attractive and expressive without exaggerated doll-like proportions.

F1 does not introduce a new face unrelated to the recovered concept. It is the compact game-scale interpretation of the recovered bride and groom faces.

### Rendering Language

All characters share:

- Crisp hard pixel edges with no blur or antialiasing.
- Purposeful clusters rather than noisy isolated pixels.
- Three to four readable shade groups for major hair and clothing surfaces.
- Material-specific highlights for satin, wool, lace, silk, metal, and leather.
- Clear front, side, and rear silhouettes.
- Controlled palettes that retain contrast at actual world size.

## Bride And Groom

The bride and groom are complete, exclusive NPC sprite sets rather than combinations assembled from guest layers.

### Groom

Required details:

- Refined dark side-parted hair with layered highlights.
- Black fitted tuxedo with a visible jacket waist and trouser break.
- Satin lapel highlights distinct from the jacket body.
- White dress shirt, black bow tie, and vest or button detail.
- White boutonniere with small green leaves.
- Subtle gold cufflink pixels.
- Polished black shoes.

### Bride

Required details:

- Waist-length dark-brown waves with separated locks and layered highlights.
- Floral or pearl hair ornament based on the recovered reference.
- Ivory lace sleeves and detailed bodice.
- Multi-layer skirt with visible folds, lace edge, and a readable train.
- Pearl earrings or necklace details.
- Pastel bouquet with stems or ribbon.

### Priority

Bride and groom assets establish the master quality bar. Guest production must not begin until their master sprites pass visual review at:

- Enlarged nearest-neighbor scale.
- Actual `48x72` game scale.
- Front, side, rear, idle, and walking views.

## Guest Characters

Guests use the same facial language, proportions, hair rendering, and material treatment as the couple. Their target visual detail is approximately 85% of the couple.

Guests remain layered in this back-to-front order:

1. Back accessory.
2. Back hair.
3. Base body.
4. Outfit.
5. Front hair.
6. Face accessory.
7. Jewelry or neckwear.
8. Front carry accessory.

The approved catalog scope remains:

- Two visual families: masculine and feminine.
- Five skin tones.
- Eight hairstyles per family, sixteen total.
- Six natural hair colors.
- Five outfits per family, ten total.
- Four curated palettes per outfit.
- Ten accessories.

Each hairstyle and outfit requires a distinct authored silhouette. Palette variations may share geometry, but different catalog styles may not be produced by recoloring the same shape.

The bride's ivory gown, long bridal train, bouquet composition, and bridal ornament remain exclusive. The groom's pure-black tuxedo treatment, satin lapel pattern, and boutonniere composition remain exclusive.

## Asset Authoring Architecture

### Hand-Authored Masters

Every source sheet is manually authored against fixed frame guides. Code may validate, copy, and recolor approved marker regions, but code must not draw body shapes, faces, hair, clothing, or NPCs.

Master sheets continue to use:

- Frame size: `48x72`.
- Walk sheet: three columns by four directional rows, `144x288`.
- Direction order: down, left, right, up.
- Front idle support as required by the current renderer.
- Transparent PNG.

Frame guides define:

- Foot baseline.
- Horizontal center.
- Head top allowance.
- Shoulder, waist, hand, knee, and foot bands.
- Maximum train, hair, and accessory bounds.

### Palette Generation

`scripts/generate-character-assets.mjs` remains responsible for deterministic palette expansion and output validation.

It may:

- Replace exact marker colors with catalog palettes.
- Copy fixed-color accessories.
- Validate dimensions, transparency, marker colors, and output paths.

It may not:

- Construct geometry.
- Add facial features.
- Generate hairstyles or outfits from primitive rectangles or polygons.
- Invent visual details not present in a source master.

### Procedural Generator Removal

`scripts/author-character-source-assets.mjs` currently creates the degraded block-shaped art. It must be removed from the production workflow and deleted after the replacement source sheets are present.

No package script, test fixture, documentation command, or CI task may invoke it after this rework.

## Animation

The current four-direction, three-frame walk contract remains.

Animation quality requirements:

- Feet remain anchored without vertical jitter.
- The torso moves no more than required for a readable walk.
- Arms counter-swing naturally and do not detach from sleeves.
- Hair tips, jacket hems, dress folds, bags, and bouquet may move by one or two pixels where appropriate.
- Side views preserve the face and nose profile from the approved art direction.
- Rear views include authored hair and clothing detail instead of mirrored front geometry.
- Left and right frames may share a mirrored base only when asymmetric details are corrected afterward.

The front idle pose retains a subtle blink. Bride hair, bouquet, groom boutonniere, and outfit layers must not visibly jump during the blink.

## Quality Gates

### Automated Asset Checks

The asset audit must verify:

- Exact source and generated dimensions.
- Transparent background.
- Expected frame count and row order.
- Stable foot baseline and center-axis bounds.
- Allowed marker and output palette ranges.
- No unknown marker colors.
- No duplicate output paths.
- No missing catalog assets.
- Minimum nontransparent-pixel complexity by asset class.
- Distinct silhouette hashes for different hair and outfit styles.
- Minimum image-difference threshold between distinct catalog styles.

Thresholds must be calibrated from the approved bride, groom, and first representative guest masters. They must reject the current simplistic assets without rejecting intentional palette variants.

### Contact Sheets

The pipeline must generate review contact sheets containing:

- Bride and groom in all directions and walk frames.
- Enlarged nearest-neighbor views and actual-size views.
- Representative masculine and feminine guest combinations.
- Every hairstyle in black or dark brown.
- Every outfit in one canonical palette.
- Accessory compatibility examples.

Contact sheets are review artifacts and must not replace inspection in the actual application.

### Application Review

Before release, verify:

- The couple and guests are readable on a 390px-wide mobile viewport.
- Faces, hair silhouettes, outfit materials, and accessories remain distinguishable at actual scale.
- Characters do not overlap entry controls or navigation controls.
- World movement remains aligned to the existing tile and collision system.
- Missing layers hide independently without collapsing the character.
- Two realtime sessions reproduce the exact selected guest appearance.

## Implementation Sequence

1. Preserve the recovered reference as a committed design asset.
2. Add frame guides and measurable visual-quality tests.
3. Hand-author the groom master and all required frames.
4. Hand-author the bride master and all required frames.
5. Produce couple contact sheets and perform the first visual approval gate.
6. Hand-author masculine and feminine base bodies using the approved A2/F1 standard.
7. Rework all sixteen hairstyles.
8. Rework all ten outfits.
9. Rework all ten accessories.
10. Rebuild generated palette variants and contact sheets.
11. Remove the procedural source-authoring generator and every invocation of it.
12. Run asset audits, unit tests, type checks, builds, mobile visual checks, realtime checks, and production verification.

The sequence intentionally prevents bulk guest production before the couple proves the final art language at game scale.

## Testing And Release

The implementation must preserve all existing character-system behavior and pass:

- Character catalog and palette tests.
- Asset-generation and asset-audit tests.
- Character layer resolution and fallback tests.
- Customizer interaction and storage tests.
- Realtime protocol and Worker tests.
- Full repository test suite.
- Type checks and production build.
- Browser verification at desktop and 390px mobile widths.
- Two-session realtime verification.
- Production smoke verification after deployment.

Art completion is not measured only by successful PNG generation. Completion requires the automated quality gates, contact sheets, in-application inspection, and direct comparison with the recovered reference.

## Out Of Scope

- Changing the garden map, tile size, collision rules, or camera.
- Changing customization categories or realtime protocol fields.
- Adding new outfit, hair, accessory, pose, or emote counts.
- Increasing the world sprite beyond `48x72`.
- Replacing the layered guest renderer.
- Introducing runtime AI generation or unrestricted color controls.

## Acceptance Criteria

The rework is complete when:

- The committed reference matches the recorded checksum.
- No production character shape is generated by procedural drawing code.
- Bride and groom visibly preserve the recovered concept's faces, proportions, hair, formalwear, and detail hierarchy.
- Guests visibly belong to the same art direction and achieve the approved 85% quality target.
- All catalog hairstyles and outfits have distinct silhouettes.
- Actual-size mobile inspection confirms that characters remain attractive and readable.
- Automated checks, tests, builds, realtime verification, and production smoke checks pass.
