import {
  type CharacterAppearance,
  type CharacterLayerSlot,
  guestLayerOrder,
  guestPartManifest,
  resolveGeneratedGuestPath,
  type GuestSpriteSize
} from "@wedding-game/shared";

export type CharacterDisplayMode = "world" | "preview";

export type ResolvedCharacterLayer = {
  slot: CharacterLayerSlot;
  walkUrl: string;
  idleUrl?: string;
  sourceSize: GuestSpriteSize;
  displaySize: Record<CharacterDisplayMode, GuestSpriteSize>;
};

const accessoryById = new Map(
  guestPartManifest.parts.accessories.map((accessory) => [accessory.id, accessory])
);
const baseByFamily = new Map(guestPartManifest.parts.base.map((base) => [base.family, base]));
const hairById = new Map(guestPartManifest.parts.hair.map((hair) => [hair.id, hair]));
const outfitById = new Map(guestPartManifest.parts.outfits.map((outfit) => [outfit.id, outfit]));

const assetUrl = (baseUrl: string, path: string) =>
  `${baseUrl}characters/generated/${path}`;

const dimensions = {
  sourceSize: guestPartManifest.frame.source,
  displaySize: guestPartManifest.frame.display
};

function requireManifestPart<T>(part: T | undefined, id: string, category: string): T {
  if (!part) {
    throw new Error(`Missing guest ${category} manifest part: ${id}`);
  }
  return part;
}

export function resolveCharacterLayers(
  appearance: CharacterAppearance,
  baseUrl = import.meta.env.BASE_URL
): ResolvedCharacterLayer[] {
  const base = requireManifestPart(baseByFamily.get(appearance.family), appearance.family, "base");
  const hair = requireManifestPart(hairById.get(appearance.hairStyle), appearance.hairStyle, "hair");
  const outfit = requireManifestPart(outfitById.get(appearance.outfit), appearance.outfit, "outfit");
  const selectedAccessories = Object.values(appearance.accessories)
    .filter((id): id is string => id !== null)
    .map((id) => accessoryById.get(id))
    .filter((item): item is NonNullable<typeof item> => item !== undefined);

  const layers: ResolvedCharacterLayer[] = [
    ...selectedAccessories
      .filter((item) => item.layer === "back-accessory")
      .map((item) => ({
        slot: item.layer,
        walkUrl: assetUrl(baseUrl, item.generated.walk),
        ...dimensions
      })),
    {
      slot: hair.layers.back,
      walkUrl: assetUrl(
        baseUrl,
        resolveGeneratedGuestPath(hair.generated.backWalk, { hairColor: appearance.hairColor })
      ),
      ...dimensions
    },
    {
      slot: base.layer,
      walkUrl: assetUrl(
        baseUrl,
        resolveGeneratedGuestPath(base.generated.walk, { skinTone: appearance.skinTone })
      ),
      idleUrl: assetUrl(
        baseUrl,
        resolveGeneratedGuestPath(base.generated.idle, { skinTone: appearance.skinTone })
      ),
      ...dimensions
    },
    {
      slot: outfit.layer,
      walkUrl: assetUrl(
        baseUrl,
        resolveGeneratedGuestPath(outfit.generated.walk, { outfitPalette: appearance.outfitPalette })
      ),
      ...dimensions
    },
    {
      slot: hair.layers.front,
      walkUrl: assetUrl(
        baseUrl,
        resolveGeneratedGuestPath(hair.generated.frontWalk, { hairColor: appearance.hairColor })
      ),
      ...dimensions
    },
    ...selectedAccessories
      .filter((item) => item.layer !== "back-accessory")
      .map((item) => ({
        slot: item.layer,
        walkUrl: assetUrl(baseUrl, item.generated.walk),
        ...dimensions
      }))
  ];

  return layers.sort(
    (first, second) => guestLayerOrder.indexOf(first.slot) - guestLayerOrder.indexOf(second.slot)
  );
}
