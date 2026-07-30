import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "./index";

const repository = vi.hoisted(() => ({
  claimGameTransfer: vi.fn(),
  createGameTransfer: vi.fn(),
  loadGameTransfer: vi.fn(),
  reportGameTransferProgress: vi.fn(),
  revokeGameTransfer: vi.fn()
}));
const security = vi.hoisted(() => ({ hashClientKey: vi.fn() }));

vi.mock("./gameTransferRepository", () => repository);
vi.mock("./security", () => security);

import { handleGameTransferRequest } from "./gameTransferHttp";

const activeState = {
  id: "transfer_live",
  status: "active" as const,
  entryCount: 4,
  createdAt: "2026-07-31T01:00:00.000Z",
  expiresAt: "2026-07-31T01:15:00.000Z",
  claimedAt: null,
  revokedAt: null,
  receiverPhase: "previewing" as const,
  receiverSeenAt: "2026-07-31T01:02:00.000Z",
  updatedAt: "2026-07-31T01:03:00.000Z"
};

function env(): Env {
  return {
    DB: {} as D1Database,
    GARDEN_ROOM: {} as DurableObjectNamespace,
    RSVP_ADMIN_PASSWORD_HASH: "hash",
    RSVP_ADMIN_SESSION_SECRET: "session-secret",
    RSVP_CLIENT_KEY_SECRET: "client-secret",
    RSVP_ALLOWED_ORIGINS: "https://po-mato.github.io"
  };
}

describe("game transfer HTTP live progress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    security.hashClientKey.mockResolvedValue("client-hash");
    repository.reportGameTransferProgress.mockResolvedValue({ state: activeState, changed: true });
  });

  it("받는 기기의 진행 단계를 claim 토큰으로 보고한다", async () => {
    const token = "c".repeat(43);
    const response = await handleGameTransferRequest(
      new Request("https://worker.test/api/invitations/sample-garden/game-transfers/transfer_live/progress", {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ phase: "previewing" })
      }),
      env(),
      "127.0.0.1",
      "sample-garden",
      "transfer_live",
      "progress"
    );
    expect(response.status).toBe(200);
    expect(repository.reportGameTransferProgress).toHaveBeenCalledWith(expect.anything(), "sample-garden", "transfer_live", token, "previewing");
    await expect(response.json()).resolves.toEqual(activeState);
  });

  it("알 수 없는 진행 단계는 저장하지 않는다", async () => {
    const response = await handleGameTransferRequest(
      new Request("https://worker.test/api/invitations/sample-garden/game-transfers/transfer_live/progress", {
        method: "POST",
        headers: { authorization: `Bearer ${"c".repeat(43)}`, "content-type": "application/json" },
        body: JSON.stringify({ phase: "finished" })
      }),
      env(),
      "127.0.0.1",
      "sample-garden",
      "transfer_live",
      "progress"
    );
    expect(response.status).toBe(400);
    expect(repository.reportGameTransferProgress).not.toHaveBeenCalled();
  });

  it("이미 종료된 이전의 진행 보고는 충돌 상태를 반환한다", async () => {
    repository.reportGameTransferProgress.mockResolvedValue({ state: { ...activeState, status: "claimed" }, changed: false });
    const response = await handleGameTransferRequest(
      new Request("https://worker.test/api/invitations/sample-garden/game-transfers/transfer_live/progress", {
        method: "POST",
        headers: { authorization: `Bearer ${"c".repeat(43)}`, "content-type": "application/json" },
        body: JSON.stringify({ phase: "restoring" })
      }),
      env(),
      "127.0.0.1",
      "sample-garden",
      "transfer_live",
      "progress"
    );
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "transfer_claimed" });
  });
});
