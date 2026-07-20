import { invitationContent } from "@wedding-game/shared";

export function WeddingStoryTimeline() {
  return (
    <ol className="wedding-story wedding-story-timeline">
      {invitationContent.content.storyTimeline.map((step, index) => (
        <li key={step.id} className="wedding-story-timeline__step">
          <span className="wedding-story-timeline__number" aria-hidden="true">
            {String(index + 1).padStart(2, "0")}
          </span>
          <h3 className="wedding-story-timeline__title">{step.title}</h3>
          <p className="wedding-story-timeline__body">{step.body}</p>
        </li>
      ))}
    </ol>
  );
}
