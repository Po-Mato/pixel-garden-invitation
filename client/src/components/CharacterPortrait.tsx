import type { CharacterAppearance } from "@wedding-game/shared";
import { resolveCharacterPortraitUrl } from "../character/assets";

type CharacterPortraitProps = {
  appearance: CharacterAppearance;
  label?: string;
  className?: string;
};

export function CharacterPortrait({
  appearance,
  label,
  className = ""
}: CharacterPortraitProps) {
  return (
    <img
      className={`character-portrait ${className}`.trim()}
      src={resolveCharacterPortraitUrl(appearance)}
      alt={label ?? ""}
      aria-hidden={label ? undefined : true}
      decoding="async"
    />
  );
}
