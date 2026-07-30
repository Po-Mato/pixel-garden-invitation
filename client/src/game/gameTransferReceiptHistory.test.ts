import { describe, expect, it } from "vitest";
import {
  loadGameTransferReceiptHistory,
  rememberCreatedGameTransfer,
  updateGameTransferReceiptState
} from "./gameTransferReceiptHistory";

function storage() {
  let value = "";
  return {
    getItem: () => value || null,
    setItem: (_key: string, next: string) => { value = next; }
  };
}

describe("gameTransferReceiptHistory", () => {
  it("발신 관리 토큰을 보관하고 서버 복원 상태로 갱신한다", () => {
    const store = storage();
    const created = {
      id: "transfer_123e4567-e89b-12d3-a456-426614174000",
      claimToken: "c".repeat(43),
      manageToken: "m".repeat(43),
      entryCount: 5,
      status: "active" as const,
      createdAt: "2026-07-30T10:00:00.000Z",
      expiresAt: "2026-07-30T10:15:00.000Z",
      claimedAt: null,
      revokedAt: null,
      receiverPhase: null,
      receiverSeenAt: null,
      updatedAt: "2026-07-30T10:00:00.000Z"
    };
    const receipts = rememberCreatedGameTransfer(created, store);
    expect(loadGameTransferReceiptHistory(store)).toEqual(receipts);
    const updated = updateGameTransferReceiptState(receipts, {
      ...created,
      status: "claimed",
      claimedAt: "2026-07-30T10:03:00.000Z"
    }, store);
    expect(updated[0]).toMatchObject({ status: "claimed", claimedAt: "2026-07-30T10:03:00.000Z" });
  });
});
