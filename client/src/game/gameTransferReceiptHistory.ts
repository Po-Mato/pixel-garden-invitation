import type { CreatedGameTransfer, GameTransferProgressPhase, GameTransferState, GameTransferStatus } from "../api/gameTransferApi";

export const gameTransferReceiptHistoryStorageKey = "wedding-game:transfer-receipts:v1";

export type GameTransferReceipt = {
  id: string;
  manageToken: string;
  entryCount: number;
  createdAt: string;
  expiresAt: string;
  status: GameTransferStatus;
  claimedAt: string | null;
  revokedAt: string | null;
  receiverPhase?: GameTransferProgressPhase | null;
  receiverSeenAt?: string | null;
  updatedAt?: string;
};

type StorageReader = Pick<Storage, "getItem">;
type StorageWriter = Pick<Storage, "setItem">;

function valid(value: unknown): value is GameTransferReceipt {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<GameTransferReceipt>;
  return typeof item.id === "string"
    && /^transfer_[0-9a-f-]+$/.test(item.id)
    && typeof item.manageToken === "string"
    && /^[A-Za-z0-9_-]{32,64}$/.test(item.manageToken)
    && Number.isInteger(item.entryCount)
    && typeof item.createdAt === "string"
    && typeof item.expiresAt === "string"
    && ["active", "claimed", "revoked", "expired"].includes(item.status ?? "");
}

export function loadGameTransferReceiptHistory(storage: StorageReader = localStorage): GameTransferReceipt[] {
  try {
    const value = JSON.parse(storage.getItem(gameTransferReceiptHistoryStorageKey) ?? "[]") as unknown;
    return Array.isArray(value) ? value.filter(valid).slice(0, 8) : [];
  } catch {
    return [];
  }
}

export function saveGameTransferReceiptHistory(receipts: readonly GameTransferReceipt[], storage: StorageWriter = localStorage) {
  storage.setItem(gameTransferReceiptHistoryStorageKey, JSON.stringify(receipts.filter(valid).slice(0, 8)));
}

export function rememberCreatedGameTransfer(created: CreatedGameTransfer, storage: StorageReader & StorageWriter = localStorage) {
  const receipt: GameTransferReceipt = {
    id: created.id,
    manageToken: created.manageToken,
    entryCount: created.entryCount,
    createdAt: created.createdAt,
    expiresAt: created.expiresAt,
    status: created.status,
    claimedAt: created.claimedAt,
    revokedAt: created.revokedAt,
    receiverPhase: created.receiverPhase,
    receiverSeenAt: created.receiverSeenAt,
    updatedAt: created.updatedAt
  };
  const next = [receipt, ...loadGameTransferReceiptHistory(storage).filter(({ id }) => id !== receipt.id)].slice(0, 8);
  saveGameTransferReceiptHistory(next, storage);
  return next;
}

export function updateGameTransferReceiptState(
  receipts: readonly GameTransferReceipt[],
  state: GameTransferState,
  storage: StorageWriter = localStorage
) {
  const next = receipts.map((receipt) => receipt.id === state.id ? {
    ...receipt,
    status: state.status,
    claimedAt: state.claimedAt,
    revokedAt: state.revokedAt,
    receiverPhase: state.receiverPhase,
    receiverSeenAt: state.receiverSeenAt,
    updatedAt: state.updatedAt
  } : receipt);
  saveGameTransferReceiptHistory(next, storage);
  return next;
}
