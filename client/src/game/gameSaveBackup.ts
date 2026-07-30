export type GameSaveBackup = {
  schema: "wedding-game-save";
  version: 1;
  createdAt: string;
  entries: Record<string, string>;
};

export type GameSaveRollback = {
  schema: "wedding-game-restore-rollback";
  version: 1;
  createdAt: string;
  entries: Record<string, string | null>;
};

export type GameSaveBackupPreview = {
  createdAt: string;
  totalEntries: number;
  newEntries: number;
  overwrittenEntries: number;
  changedEntries: number;
  unchangedEntries: number;
  categories: { id: string; label: string; count: number }[];
  changes: Array<{
    key: string;
    label: string;
    categoryId: string;
    categoryLabel: string;
    status: "new" | "changed" | "unchanged";
    before: string;
    after: string;
  }>;
};

type GameSaveStorage = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;

const exactKeys = new Set([
  "wedding-game-feedback:v1",
  "wedding-game:device-qa:v1",
  "wedding-game-quick-dock:v1",
  "wedding-view-preferences:v1",
  "wedding-map-effects-quality:v1",
  "wedding-world-secrets:v1",
  "wedding-world-travel-history:v1"
]);

const gameKeyPrefixes = [
  "wedding-game:celebration-",
  "wedding-game:destination-",
  "wedding-game:entry-session:",
  "wedding-game:first-visit-guide:",
  "wedding-game:memory-",
  "wedding-game:npc-dialogue-memory:",
  "wedding-game:photo-",
  "wedding-game:journey-progress:",
  "wedding-game:journey-visits:",
  "wedding-game:view-sync:",
  "wedding-game:world-session:",
  "wedding-game:zone-mini-quest:"
] as const;

const maximumBackupBytes = 20 * 1024 * 1024;

const backupCategories = [
  { id: "journey", label: "여정·방문", matches: (key: string) => /journey|destination|world-session|travel-history|first-visit|zone-mini-quest/.test(key) },
  { id: "photo", label: "사진·추억", matches: (key: string) => /:photo-|:memory-/.test(key) },
  { id: "collection", label: "수집·보상", matches: (key: string) => /secrets|celebration/.test(key) },
  { id: "relationship", label: "인연 기록", matches: (key: string) => key.includes("npc-dialogue-memory") },
  { id: "settings", label: "게임 설정", matches: () => true }
] as const;

function backupEntryLabel(key: string) {
  if (key.includes("journey-progress")) return "여정 진행";
  if (key.includes("journey-visits")) return "장소 방문 기록";
  if (key.includes("travel-history")) return "이동 여정";
  if (key.includes("destination")) return "목적지 안내";
  if (key.includes("world-session")) return "현재 맵 위치";
  if (key.includes("first-visit-guide")) return "첫 방문 안내";
  if (key.includes("zone-mini-quest")) return "맵별 미니 퀘스트";
  if (key.includes("world-secrets")) return "숨은 추억";
  if (key.includes("celebration")) return "완주 보상";
  if (key.includes("npc-dialogue-memory")) return "두 사람과의 인연";
  if (key.includes(":photo-")) return "웨딩 사진";
  if (key.includes(":memory-")) return "추억 카드 설정";
  if (key.includes("device-qa")) return "기기 점검 설정";
  if (key.includes("quick-dock")) return "빠른 메뉴 설정";
  if (key.includes("view-preferences") || key.includes("effects-quality")) return "화면 설정";
  return "게임 설정";
}

function storedValueSummary(value: string | null) {
  if (value === null) return "저장 없음";
  try {
    const parsed = JSON.parse(value) as unknown;
    if (typeof parsed === "boolean") return parsed ? "사용" : "사용 안 함";
    if (typeof parsed === "number") return `${parsed}`;
    if (Array.isArray(parsed)) return `${parsed.length}개 기록`;
    if (typeof parsed === "object" && parsed !== null) {
      const record = parsed as Record<string, unknown>;
      const counters: Array<[string, string]> = [
        ["completedIds", "곳 완료"],
        ["discoveredIds", "개 발견"],
        ["photos", "장 촬영"],
        ["visits", "곳 방문"],
        ["entries", "개 기록"]
      ];
      const counter = counters.find(([key]) => Array.isArray(record[key]));
      if (counter) return `${(record[counter[0]] as unknown[]).length}${counter[1]}`;
      if (record.records && typeof record.records === "object") {
        return `${Object.keys(record.records as object).length}명 인연 기록`;
      }
      return `${Object.keys(record).length}개 설정`;
    }
  } catch {
    // Non-JSON settings are summarized without exposing their raw value.
  }
  return `${new Blob([value]).size}B 데이터`;
}

export function isGameSaveStorageKey(key: string): boolean {
  return exactKeys.has(key) || gameKeyPrefixes.some((prefix) => key.startsWith(prefix));
}

export function createGameSaveBackup(
  storage: GameSaveStorage,
  createdAt = new Date().toISOString()
): GameSaveBackup {
  const entries: Record<string, string> = {};
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key || !isGameSaveStorageKey(key)) continue;
    const value = storage.getItem(key);
    if (value !== null) entries[key] = value;
  }
  return { schema: "wedding-game-save", version: 1, createdAt, entries };
}

