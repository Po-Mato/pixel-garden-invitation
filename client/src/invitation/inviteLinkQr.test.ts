import { beforeEach, describe, expect, it, vi } from "vitest";
import QRCode from "qrcode";
import { buildInvitationInviteUrl, downloadInvitationInviteQr } from "./inviteLinkQr";

vi.mock("qrcode", () => ({ default: { toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,qr") } }));

describe("invite link QR", () => {
  beforeEach(() => vi.clearAllMocks());

  it("builds a deployment-base-aware personalized URL", () => {
    vi.stubEnv("BASE_URL", "/pixel-garden-invitation/");
    expect(buildInvitationInviteUrl("A".repeat(43))).toBe(
      `http://localhost:3000/pixel-garden-invitation/?invite=${"A".repeat(43)}`
    );
  });

  it("generates and downloads a local QR image", async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    await downloadInvitationInviteQr("https://example.test/?invite=token", "김 하객");
    expect(QRCode.toDataURL).toHaveBeenCalledWith("https://example.test/?invite=token", expect.objectContaining({ width: 1024 }));
    expect(click).toHaveBeenCalledOnce();
  });
});
