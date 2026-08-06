import { memo, useSyncExternalStore } from "react";
import type { CharacterAppearance, GuestReaction, WorldZoneId } from "@wedding-game/shared";
import { worldCharacterAnchorStyle } from "../character/worldAnchor";
import type { WorldMotionStore } from "../game/worldMotionStore";
import { worldDepth } from "../game/worldVisuals";
import { CharacterSprite } from "./CharacterSprite";
import { GuestReactionBubble } from "./GuestReactions";

type WorldLocalPlayerProps = {
  appearance: CharacterAppearance;
  nickname: string;
  motionStore: WorldMotionStore;
  activeZoneId: WorldZoneId;
  reaction: { reaction: GuestReaction; zoneId: WorldZoneId } | null;
};

export const WorldLocalPlayer = memo(function WorldLocalPlayer({
  appearance,
  nickname,
  motionStore,
  activeZoneId,
  reaction
}: WorldLocalPlayerProps) {
  const motion = useSyncExternalStore(
    motionStore.subscribe,
    motionStore.getSnapshot,
    motionStore.getSnapshot
  );

  return (
    <div
      className="world-player player"
      aria-label={nickname}
      style={{
        left: motion.position.x,
        top: motion.position.y,
        zIndex: worldDepth(motion.position.y),
        ...worldCharacterAnchorStyle(appearance, window.devicePixelRatio)
      }}
    >
      {reaction?.zoneId === activeZoneId ? (
        <GuestReactionBubble reaction={reaction.reaction} guestName={nickname} />
      ) : null}
      <CharacterSprite
        appearance={appearance}
        direction={motion.direction}
        moving={motion.moving}
        stepFrame={motion.stepFrame}
        label={`${nickname} 캐릭터`}
      />
      <span className="world-player__name" title={nickname}>{nickname}</span>
    </div>
  );
});
