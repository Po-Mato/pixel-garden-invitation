# Pixel Character System Design

Date: 2026-06-18  
Project root: `/Users/sjlee/Documents/New project 5`  
Status: Draft for user review

## Goal

Replace the current two-block CSS avatar with a production-quality layered pixel character system.

The character system must:

- Look attractive and detailed enough to carry the visual identity of the invitation.
- Preserve crisp pixel rendering in the mobile garden.
- Support many distinct wedding guest combinations without pre-rendering every combination.
- Keep the bride and groom visually more special than guest characters.
- Work with the existing 30px tile collision and four-direction grid movement.
- Send compact, validated character appearance data through the realtime protocol.

## Confirmed Decisions

- Art direction: ornate fashion pixel art with expressive faces and detailed clothing.
- Guest character size: compact version, rendered on and displayed at exactly `48x72` pixels.
- Guest quality: approximately 85% of the bride and groom asset detail.
- Groom NPC: fitted black tuxedo, satin lapels, white shirt, black bow tie, white boutonniere.
- Bride NPC: long dark-brown wavy hair, ivory lace wedding gown, pearl details, bouquet.
- Bride and groom are fixed garden NPCs, not selectable player avatars.
- Guest customization uses separate masculine and feminine character families.
- Skin tones: 5.
- Hairstyles: 8 per character family, 16 total.
- Hair colors: 6 natural colors.
- Clothing: wedding guest attire only.
- Clothing selection: outfit set first, curated color palette second.
- Accessories: initial catalog of 10.
- Animation: front idle plus three-frame walking in all four directions.
- Customizer layout: large preview at the top and category tabs below.
- Rendering strategy: transparent layered pixel sprite sheets.
- Realtime migration: replace the existing `avatar` and `color` fields immediately. Do not maintain legacy protocol compatibility.

## Visual Standard

### Frame Size

Each animation frame uses a `48x72` pixel canvas and is displayed at the same CSS size.

Using a 1:1 source-to-CSS scale avoids uneven pixel scaling while providing enough room for:

- Eye shape and highlights.
- Blush and mouth pixels.
- Layered hair highlights.
- Jacket lapels and shirt details.
- Dress folds and lace edges.
- Jewelry, glasses, neckwear, brooches, and bags.

The character's collision point remains the center of a single 30px world tile. The sprite is anchored at the feet, so the head and clothing may extend above or beside the collision tile without changing movement rules.

### Palette

Each final character should use a controlled palette rather than arbitrary CSS tinting.

- Skin layer: 5 authored palettes.
- Hair layer: 6 authored natural palettes.
- Outfit set: 4 authored color palettes per outfit.
- Per-character target: approximately 16 to 24 visible colors.
- Bride and groom may use up to 28 colors for highlights, lace, flowers, and formalwear details.

No runtime hue rotation or unrestricted color picker will be used. Curated palettes prevent muddy shading and preserve art quality.

### Bride And Groom Priority

Guest characters and NPCs share the same proportions and rendering system, but the bride and groom receive exclusive details.

Groom-exclusive details:

- Satin lapel highlights.
- More detailed tuxedo shading.
- Boutonniere.
- Gold cufflink pixels.
- Unique hairstyle.

Bride-exclusive details:

- Long layered wave animation.
- Lace sleeve and bodice pixels.
- Pearl earrings and hair ornament.
- Bouquet.
- Gown train and additional fabric shading.

## Layer Architecture

Every frame is assembled from aligned transparent sprite layers in this back-to-front order:

1. Back accessory: bag strap, rear hat section.
2. Back hair: long hair and rear hair silhouette.
3. Base body: skin tone, face, ears, arms, and legs.
4. Outfit: suit, jacket, dress, blouse set, or hanbok.
5. Front hair: bangs, side locks, and front highlights.
6. Face accessory: glasses.
7. Jewelry or neckwear: earrings, necklace, tie, bow tie, or brooch.
8. Front accessory: handbag or other visible carried item.

All layers use the same frame dimensions, direction rows, and animation columns. A layer may leave unused pixels transparent.

## Sprite Sheet Format

Each walking layer asset is a PNG sprite sheet:

