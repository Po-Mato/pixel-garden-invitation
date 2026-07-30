import type { NpcDialogueChoiceId, NpcId } from "./npcDialogue";

export type NpcConversationRecord = {
  interactionCount: number;
  choiceIds: NpcDialogueChoiceId[];
  lastInteractedAt: string | null;
};

export type NpcDialogueMemory = {
  version: 1;
  records: Partial<Record<NpcId, NpcConversationRecord>>;
};

export type NpcConversationSnapshot = {
  interactionCount: number;
  lastChoiceId: NpcDialogueChoiceId | null;
  relationshipLabel: "첫 만남" | "반가운 재회" | "소중한 인연";
};

type DialogueMemoryStorage = Pick<Storage, "getItem" | "setItem">;

export const npcDialogueMemoryStorageKey = "wedding-game:npc-dialogue-memory:v1";

const validChoices = new Set<NpcDialogueChoiceId>(["greet", "heart", "celebrate"]);

function browserStorage(): DialogueMemoryStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function emptyMemory(): NpcDialogueMemory {
  return { version: 1, records: {} };
}

function parseRecord(value: unknown): NpcConversationRecord | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<NpcConversationRecord>;
  const choiceIds = Array.isArray(record.choiceIds)
    ? record.choiceIds.filter((choice): choice is NpcDialogueChoiceId => validChoices.has(choice as NpcDialogueChoiceId)).slice(-8)
    : [];
  return {
    interactionCount: Math.max(choiceIds.length, Number.isFinite(record.interactionCount) ? Math.max(0, Math.floor(record.interactionCount!)) : 0),
    choiceIds,
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
    return { version: 1, records };
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
  const current = memory.records[npcId] ?? { interactionCount: 0, choiceIds: [], lastInteractedAt: null };
  const next: NpcDialogueMemory = {
    version: 1,
    records: {
      ...memory.records,
      [npcId]: {
        interactionCount: current.interactionCount + 1,
        choiceIds: [...current.choiceIds, choiceId].slice(-8),
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

export function npcConversationSnapshot(
  memory: NpcDialogueMemory,
  npcId: NpcId
): NpcConversationSnapshot {
  const record = memory.records[npcId];
  const interactionCount = record?.interactionCount ?? 0;
  return {
    interactionCount,
    lastChoiceId: record?.choiceIds.at(-1) ?? null,
    relationshipLabel: interactionCount >= 3 ? "소중한 인연" : interactionCount > 0 ? "반가운 재회" : "첫 만남"
  };
}
