import { useState } from "react";
import { invitationContent, type SpotId } from "@wedding-game/shared";
import { gardenWorld } from "../game/world";
import type { EntryProfile } from "./EntryScreen";
import { PixelAvatar } from "./PixelAvatar";
import { SpotModal } from "./SpotModal";

type GameWorldProps = {
  profile: EntryProfile;
};

const toPercent = (value: number, total: number) => `${(value / total) * 100}%`;

export function GameWorld({ profile }: GameWorldProps) {
  const [activeSpotId, setActiveSpotId] = useState<SpotId | null>(null);

  return (
    <section className="game-world" aria-label="정원 월드">
      <div className="world-map">
        <div
          className="world-map__stage"
          data-logical-width={gardenWorld.bounds.width}
          data-logical-height={gardenWorld.bounds.height}
        >
          <div className="world-path world-path--vertical" />
          <div className="world-path world-path--middle" />
          <div className="world-path world-path--bottom" />
          {gardenWorld.spots.map((spot) => {
            const content = invitationContent.spots.find((candidate) => candidate.id === spot.id);

            return (
              <button
                key={spot.id}
                type="button"
                className={`world-spot world-spot--${spot.id}`}
                style={{
                  left: toPercent(spot.x, gardenWorld.bounds.width),
                  top: toPercent(spot.y, gardenWorld.bounds.height),
                  width: toPercent(spot.width, gardenWorld.bounds.width),
                  height: toPercent(spot.height, gardenWorld.bounds.height)
                }}
                onClick={() => setActiveSpotId(spot.id)}
              >
                <span>{spot.label}</span>
                <small>{content?.actionLabel ?? "보기"}</small>
              </button>
            );
          })}
          <div
            className="world-player"
            style={{
              left: toPercent(gardenWorld.spawn.x, gardenWorld.bounds.width),
              top: toPercent(gardenWorld.spawn.y, gardenWorld.bounds.height)
            }}
          >
            <PixelAvatar avatar={profile.avatar} color={profile.color} label={`${profile.nickname} 캐릭터`} />
            <span>{profile.nickname}</span>
          </div>
        </div>
      </div>
      <div className="world-actions" aria-label="초대장 바로가기">
        {invitationContent.spots.map((spot) => (
          <button key={spot.id} type="button" onClick={() => setActiveSpotId(spot.id)}>
            {spot.actionLabel}
          </button>
        ))}
      </div>
      {activeSpotId ? <SpotModal spotId={activeSpotId} onClose={() => setActiveSpotId(null)} /> : null}
    </section>
  );
}
