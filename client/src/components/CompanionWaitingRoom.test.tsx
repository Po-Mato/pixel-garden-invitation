import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CompanionWaitingRoom } from "./CompanionWaitingRoom";

vi.mock("qrcode", () => ({
  default: { toDataURL: vi.fn(async () => "data:image/png;base64,qr") }
}));

describe("CompanionWaitingRoom", () => {
  it("shows a timed QR invitation and supports copying", async () => {
    const onCopy = vi.fn(async () => true);
    render(<CompanionWaitingRoom
      inviteUrl="https://example.com/?together=guest"
      expiresAt={Date.now() + 600_000}
      zoneLabel="예식장 로비"
      nickname="정원하객"
      status="waiting"
      onCopy={onCopy}
      onShare={vi.fn(async () => true)}
      onRenew={vi.fn()}
      onClose={vi.fn()}
    />);

    await waitFor(() => expect(screen.getByRole("img", { name: "동행 초대 QR 코드" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "링크 복사" }));
    await waitFor(() => expect(onCopy).toHaveBeenCalledOnce());
    expect(screen.getByRole("status")).toHaveTextContent("초대 링크를 복사했어요");
  });

  it("offers renewal after expiration", () => {
    const onRenew = vi.fn();
    render(<CompanionWaitingRoom
      inviteUrl="https://example.com/expired"
      expiresAt={Date.now() - 1}
      zoneLabel="예식장 로비"
      nickname="정원하객"
      status="waiting"
      onCopy={vi.fn(async () => true)}
      onShare={vi.fn(async () => true)}
      onRenew={onRenew}
      onClose={vi.fn()}
    />);
    fireEvent.click(screen.getByRole("button", { name: "새 초대 만들기" }));
    expect(onRenew).toHaveBeenCalledOnce();
  });
});
