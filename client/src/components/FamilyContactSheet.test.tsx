import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { WeddingEvent } from "@wedding-game/shared";
import { afterEach, expect, it, vi } from "vitest";
import { FamilyContactSheet } from "./FamilyContactSheet";

const populatedContacts: WeddingEvent["familyContacts"] = {
  notice: "축하와 문의 연락은 편하신 쪽으로 전해주세요.",
  contacts: [
    { id: "groom", side: "groom", relation: "신랑", name: "이승재", phone: "010-1234-5678" },
    { id: "groom-father", side: "groom", relation: "신랑 아버지", name: "이정원", phone: "032-123-4567" },
    { id: "groom-mother", side: "groom", relation: "신랑 어머니", name: "", phone: "1234" },
    { id: "bride", side: "bride", relation: "신부", name: "이건희", phone: "010-9876-5432" },
    { id: "bride-father", side: "bride", relation: "신부 아버지", name: "", phone: "" },
    { id: "bride-mother", side: "bride", relation: "신부 어머니", name: "", phone: "" }
  ]
};

afterEach(cleanup);

it("미입력 상태에서는 양가 연락처 준비 안내만 표시한다", () => {
  render(<FamilyContactSheet onClose={vi.fn()} />);

  expect(screen.getByRole("tab", { name: "신랑 측" })).toHaveAttribute("aria-selected", "true");
  expect(screen.getByText("신랑 측 연락처 준비 중")).toBeInTheDocument();
  expect(screen.getByRole("dialog", { name: "혼주 연락처" }).querySelector("[data-nosnippet]"))
    .toBeInTheDocument();

  fireEvent.click(screen.getByRole("tab", { name: "신부 측" }));
  expect(screen.getByText("신부 측 연락처 준비 중")).toBeInTheDocument();
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
});

it("유효한 연락처만 표시하고 휴대전화에 전화·문자 동작을 제공한다", () => {
  render(<FamilyContactSheet onClose={vi.fn()} familyContacts={populatedContacts} />);

  expect(screen.getByText("신랑 이승재")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "신랑 이승재에게 전화하기" })).toHaveAttribute(
    "href",
    "tel:01012345678"
  );
  expect(screen.getByRole("link", { name: "신랑 이승재에게 문자 보내기" })).toHaveAttribute(
    "href",
    "sms:01012345678"
  );
  expect(screen.getByRole("link", { name: "신랑 아버지 이정원에게 전화하기" })).toHaveAttribute(
    "href",
    "tel:0321234567"
  );
  expect(screen.queryByRole("link", { name: "신랑 아버지 이정원에게 문자 보내기" })).not.toBeInTheDocument();
  expect(screen.queryByText("신랑 어머니")).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("tab", { name: "신부 측" }));
  expect(screen.getByText("신부 이건희")).toBeInTheDocument();
});
