import { afterEach, describe, expect, it, vi } from "vitest";
import { claimServerGameTransfer, createServerGameTransfer, reportServerGameTransferProgress, revokeServerGameTransfer } from "./gameTransferApi";

describe("gameTransferApi", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("서버 발급, 일회성 수신, 발신 취소 요청을 구분한다", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "transfer_test", status: "active" }), {
      status: 200,
      headers: { "content-type": "application/json" }
    }));
    vi.stubGlobal("fetch", fetchMock);
    await createServerGameTransfer(5, "2026-07-30T10:15:00.000Z");
    await claimServerGameTransfer("transfer_test", "c".repeat(43));
    await reportServerGameTransferProgress("transfer_test", "c".repeat(43), "previewing");
    await revokeServerGameTransfer("transfer_test", "m".repeat(43));
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "POST" });
    expect(fetchMock.mock.calls[1][0]).toContain("/transfer_test/claim");
    expect(fetchMock.mock.calls[1][1].headers).toEqual({ authorization: `Bearer ${"c".repeat(43)}` });
    expect(fetchMock.mock.calls[2][0]).toContain("/transfer_test/progress");
    expect(fetchMock.mock.calls[2][1]).toMatchObject({ method: "POST", body: JSON.stringify({ phase: "previewing" }) });
    expect(fetchMock.mock.calls[3][1]).toMatchObject({ method: "DELETE" });
  });
});
