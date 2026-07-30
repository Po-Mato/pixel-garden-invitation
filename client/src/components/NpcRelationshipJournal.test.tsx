import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { NpcRelationshipJournal } from "./NpcRelationshipJournal";

afterEach(() => cleanup());

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
    expect(screen.getByRole("region", { name: "이건희 삽화 편지 수집함" })).toHaveTextContent("꽃잎 감사 편지");
    expect(screen.getByRole("button", { name: /꽃잎 감사 편지/ })).toBeDisabled();
  });

  it("보상으로 해금한 삽화 편지를 수집함에서 다시 펼친다", () => {
    render(<NpcRelationshipJournal names={{ bride: "이건희", groom: "이승재" }} memory={{
      version: 1,
      groupCelebrationSeen: false,
      records: { bride: { interactionCount: 4, affinityPoints: 7, choiceIds: ["greet", "heart", "heart", "celebrate"], unlockedRewardIds: ["bride-gratitude-letter"], lastInteractedAt: null } }
    }} />);
    fireEvent.click(screen.getByText("두 사람과의 인연 일지"));
    fireEvent.click(screen.getByRole("button", { name: /꽃잎 감사 편지/ }));
    expect(screen.getByText(/꽃잎마다 오늘 함께해 주신/)).toBeInTheDocument();
  });
});