- Frame size: `48x72`.
- Columns: 3 walking frames.
- Rows: down, left, right, up.
- Sheet size: `144x288`.
- File format: transparent PNG.
- Rendering: CSS `image-rendering: pixelated`.

The front idle animation uses a separate `96x72` two-frame sheet for the base face layer:

- Frame 1: neutral face.
- Frame 2: blink face.
- All other layers retain the center frame of the down walking row.
- NPC-specific front hair or jewelry may provide an optional two-frame idle sheet when the blink changes overlapping pixels.
- Reduced-motion mode keeps frame 1 and does not animate.

File layout:

```text
character-assets/
  source/
    base/
    hair/back/
    hair/front/
    outfits/
    accessories/
    npc/
  palettes/
client/public/characters/generated/
shared/character-catalog.json
```

Asset names use stable IDs, not Korean display labels. Example:

```text
hair/front/feminine-wave-long-01__dark-brown.png
outfits/feminine-midi-dress-01__dusty-rose.png
accessories/face/glasses-round-gold.png
```

## Asset Production Pipeline

Source sprite sheets use a small set of exact palette marker colors. A Node build script converts those markers into the approved skin, hair, and outfit palettes.

```text
character-assets/source/*.png
        +
character-assets/palettes/*.json
        +
shared/character-catalog.json
        |
        v
scripts/generate-character-assets.mjs
        |
        v
client/public/characters/generated/*.png
```

Rules:

- `shared/character-catalog.json` is the single source for IDs, family compatibility, labels, palette IDs, layer slots, and deterministic generated asset paths.
- `shared/src/characterCatalog.ts` imports and validates the JSON catalog for both client and Worker usage.
- Hair source sheets are authored once per style. The generator emits the six approved hair-color versions.
- Outfit source sheets are authored once per outfit. The generator emits the four approved outfit palettes.
- Skin source sheets are authored once per character family. The generator emits the five skin-tone versions.
- Accessories with fixed materials are copied without recoloring.
- The generated PNGs are build artifacts and are regenerated before tests that validate the catalog and before the production client build.
- The production client never applies CSS filters, hue rotation, or arbitrary runtime tinting.
- The generator fails when a source PNG is missing, has unexpected dimensions, contains an unknown marker color, or would overwrite a duplicate output path.

This keeps source asset authoring manageable while still shipping authored, deterministic PNG files for every visible palette.

## Initial Guest Catalog

### Character Families

- `masculine`
- `feminine`

These are visual asset families and UI labels, not restrictions on which appearance a guest may choose. A guest can select either family.

### Skin Tones

Five authored tones:

- `skin-01-light`
- `skin-02-fair`
- `skin-03-medium`
- `skin-04-tan`
- `skin-05-deep`

### Hairstyles

Masculine family, 8:

- Neat side part.
- Soft comma hair.
- Short crop.
- Textured fringe.
- Medium swept back.
- Wavy medium cut.
- Low ponytail.
- Short natural curl.

Feminine family, 8:

- Long wave.
- Long straight.
- Low bun.
- Half-up wave.
- Medium bob.
- Short bob.
- Braided ponytail.
- Natural curl.

### Hair Colors

- Black.
- Dark brown.
- Brown.
- Light brown.
- Gray.
- Platinum.

### Outfit Sets

Masculine family, 5:

- Classic suit.
- Modern slim suit.
- Blazer and slacks.
- Formal knit jacket set.
- Formal hanbok.

Feminine family, 5:

- Midi guest dress.
- Long guest dress.
- Blouse and skirt set.
- Jacket and slacks set.
- Formal hanbok.

Each outfit has four authored palettes appropriate to its material and silhouette. The palettes use wedding-safe colors such as navy, charcoal, sage, dusty rose, muted blue, plum, cream accents, and traditional hanbok combinations. Pure black tuxedo styling and ivory bridal gown styling remain NPC-exclusive.

### Accessories

The initial catalog contains 10 asset designs distributed across four slots:

- Face: round glasses, square glasses.
- Jewelry: pearl earrings, drop earrings, simple necklace.
- Neckwear/brooch: tie, bow tie, floral brooch.
- Front/back accessory: formal handbag, small structured shoulder bag.

