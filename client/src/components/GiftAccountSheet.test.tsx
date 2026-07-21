import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { WeddingEvent } from "@wedding-game/shared";
import { afterEach, expect, it, vi } from "vitest";
import { copyText } from "../invitation/browserActions";
import { GiftAccountSheet } from "./GiftAccountSheet";

vi.mock("../invitation/browserActions", () => ({ copyText: vi.fn() }));

const populatedGiftAccounts: WeddingEvent["giftAccounts"] = {
  notice: "축하의 마음만으로도 충분히 감사드립니다.",
  accounts: [
    {
      id: "groom",
      side: "groom",
      relation: "신랑",
      name: "이승재",
      bank: "정원은행",
      accountNumber: "123-456-789",
      holder: "이승재",
      kakaoPayUrl: "https://pay.example.com/groom",
      tossUrl: "https://toss.example.com/groom"
    },
    {
      id: "groom-father",
      side: "groom",
      relation: "신랑 아버지",
      name: "",
      bank: "",
      accountNumber: "",
      holder: "",
      kakaoPayUrl: "javascript:alert(1)",
      tossUrl: ""
    },
    {
      id: "groom-mother",
      side: "groom",
      relation: "신랑 어머니",
      name: "",
      bank: "",
      accountNumber: "",
      holder: "",
      kakaoPayUrl: "",
      tossUrl: ""
    },
    {
      id: "bride",
      side: "bride",
      relation: "신부",
      name: "이건희",
      bank: "햇살은행",
      accountNumber: "987-654-321",
      holder: "이건희",
      kakaoPayUrl: "",
      tossUrl: ""
    },
    {
      id: "bride-father",
      side: "bride",
      relation: "신부 아버지",
      name: "",
      bank: "",
      accountNumber: "",
      holder: "",
      kakaoPayUrl: "",
      tossUrl: ""
    },
    {
      id: "bride-mother",
      side: "bride",
      relation: "신부 어머니",
      name: "",
      bank: "",
      accountNumber: "",
      holder: "",
      kakaoPayUrl: "",
      tossUrl: ""
    }
  ]
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("미입력 상태에서는 신부·신랑 양쪽의 준비 안내만 표시한다", () => {
  render(<GiftAccountSheet onClose={vi.fn()} />);

  expect(screen.getByRole("tab", { name: "신부 측" })).toHaveAttribute("aria-selected", "true");
  expect(screen.getByRole("dialog", { name: "마음 전하실 곳" }).querySelector("[data-nosnippet]"))
    .toBeInTheDocument();
  expect(screen.getByText("신부 측 계좌 정보 준비 중")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab", { name: "신랑 측" }));
  expect(screen.getByText("신랑 측 계좌 정보 준비 중")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /계좌번호 복사/ })).not.toBeInTheDocument();
});

it("완성된 계좌만 기본 접힘 항목으로 표시하고 안전한 간편송금 링크를 제공한다", () => {
  render(<GiftAccountSheet onClose={vi.fn()} giftAccounts={populatedGiftAccounts} />);

  expect(screen.getByText("신부 이건희")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab", { name: "신랑 측" }));
  const account = screen.getByText("신랑 이승재").closest("details");
  expect(account).not.toHaveAttribute("open");
  expect(screen.queryByText("신랑 아버지")).not.toBeInTheDocument();

  fireEvent.click(within(account as HTMLElement).getByText("신랑 이승재"));
  expect(screen.getByText("정원은행 · 예금주 이승재")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /카카오페이/ })).toHaveAttribute(
    "href",
    "https://pay.example.com/groom"
  );
  expect(screen.getByRole("link", { name: /토스/ })).toHaveAttribute("rel", "noopener noreferrer");
});

it("계좌번호를 복사하고 실패 시에도 직접 복사할 수 있게 번호를 유지한다", async () => {
  vi.mocked(copyText).mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("denied"));
  render(<GiftAccountSheet onClose={vi.fn()} giftAccounts={populatedGiftAccounts} />);

  fireEvent.click(screen.getByRole("tab", { name: "신랑 측" }));
  fireEvent.click(screen.getByText("신랑 이승재"));
  const copyButton = screen.getByRole("button", { name: "신랑 이승재 계좌번호 복사" });
  fireEvent.click(copyButton);
  expect(copyText).toHaveBeenCalledWith("123-456-789");
  expect(await screen.findByText("계좌번호를 복사했습니다.")).toHaveAttribute("aria-live", "polite");

  fireEvent.click(copyButton);
  expect(await screen.findByText("복사하지 못했습니다. 계좌번호를 길게 눌러 복사해주세요.")).toBeInTheDocument();
  await waitFor(() => expect(screen.getByText("123-456-789")).toBeInTheDocument());
});
