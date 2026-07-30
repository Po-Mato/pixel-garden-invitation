import type { NpcDialogueChoiceId, NpcId } from "./npcDialogue";

export type NpcConversationRecord = {
  interactionCount: number;
  affinityPoints: number;
  choiceIds: NpcDialogueChoiceId[];
  unlockedRewardIds: NpcAffinityRewardId[];
  lastInteractedAt: string | null;
};

export type NpcAffinityRewardId = "bride-gratitude-letter" | "groom-toast-message";

export type NpcDialogueMemory = {
  version: 1;
  records: Partial<Record<NpcId, NpcConversationRecord>>;
  groupCelebrationSeen: boolean;
};

export type NpcConversationSnapshot = {
  interactionCount: number;
  affinityPoints: number;
  affinityLevel: 0 | 1 | 2 | 3;
  lastChoiceId: NpcDialogueChoiceId | null;
  relationshipLabel: "첫 만남" | "반가운 재회" | "소중한 인연";
  specialRewardLabel: string | null;
};

type DialogueMemoryStorage = Pick<Storage, "getItem" | "setItem">;

export const npcDialogueMemoryStorageKey = "wedding-game:npc-dialogue-memory:v1";

const validChoices = new Set<NpcDialogueChoiceId>(["greet", "heart", "celebrate"]);
const validRewards = new Set<NpcAffinityRewardId>(["bride-gratitude-letter", "groom-toast-message"]);

const choiceAffinity: Record<NpcDialogueChoiceId, number> = { greet: 1, heart: 2, celebrate: 2 };

const rewardLabels: Record<NpcAffinityRewardId, string> = {
  "bride-gratitude-letter": "신부의 감사 편지",
  "groom-toast-message": "신랑의 축배 메시지"
};

function browserStorage(): DialogueMemoryStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function emptyMemory(): NpcDialogueMemory {
  return { version: 1, records: {}, groupCelebrationSeen: false };
}

function parseRecord(value: unknown): NpcConversationRecord | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<NpcConversationRecord>;
  const choiceIds = Array.isArray(record.choiceIds)
    ? record.choiceIds.filter((choice): choice is NpcDialogueChoiceId => validChoices.has(choice as NpcDialogueChoiceId)).slice(-8)
    : [];
  const affinityPoints = Number.isFinite(record.affinityPoints)
    ? Math.max(0, Math.floor(record.affinityPoints!))
    : choiceIds.reduce((total, choiceId) => total + choiceAffinity[choiceId], 0);
  const unlockedRewardIds = Array.isArray(record.unlockedRewardIds)
    ? record.unlockedRewardIds.filter((reward): reward is NpcAffinityRewardId => validRewards.has(reward as NpcAffinityRewardId))
    : [];
  return {
    interactionCount: Math.max(choiceIds.length, Number.isFinite(record.interactionCount) ? Math.max(0, Math.floor(record.interactionCount!)) : 0),
    affinityPoints,
    choiceIds,
    unlockedRewardIds,
    lastInteractedAt: typeof record.lastInteractedAt === "string" ? record.lastInteractedAt : null
  };
}

export function loadNpcDialogueMemory(
  storage: DialogueMemoryStorage | null = browserStorage()
): NpcDialogueMemory {
  try {
    const parsed = JSON.parse(storage?.getItem(npcDialogueMemoryStorageKey) ?? "null") as Partial<NpcDialogueMemory> | null;
    if (parsed?.version !== 1 || !parsed.records || typeof parsed.records !== "object") return emptyMemory();
    const records: NpcDialogueMemory["records"] = {};
    (["bride", "groom"] as const).forEach((npcId) => {
      const record = parseRecord(parsed.records?.[npcId]);
      if (record) records[npcId] = record;
    });
    return { version: 1, records, groupCelebrationSeen: parsed.groupCelebrationSeen === true };
  } catch {
    return emptyMemory();
  }
}

export function rememberNpcDialogueChoice(
  memory: NpcDialogueMemory,
  npcId: NpcId,
  choiceId: NpcDialogueChoiceId,
  storage: DialogueMemoryStorage | null = browserStorage(),
  interactedAt = new Date().toISOString()
): NpcDialogueMemory {
  const current = memory.records[npcId] ?? { interactionCount: 0, affinityPoints: 0, choiceIds: [], unlockedRewardIds: [], lastInteractedAt: null };
  const affinityPoints = current.affinityPoints + choiceAffinity[choiceId];
  const rewardId: NpcAffinityRewardId = npcId === "bride" ? "bride-gratitude-letter" : "groom-toast-message";
  const unlockedRewardIds = affinityPoints >= 6
    ? Array.from(new Set([...current.unlockedRewardIds, rewardId]))
    : current.unlockedRewardIds;
  const next: NpcDialogueMemory = {
    version: 1,
    groupCelebrationSeen: memory.groupCelebrationSeen,
    records: {
      ...memory.records,
      [npcId]: {
        interactionCount: current.interactionCount + 1,
        affinityPoints,
        choiceIds: [...current.choiceIds, choiceId].slice(-8),
        unlockedRewardIds,
        lastInteractedAt: interactedAt
      }
    }
  };
  try {
    storage?.setItem(npcDialogueMemoryStorageKey, JSON.stringify(next));
  } catch {
    // The current conversation still continues when private storage is unavailable.
  }
  return next;
}

export function npcGroupCelebrationReady(memory: NpcDialogueMemory): boolean {
  return (["bride", "groom"] as const).every((npcId) => npcConversationSnapshot(memory, npcId).affinityLevel === 3);
}

export function markNpcGroupCelebrationSeen(
  memory: NpcDialogueMemory,
  storage: DialogueMemoryStorage | null = browserStorage()
): NpcDialogueMemory {
  const next = { ...memory, groupCelebrationSeen: true };
  try {
    storage?.setItem(npcDialogueMemoryStorageKey, JSON.stringify(next));
  } catch {
    // The celebration remains visible for the current session.
  }
  return next;
}

export function npcConversationSnapshot(
  memory: NpcDialogueMemory,
  npcId: NpcId
): NpcConversationSnapshot {
  const record = memory.records[npcId];
  const interactionCount = record?.interactionCount ?? 0;
  const affinityPoints = record?.affinityPoints ?? 0;
  const affinityLevel: NpcConversationSnapshot["affinityLevel"] = affinityPoints >= 6 ? 3 : affinityPoints >= 3 ? 2 : affinityPoints > 0 ? 1 : 0;
  const rewardId = record?.unlockedRewardIds.at(-1);
  return {
    interactionCount,
    affinityPoints,
    affinityLevel,
    lastChoiceId: record?.choiceIds.at(-1) ?? null,
    relationshipLabel: affinityLevel >= 3 ? "소중한 인연" : affinityLevel > 0 ? "반가운 재회" : "첫 만남",
    specialRewardLabel: rewardId ? rewardLabels[rewardId] : null
  };
}
