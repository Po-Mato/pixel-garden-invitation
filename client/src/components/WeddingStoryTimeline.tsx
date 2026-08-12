import type { WeddingContent } from "@wedding-game/shared";
import { usePublishedInvitationContent } from "../invitation/PublishedInvitationContentContext";
import { ResponsiveGalleryImage } from "./ResponsiveGalleryImage";

export function WeddingStoryTimeline({ timeline }: { timeline?: WeddingContent["storyTimeline"] } = {}) {
  const { content } = usePublishedInvitationContent();
  const steps = timeline ?? content.storyTimeline;
  return (
    <ol className="wedding-story wedding-story-timeline">
      {steps.map((step, index) => {
        const photo = content.gallery.find((candidate) => candidate.id === step.photoId);
        const number = String(index + 1).padStart(2, "0");

        return (
          <li
            key={step.id}
            className="wedding-story-timeline__step"
            data-orientation={photo?.orientation}
          >
            {photo ? (
              <figure className="wedding-story-timeline__media">
                <ResponsiveGalleryImage
                  photo={photo}
                  sizes="(max-width: 520px) calc(100vw - 48px), 430px"
                />
                <figcaption aria-hidden="true">OUR STORY · {number}</figcaption>
              </figure>
            ) : null}
            <div className="wedding-story-timeline__copy">
              <span className="wedding-story-timeline__number" aria-hidden="true">{number}</span>
              <h3 className="wedding-story-timeline__title">{step.title}</h3>
              <p className="wedding-story-timeline__body">{step.body}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
