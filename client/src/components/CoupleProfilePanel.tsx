import { invitationContent } from "@wedding-game/shared";
import { resolveGalleryAssetPath } from "../invitation/galleryAssets";

export function CoupleProfilePanel() {
  const { coupleMessage, coupleProfiles, gallery } = invitationContent.content;

  return (
    <div className="couple-profile-panel" style={{ display: "grid", gap: "16px" }}>
      {coupleProfiles.map((profile) => {
        const photo = gallery.find((candidate) => candidate.id === profile.photoId);
        const sectionLabel = `${profile.roleLabel} ${profile.name}`;

        return (
          <section key={profile.role} aria-label={sectionLabel} style={{ display: "grid", gap: "8px" }}>
            <p>{profile.roleLabel}</p>
            <h3>{profile.name}</h3>
            {photo ? (
              <img
                src={resolveGalleryAssetPath(photo.assetPath)}
                alt={photo.alt}
                width={photo.width}
                height={photo.height}
                style={{ width: "min(100%, 180px)", height: "auto", objectFit: "cover" }}
              />
            ) : null}
            <p>{profile.message}</p>
          </section>
        );
      })}
      <p>{coupleMessage}</p>
    </div>
  );
}
