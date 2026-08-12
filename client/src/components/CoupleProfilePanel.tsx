import type { WeddingContent } from "@wedding-game/shared";
import { useCoupleOrder } from "../invitation/CoupleOrderContext";
import { coupleSides } from "../invitation/coupleOrder";
import { resolveGalleryAssetPath } from "../invitation/galleryAssets";
import { usePublishedInvitationContent } from "../invitation/PublishedInvitationContentContext";
import { CouplePuppetStage } from "./CouplePuppetStage";

export function CoupleProfilePanel({ content: contentOverride }: { content?: WeddingContent } = {}) {
  const published = usePublishedInvitationContent();
  const { coupleMessage, coupleProfiles, gallery } = contentOverride ?? published.content;
  const coupleOrder = useCoupleOrder();
  const orderedProfiles = coupleSides(coupleOrder).flatMap((side) => (
    coupleProfiles.filter((profile) => profile.role === side)
  ));

  return (
    <div className="couple-profile-panel">
      {orderedProfiles.map((profile) => {
        const photo = gallery.find((candidate) => candidate.id === profile.photoId);
        const sectionLabel = `${profile.roleLabel} ${profile.name}`;

        return (
          <section
            key={profile.role}
            className={`couple-profile-panel__person couple-profile-panel__person--${profile.role}`}
            aria-label={sectionLabel}
            data-photo-orientation={photo?.orientation}
          >
            <header className="couple-profile-panel__identity">
              <p className="couple-profile-panel__role">{profile.roleLabel}</p>
              <h3 className="couple-profile-panel__name">{profile.name}</h3>
            </header>
            {photo ? (
              <div className="couple-profile-panel__media" data-orientation={photo.orientation}>
                <img
                  className="couple-profile-panel__image"
                  src={resolveGalleryAssetPath(photo.assetPath)}
                  alt={photo.alt}
                  width={photo.width}
                  height={photo.height}
                  loading="lazy"
                  decoding="async"
                />
                <span className="couple-profile-panel__photo-label" aria-hidden="true">
                  {profile.role === "bride" ? "BRIDE" : "GROOM"} PORTRAIT
                </span>
                <CouplePuppetStage
                  className="couple-profile-panel__puppet"
                  character={profile.role}
                  label={`${sectionLabel} 2D 퍼펫`}
                />
              </div>
            ) : null}
            <p className="couple-profile-panel__message">{profile.message}</p>
          </section>
        );
      })}
      <p className="couple-profile-panel__together">{coupleMessage}</p>
    </div>
  );
}
