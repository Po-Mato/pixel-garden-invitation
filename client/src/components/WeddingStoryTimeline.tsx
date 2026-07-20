import { invitationContent } from "@wedding-game/shared";

export function WeddingStoryTimeline() {
  return (
    <ol
      className="wedding-story-timeline"
      style={{ display: "grid", gap: "16px", margin: 0, padding: "0 0 0 20px", borderInlineStart: "2px solid var(--sage)" }}
    >
      {invitationContent.content.storyTimeline.map((step, index) => (
        <li key={step.id} style={{ position: "relative", paddingInlineStart: "12px" }}>
          <span
            aria-hidden="true"
            style={{ position: "absolute", insetInlineStart: "-27px", top: "2px", width: "12px", height: "12px", background: "var(--camellia)" }}
          />
          <p>{index + 1}</p>
          <h3>{step.title}</h3>
          <p>{step.body}</p>
        </li>
      ))}
    </ol>
  );
}
