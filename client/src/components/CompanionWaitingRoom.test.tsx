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
      inviteCode="ABC234"
      connectedCount={3}
      onCopy={onCopy}
      onShare={vi.fn(async () => true)}
      onRenew={vi.fn()}
      onCancel={vi.fn()}
      onClose={vi.fn()}
    />);

    await waitFor(() => expect(screen.getByRole("img", { name: "동행 초대 QR 코드" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "링크 복사" }));
    await waitFor(() => expect(onCopy).toHaveBeenCalledOnce());
    expect(screen.getByRole("status")).toHaveTextContent("초대 링크를 복사했어요");
    expect(screen.getByLabelText("일회용 초대 코드 ABC234")).toBeInTheDocument();
    expect(screen.getByText("현재 같은 구역 3명 접속")).toBeInTheDocument();
  });

  it("offers renewal after expiration", () => {
    const onRenew = vi.fn();
    render(<CompanionWaitingRoom
      inviteUrl="https://example.com/expired"
      expiresAt={Date.now() - 1}
      zoneLabel="예식장 로비"
      nickname="정원하객"
      status="waiting"
      inviteCode="ABC234"
      connectedCount={1}
      onCopy={vi.fn(async () => true)}
      onShare={vi.fn(async () => true)}
      onRenew={onRenew}
      onCancel={vi.fn()}
      onClose={vi.fn()}
    />);
    fireEvent.click(screen.getByRole("button", { name: "새 초대 만들기" }));
    expect(onRenew).toHaveBeenCalledOnce();
  });

  it("cancels an active one-time invitation", () => {
    const onCancel = vi.fn();
    render(<CompanionWaitingRoom
      inviteUrl="https://example.com/active"
      expiresAt={Date.now() + 60_000}
      zoneLabel="예식장 로비"
      nickname="정원하객"
      status="waiting"
      inviteCode="ABC234"
      connectedCount={2}
      onCopy={vi.fn(async () => true)}
      onShare={vi.fn(async () => true)}
      onRenew={vi.fn()}
      onCancel={onCancel}
      onClose={vi.fn()}
    />);
    fireEvent.click(screen.getAllByRole("button", { name: "초대 취소" }).at(-1)!);
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("shows reconnect state, companion location, and arrival estimate", () => {
    render(<CompanionWaitingRoom
      inviteUrl="https://example.com/reconnect"
      expiresAt={Date.now() + 60_000}
      zoneLabel="예식장 로비"
      nickname="정원하객"
      status="connected"
      connectionState="reconnecting"
      companionNickname="친구하객"
      companionLocationLabel="예식장 로비 · 오른쪽 약 4칸"
      companionArrivalLabel="약 5초"
      inviteCode="ABC234"
      connectedCount={1}
      onCopy={vi.fn(async () => true)}
      onShare={vi.fn(async () => true)}
      onRenew={vi.fn()}
      onCancel={vi.fn()}
      onClose={vi.fn()}
    />);
    expect(screen.getByText("친구하객님이 다시 접속하고 있어요")).toBeInTheDocument();
    expect(screen.getByLabelText("동행 합류 정보")).toHaveTextContent("예식장 로비 · 오른쪽 약 4칸");
    expect(screen.getByLabelText("동행 합류 정보")).toHaveTextContent("약 5초");
  });
});