export function parseGameSaveBackup(source: string): GameSaveBackup {
  if (new Blob([source]).size > maximumBackupBytes) throw new Error("백업 파일이 너무 큽니다.");
  const value = JSON.parse(source) as Partial<GameSaveBackup> | null;
  if (value?.schema !== "wedding-game-save" || value.version !== 1 || typeof value.createdAt !== "string" || !value.entries || typeof value.entries !== "object") {
    throw new Error("지원하지 않는 게임 백업 파일입니다.");
  }
  const entries: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value.entries)) {
    if (!isGameSaveStorageKey(key) || typeof entry !== "string") throw new Error("허용되지 않은 저장 항목이 포함되어 있습니다.");
    entries[key] = entry;
  }
  return { schema: "wedding-game-save", version: 1, createdAt: value.createdAt, entries };
}

export function restoreGameSaveBackup(backup: GameSaveBackup, storage: GameSaveStorage): number {
  const previous = new Map<string, string | null>();
  const keys = Object.keys(backup.entries);
  try {
    keys.forEach((key) => {
      if (!isGameSaveStorageKey(key)) throw new Error("허용되지 않은 저장 항목입니다.");
      previous.set(key, storage.getItem(key));
      storage.setItem(key, backup.entries[key]);
    });
  } catch (error) {
    previous.forEach((value, key) => {
      try {
        if (value === null) storage.removeItem(key);
        else storage.setItem(key, value);
      } catch {
        // Preserve the original restore error.
      }
    });
    throw error;
  }
  return keys.length;
}

export function summarizeGameSaveBackup(backup: GameSaveBackup, storage: Pick<Storage, "getItem">): GameSaveBackupPreview {
  const categoryCounts = new Map<string, number>();
  let newEntries = 0;
  let overwrittenEntries = 0;
  let changedEntries = 0;
  let unchangedEntries = 0;
  const changes = Object.keys(backup.entries).map((key) => {
    const previous = storage.getItem(key);
    const incoming = backup.entries[key];
    const status: GameSaveBackupPreview["changes"][number]["status"] = previous === null ? "new" : previous === incoming ? "unchanged" : "changed";
    if (status === "new") newEntries += 1;
    else overwrittenEntries += 1;
    if (status === "changed") changedEntries += 1;
    if (status === "unchanged") unchangedEntries += 1;
    const category = backupCategories.find((candidate) => candidate.matches(key))!;
    categoryCounts.set(category.id, (categoryCounts.get(category.id) ?? 0) + 1);
    return {
      key,
      label: backupEntryLabel(key),
      categoryId: category.id,
      categoryLabel: category.label,
      status,
      before: storedValueSummary(previous),
      after: storedValueSummary(incoming)
    };
  });
  return {
    createdAt: backup.createdAt,
    totalEntries: Object.keys(backup.entries).length,
    newEntries,
    overwrittenEntries,
    changedEntries,
    unchangedEntries,
    categories: backupCategories.flatMap((category) => {
      const count = categoryCounts.get(category.id) ?? 0;
      return count > 0 ? [{ id: category.id, label: category.label, count }] : [];
    }),
    changes
  };
}

export function createGameSaveRollback(
  backup: GameSaveBackup,
  storage: Pick<Storage, "getItem">,
  createdAt = new Date().toISOString()
): GameSaveRollback {
  return {
    schema: "wedding-game-restore-rollback",
    version: 1,
    createdAt,
    entries: Object.fromEntries(Object.keys(backup.entries).map((key) => [key, storage.getItem(key)]))
  };
}

export function parseGameSaveRollback(source: string): GameSaveRollback {
  const value = JSON.parse(source) as Partial<GameSaveRollback> | null;
  if (value?.schema !== "wedding-game-restore-rollback" || value.version !== 1 || typeof value.createdAt !== "string" || !value.entries || typeof value.entries !== "object") {
    throw new Error("지원하지 않는 복원 되돌리기 기록입니다.");
  }
  const entries: Record<string, string | null> = {};
  Object.entries(value.entries).forEach(([key, entry]) => {
    if (!isGameSaveStorageKey(key) || (entry !== null && typeof entry !== "string")) throw new Error("허용되지 않은 되돌리기 항목입니다.");
    entries[key] = entry;
  });
  return { schema: "wedding-game-restore-rollback", version: 1, createdAt: value.createdAt, entries };
}

export function restoreGameSaveRollback(rollback: GameSaveRollback, storage: GameSaveStorage): number {
  const previous = new Map<string, string | null>();
  try {
    Object.entries(rollback.entries).forEach(([key, value]) => {
      if (!isGameSaveStorageKey(key)) throw new Error("허용되지 않은 되돌리기 항목입니다.");
      previous.set(key, storage.getItem(key));
      if (value === null) storage.removeItem(key);
      else storage.setItem(key, value);
    });
  } catch (error) {
    previous.forEach((value, key) => {
      try {
        if (value === null) storage.removeItem(key);
        else storage.setItem(key, value);
      } catch {
        // Preserve the original rollback error.
      }
    });
    throw error;
  }
  return Object.keys(rollback.entries).length;
}

export function gameSaveBackupFilename(createdAt = new Date()): string {
  const date = createdAt.toISOString().slice(0, 10);
  return `wedding-game-save-${date}.json`;
}

export function downloadGameSaveBackup(backup: GameSaveBackup) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = gameSaveBackupFilename(new Date(backup.createdAt));
  anchor.hidden = true;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