The customizer allows at most one selection per slot. Selecting `none` is always available. This prevents overlapping assets while still allowing multiple compatible accessories.

## Character Data Model

Replace `AvatarType` and `AvatarColor` with:

```ts
type CharacterFamily = "masculine" | "feminine";

type CharacterAppearance = {
  family: CharacterFamily;
  skinTone: SkinToneId;
  hairStyle: HairStyleId;
  hairColor: HairColorId;
  outfit: OutfitId;
  outfitPalette: OutfitPaletteId;
  accessories: {
    face: FaceAccessoryId | null;
    jewelry: JewelryAccessoryId | null;
    neckwear: NeckwearAccessoryId | null;
    carry: CarryAccessoryId | null;
  };
};
```

Option IDs and compatibility metadata come from a typed character manifest. The UI does not hardcode available assets.

Changing the character family resets incompatible hair, outfit, and accessory selections to the manifest defaults for the new family.

## Character Manifest

`shared/character-catalog.json` is the single catalog source for:

- Asset IDs.
- Korean display labels.
- Supported character family.
- Asset URLs.
- Available palette IDs.
- Accessory slot.
- Layer order.
- Default selections.
- Compatibility constraints.

The build includes a generation and validation step that verifies:

- Every source and generated PNG exists.
- Every outfit has four palettes.
- Every family has eight hairstyles.
- Every hair style supports six hair colors.
- Every walking sheet is `144x288`.
- Every required idle sheet is `96x72`.
- IDs are unique.
- Default combinations are valid.

The application falls back to a safe default appearance if stored or network appearance data fails validation.

## React Components

### `CharacterSprite`

Responsibilities:

- Resolve a validated `CharacterAppearance` through the manifest.
- Render aligned layer elements.
- Apply direction and animation frame.
- Anchor the sprite at the feet.
- Expose an accessible label on the outer element only.

Props:

```ts
type CharacterSpriteProps = {
  appearance: CharacterAppearance;
  direction: Direction;
  moving: boolean;
  stepFrame?: number;
  label?: string;
  variant?: "guest" | "npc";
};
```

### `CharacterCustomizer`

Responsibilities:

- Show the large live preview.
- Manage category tabs.
- Filter compatible options.
- Provide randomize and reset actions.
- Produce only a validated `CharacterAppearance`.

Tabs:

1. Family and skin.
2. Hair style.
3. Hair color.
4. Outfit set.
5. Outfit palette.
6. Accessories.

The existing nickname input remains below the preview and above the final entry button.

### `WeddingNpc`

Responsibilities:

- Render the fixed bride or groom appearance.
- Use the same movement/rendering primitives as guest characters.
- Open the existing couple introduction panel when selected.

The first release keeps NPCs stationary with the approved two-frame front idle animation. Walking NPC behavior is outside this character-system scope.

## Customizer Interaction

The customizer uses the approved layout:

- Large preview at the top.
- Pixel garden preview background.
- Category tabs below the preview.
- Image tiles rather than text-only buttons.
- Selected tile uses a clear border and pressed state.
- `Random` creates only valid wedding-appropriate combinations.
- `Reset` restores the default guest appearance for the selected family.
- Entry remains disabled until the nickname is valid.

Selections are saved to local storage so a returning guest on the same device sees the last appearance. Invalid or outdated saved IDs are discarded through manifest validation.

## Animation Behavior

Walking uses three frames per direction:

1. Left-foot step.
2. Neutral.
3. Right-foot step.

The tile movement interval remains approximately 150ms. The animation frame advances once per tile step, which makes the visual cadence match the discrete movement model.

When movement stops:

- The sprite returns to the neutral frame for its last direction.
- The entry preview uses the two-frame front idle cycle.
- Local and remote guests use the two-frame front idle cycle only when their last direction is down; other directions remain on their neutral walk frame.
- Bride and groom NPCs use the same front idle cycle, with optional NPC-specific hair or jewelry idle overlays.
- The blink frame appears briefly every 2.4 seconds and is not synchronized between characters.

Remote guests use the server-provided `direction` and `moving` fields. Their appearance does not change during a room session.

## Realtime Protocol Migration

