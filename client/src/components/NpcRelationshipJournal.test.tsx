import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NpcRelationshipJournal } from "./NpcRelationshipJournal";

describe("NpcRelationshipJournal", () => {
  it("해금된 관계 대화를 다시 읽는다", () => {
    render(<NpcRelationshipJournal names={{ bride: "이건희", groom: "이승재" }} memory={{
      version: 1,
      groupCelebrationSeen: false,
      records: { bride: { interactionCount: 2, affinityPoints: 3, choiceIds: ["greet", "heart"], unlockedRewardIds: [], lastInteractedAt: null } }
    }} />);
    fireEvent.click(screen.getByText("두 사람과의 인연 일지"));
    fireEvent.click(screen.getByRole("button", { name: /기억한 마음/ }));
    expect(screen.getByText(/아까 전해주신 따뜻한 마음/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /소중한 인연 전용 대화/ })).toBeDisabled();
    expect(screen.getByRole("region", { name: "이건희 장소별 인연 기록" })).toHaveTextContent("신부 대기실");
  });
});
