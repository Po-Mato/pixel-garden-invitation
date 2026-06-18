import {
  characterCatalog,
  type CharacterAppearance,
  type CharacterLayerSlot
} from "@wedding-game/shared";

export type ResolvedCharacterLayer = {
  slot: CharacterLayerSlot;
  walkUrl: string;
  idleUrl?: string;
};

const layerOrder: CharacterLayerSlot[] = [
  "back-accessory",
  "back-hair",
  "base",
  "outfit",
  "front-hair",
  "face",
  "jewelry",
  "neckwear",
  "carry"
];

const accessoryById = new Map(
  characterCatalog.accessories.map((accessory) => [accessory.id, accessory])
);

const assetUrl = (baseUrl: string, path: string) =>
  `${baseUrl}characters/generated/${path}`;

export function resolveCharacterLayers(
  appearance: CharacterAppearance,
  baseUrl = import.meta.env.BASE_URL
): ResolvedCharacterLayer[] {
  const selectedAccessories = Object.values(appearance.accessories)
    .filter((id): id is string => id !== null)
    .map((id) => accessoryById.get(id))
    .filter((item): item is NonNullable<typeof item> => item !== undefined);

  const layers: ResolvedCharacterLayer[] = [
    ...selectedAccessories
      .filter((item) => item.layer === "back-accessory")
      .map((item) => ({
        slot: item.layer,
        walkUrl: assetUrl(baseUrl, `accessories/${item.id}__walk.png`)
      })),
    {
      slot: "back-hair",
      walkUrl: assetUrl(
        baseUrl,
        `hair/${appearance.hairStyle}__${appearance.hairColor}__back-walk.png`
      )
    },
    {
      slot: "base",
      walkUrl: assetUrl(
        baseUrl,
        `base/${appearance.family}__${appearance.skinTone}__walk.png`
      ),
      idleUrl: assetUrl(
        baseUrl,
        `base/${appearance.family}__${appearance.skinTone}__idle.png`
      )
    },
    {
      slot: "outfit",
      walkUrl: assetUrl(
        baseUrl,
        `outfits/${appearance.outfit}__${appearance.outfitPalette}__walk.png`
      )
    },
    {
      slot: "front-hair",
      walkUrl: assetUrl(
        baseUrl,
        `hair/${appearance.hairStyle}__${appearance.hairColor}__front-walk.png`
      )
    },
    ...selectedAccessories
      .filter((item) => item.layer !== "back-accessory")
      .map((item) => ({
        slot: item.layer,
        walkUrl: assetUrl(baseUrl, `accessories/${item.id}__walk.png`)
      }))
  ];

  return layers.sort(
    (first, second) => layerOrder.indexOf(first.slot) - layerOrder.indexOf(second.slot)
  );
}