The existing protocol changes immediately:

```ts
// Before
{ type: "join", nickname, avatar, color }

// After
{ type: "join", nickname, appearance }
```

`RoomGuest` also replaces `avatar` and `color` with `appearance`.

Migration rules:

- Do not accept the legacy join shape.
- Update shared protocol types and validation in the same release.
- Update client message parsing and Durable Object room state in the same release.
- A deployment may disconnect existing WebSockets; clients reconnect using the new format.
- D1 schema does not change because live guest appearance is not persisted.

The Worker validates every appearance ID against a server-side copy of the allowed manifest IDs. Invalid appearance objects receive a safe protocol error and are not added to the room.

## Performance

The initial implementation uses layered DOM elements with sprite sheet backgrounds.

Constraints:

- Load each unique asset URL once through normal browser caching.
- Do not create duplicate `<img>` downloads per guest.
- Limit active visual layers to the layers required by the chosen appearance.
- Avoid CSS filters for runtime recoloring.
- Use `will-change` only on the outer moving character element.

If profiling later shows a bottleneck with many simultaneous guests, cache each unique appearance combination into an offscreen canvas. This is an optimization path, not part of the first implementation.

## Error Handling

- Missing manifest entry: use the default appearance.
- Missing image asset: hide the failed layer and report a development console warning.
- Invalid local-storage value: discard it and restore defaults.
- Invalid realtime appearance: reject the join message.
- Family change with incompatible selections: reset only incompatible fields.
- Asset loading delay: retain a fixed preview box to avoid layout shift.

## Accessibility

- Character option tiles expose Korean names and selected state.
- Color choices include text labels and are not represented by color alone.
- Tabs support keyboard navigation.
- Randomize and reset are normal labeled buttons.
- Layer images are decorative; the composed outer character has one accessible label.
- Reduced-motion users receive neutral frames without idle blinking.

## Testing Strategy

### Unit Tests

- Manifest validation and compatibility resolution.
- Palette generation and source marker validation.
- Appearance fallback behavior.
- Family-change reset behavior.
- Randomizer output validity.
- Sprite sheet frame position calculation.
- Protocol validation for valid and invalid appearance objects.

### Component Tests

- Customizer tab navigation.
- Preview updates for every category.
- Selected states and keyboard interaction.
- Local-storage restore and invalid-data fallback.
- `CharacterSprite` layer order and frame changes.
- Bride and groom NPC interaction.

### Worker Tests

- New join message accepted.
- Legacy `avatar/color` join rejected.
- Invalid IDs rejected.
- Room snapshots preserve appearance objects.

### Browser Verification

- Desktop and 390px mobile customizer layouts.
- Crisp sprite rendering without blur.
- No horizontal overflow.
- Four-direction tile movement.
- Two browser sessions showing distinct customized guests.
- Offline/solo mode still renders the local appearance.
- Bride and groom NPCs are visually distinct from all guest combinations.

## Scope Boundaries

Included:

- New layered guest sprite system.
- Initial guest asset catalog.
- Bride and groom NPC sprites.
- Character customizer redesign.
- Four-direction walk animation.
- Realtime appearance protocol migration.
- Couple NPC placement and existing couple-panel interaction.

Not included:

- User-uploaded portraits.
- Arbitrary color picker.
- Runtime AI character generation.
- Additional emotes such as clapping or photography poses.
- Persistent server-side guest profiles.
- NPC pathfinding or autonomous walking.
- Legacy avatar protocol compatibility.

## Acceptance Criteria

- Guests can create a detailed wedding-appropriate character through the approved top-preview tabbed customizer.
- The initial catalog includes all confirmed skin, hair, outfit, palette, and accessory counts.
- Characters render with crisp `48x72` pixel frames and remain anchored to one 30px movement tile.
- Four-direction walking uses three frames and advances with discrete tile movement.
- Front-facing idle characters use the approved two-frame blink cycle.
- Bride and groom appear as exclusive fixed NPCs and are more detailed than guests.
- Remote guests receive and render the same appearance selected on their own clients.
- Invalid appearance combinations cannot enter the realtime room.
- Existing tests, production build, Worker dry-run, and desktop/mobile browser verification pass.
