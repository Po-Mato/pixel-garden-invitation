import { describe, expect, it, vi } from "vitest";
import {
  loadNpcDialogueMemory,
  markNpcGroupCelebrationSeen,
  npcGroupCelebrationReady,
  npcConversationSnapshot,
  npcDialogueMemoryStorageKey,
  rememberNpcDialogueChoice
} from "./npcDialogueMemory";

describe("npcDialogueMemory", () => {
  it("선택한 대화를 NPC별로 기억하고 관계 단계를 높인다", () => {
    const storage = { getItem: vi.fn(() => null), setItem: vi.fn() };
    let memory = loadNpcDialogueMemory(storage);
    memory = rememberNpcDialogueChoice(memory, "bride", "heart", storage, "2027-05-01T08:00:00.000Z");
    memory = rememberNpcDialogueChoice(memory, "bride", "greet", storage, "2027-05-01T08:01:00.000Z");
    memory = rememberNpcDialogueChoice(memory, "bride", "celebrate", storage, "2027-05-01T08:02:00.000Z");

    expect(npcConversationSnapshot(memory, "bride")).toEqual({
      interactionCount: 3,
      affinityPoints: 5,
      affinityLevel: 2,
      lastChoiceId: "celebrate",
      relationshipLabel: "반가운 재회",
      specialRewardLabel: null
    });
    expect(npcConversationSnapshot(memory, "groom").relationshipLabel).toBe("첫 만남");
    expect(storage.setItem).toHaveBeenLastCalledWith(npcDialogueMemoryStorageKey, expect.any(String));
  });

  it("깨진 저장값과 알 수 없는 선택을 안전하게 정리한다", () => {
    const memory = loadNpcDialogueMemory({
      getItem: () => JSON.stringify({ version: 1, records: { bride: { interactionCount: 4, choiceIds: ["heart", "unknown"] } } }),
      setItem: vi.fn()
    });
    expect(memory.records.bride?.choiceIds).toEqual(["heart"]);
    expect(npcConversationSnapshot(memory, "bride").interactionCount).toBe(4);
  });

  it("호감도 6점에서 NPC 고유 특별 보상을 연다", () => {
    let memory = loadNpcDialogueMemory(null);
    memory = rememberNpcDialogueChoice(memory, "groom", "heart", null);
    memory = rememberNpcDialogueChoice(memory, "groom", "celebrate", null);
    memory = rememberNpcDialogueChoice(memory, "groom", "heart", null);
    expect(npcConversationSnapshot(memory, "groom")).toMatchObject({
      affinityPoints: 6,
      affinityLevel: 3,
      relationshipLabel: "소중한 인연",
      specialRewardLabel: "신랑의 축배 메시지"
    });
  });

  it("두 NPC와 모두 소중한 인연이 되면 단체 축하를 한 번 연다", () => {
    let memory = loadNpcDialogueMemory(null);
    for (const npcId of ["bride", "groom"] as const) {
      memory = rememberNpcDialogueChoice(memory, npcId, "heart", null);
      memory = rememberNpcDialogueChoice(memory, npcId, "celebrate", null);
      memory = rememberNpcDialogueChoice(memory, npcId, "heart", null);
    }
    expect(npcGroupCelebrationReady(memory)).toBe(true);
    expect(memory.groupCelebrationSeen).toBe(false);
    expect(markNpcGroupCelebrationSeen(memory, null).groupCelebrationSeen).toBe(true);
  });
});
