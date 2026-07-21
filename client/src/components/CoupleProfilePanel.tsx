import { invitationContent } from "@wedding-game/shared";
import { useCoupleOrder } from "../invitation/CoupleOrderContext";
import { coupleSides } from "../invitation/coupleOrder";
import { resolveGalleryAssetPath } from "../invitation/galleryAssets";

export function CoupleProfilePanel() {
  const { coupleMessage, coupleProfiles, gallery } = invitationContent.content;
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
          >
            <p className="couple-profile-panel__role">{profile.roleLabel}</p>
            <h3 className="couple-profile-panel__name">{profile.name}</h3>
            {photo ? (
              <img
                className="couple-profile-panel__image"
                src={resolveGalleryAssetPath(photo.assetPath)}
                alt={photo.alt}
                width={photo.width}
                height={photo.height}
              />
            ) : null}
            <p className="couple-profile-panel__message">{profile.message}</p>
          </section>
        );
      })}
      <p className="couple-profile-panel__together">{coupleMessage}</p>
    </div>
  );
}
