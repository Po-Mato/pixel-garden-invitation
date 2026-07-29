import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CompanionDock } from "./CompanionDock";

const companion = {
  guestId: "guest-two",
  nickname: "하객2",
  distance: 30,
  x: 120,
  y: 180,
  zoneId: "home" as const,
  direction: "down" as const,
  moving: false,
  seq: 1,
  lastSeenAt: 1,
  appearance: {
    family: "generated" as const,
    presetId: "guest-02"
  }
};

afterEach(cleanup);

describe("CompanionDock", () => {
  it("sends quick pings and exposes destination requests for a follower", () => {
    const onPing = vi.fn();
    const onRequestDestination = vi.fn();
    render(
      <CompanionDock
        candidates={[companion]}
        activeGuestId={companion.guestId}
        role="follower"
        onInvite={vi.fn()}
        onStop={vi.fn()}
        onPing={onPing}
        onRequestDestination={onRequestDestination}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "여기예요" }));
    fireEvent.click(screen.getByRole("button", { name: "동행 목적지 변경 요청" }));
    expect(onPing).toHaveBeenCalledWith("here");
    expect(onRequestDestination).toHaveBeenCalledOnce();
  });

  it("shows a rejoin action and received ping without relying on color", () => {
    const onRejoin = vi.fn();
    render(
      <CompanionDock
        candidates={[{ ...companion, zoneId: "lobby" }]}
        activeGuestId={companion.guestId}
        role="leader"
        onInvite={vi.fn()}
        onStop={vi.fn()}
        recentPing={{ ping: "wait", nickname: "하객2" }}
        rejoinZoneId="lobby"
        rejoinZoneLabel="예식장 로비"
        onRejoin={onRejoin}
      />
    );

    expect(screen.getByRole("status")).toHaveTextContent("하객2님 · 잠시만요");
    fireEvent.click(screen.getByRole("button", { name: "예식장 로비로 재합류" }));
    expect(onRejoin).toHaveBeenCalledOnce();
  });

  it("reserves and cancels a same-zone rendezvous", () => {
    const onReserve = vi.fn();
    const onCancel = vi.fn();
    const { rerender } = render(
      <CompanionDock
        candidates={[companion]}
        activeGuestId={companion.guestId}
        role="leader"
        onInvite={vi.fn()}
        onStop={vi.fn()}
        onReserveRendezvous={onReserve}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "중간 타일에서 만나기" }));
    expect(onReserve).toHaveBeenCalledOnce();

    rerender(
      <CompanionDock
        candidates={[companion]}
        activeGuestId={companion.guestId}
        role="leader"
        onInvite={vi.fn()}
        onStop={vi.fn()}
        rendezvousLabel="우리 집 · 중간 합류 타일 예약"
        onReserveRendezvous={onReserve}
        onCancelRendezvous={onCancel}
      />
    );
    expect(screen.getByRole("status")).toHaveTextContent("중간 합류 타일 예약");
    fireEvent.click(screen.getByRole("button", { name: "합류 예약 취소" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
