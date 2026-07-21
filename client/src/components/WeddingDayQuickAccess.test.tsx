import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { invitationContent, type WeddingEvent } from "@wedding-game/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WeddingDayQuickAccess } from "./WeddingDayQuickAccess";

afterEach(cleanup);

describe("WeddingDayQuickAccess", () => {
  it("예식 당일이 아니면 퀵 버튼을 숨긴다", () => {
    render(
      <WeddingDayQuickAccess
        variant="summary"
        now={new Date("2027-04-30T12:00:00.000Z")}
      />
    );

    expect(screen.queryByRole("button", { name: /예식 당일 안내/ })).not.toBeInTheDocument();
  });

  it("미리보기에서 당일 안내와 실사용 이동 정보를 연다", () => {
    render(<WeddingDayQuickAccess variant="summary" preview />);

    fireEvent.click(screen.getByRole("button", { name: "예식 당일 안내: 예식까지 45분" }));

    const dialog = screen.getByRole("dialog", { name: "예식 당일 안내" });
    expect(dialog).toHaveTextContent("당일 모드 미리보기");
    expect(dialog).toHaveTextContent("예식까지 45분");
    expect(dialog).toHaveTextContent("오후 5시 10분 - 오후 6시 40분");
    expect(dialog).toHaveTextContent("소사역 1번 출구");
    expect(dialog).toHaveTextContent("주차 2시간 무료");
    expect(within(dialog).getByRole("link", { name: "네이버지도" })).toHaveAttribute("target", "_blank");
    expect(within(dialog).getByRole("link", { name: "카카오맵" })).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: "Google 지도" })).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: "MJ컨벤션에 전화하기" }))
      .toHaveAttribute("href", "tel:0323475500");
  });

  it("실제 연락처가 있을 때 혼주 연락처 화면으로 연결한다", () => {
    const onFamilyContactOpen = vi.fn();
    const event: WeddingEvent = {
      ...invitationContent.event,
      familyContacts: {
        ...invitationContent.event.familyContacts,
        contacts: invitationContent.event.familyContacts.contacts.map((contact) => (
          contact.id === "groom" ? { ...contact, phone: "010-1234-5678" } : contact
        ))
      }
    };
    render(
      <WeddingDayQuickAccess
        variant="world"
        preview
        event={event}
        onFamilyContactOpen={onFamilyContactOpen}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /예식 당일 안내/ }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "예식 당일 안내" }))
      .getByRole("button", { name: "혼주 연락처" }));

    expect(onFamilyContactOpen).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog", { name: "예식 당일 안내" })).not.toBeInTheDocument();
  });
});
