import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { copyText } from "../invitation/browserActions";
import { DirectionsSheet } from "./DirectionsSheet";

vi.mock("../invitation/browserActions", () => ({ copyText: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("확정된 예식장, 교통, 주차, 지도, 전화 동작을 표시한다", () => {
  render(<DirectionsSheet onClose={vi.fn()} />);

  expect(screen.getByRole("dialog", { name: "오시는 길" })).toHaveTextContent(
    "MJ컨벤션 5층 파티오볼룸"
  );
  expect(screen.getByText("경기 부천시 소사구 경인로 386")).toBeInTheDocument();
  expect(screen.getByText("1호선·서해선 소사역 1번 출구에서 도보 약 3분")).toBeInTheDocument();
  expect(screen.getByText("주차 2시간 무료 · 약 500대 이상 주차 가능")).toBeInTheDocument();

  for (const name of ["네이버지도", "카카오맵", "Google 지도"]) {
    const link = screen.getByRole("link", { name: new RegExp(name) });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  }
  expect(screen.getByRole("link", { name: "032-347-5500 전화하기" })).toHaveAttribute(
    "href",
    "tel:0323475500"
  );
});

it("주소를 복사하고 성공 상태를 알린다", async () => {
  vi.mocked(copyText).mockResolvedValue(undefined);
  render(<DirectionsSheet onClose={vi.fn()} />);

  fireEvent.click(screen.getByRole("button", { name: "주소 복사" }));

  expect(copyText).toHaveBeenCalledWith("경기 부천시 소사구 경인로 386");
  expect(await screen.findByText("주소를 복사했습니다.")).toHaveAttribute("aria-live", "polite");
});

it("주소 복사 실패 후에도 주소를 표시하고 오류를 알린다", async () => {
  vi.mocked(copyText).mockRejectedValue(new Error("denied"));
  render(<DirectionsSheet onClose={vi.fn()} />);

  fireEvent.click(screen.getByRole("button", { name: "주소 복사" }));

  expect(
    await screen.findByText("복사하지 못했습니다. 주소를 길게 눌러 복사해주세요.")
  ).toHaveAttribute("aria-live", "polite");
  expect(screen.getByText("경기 부천시 소사구 경인로 386")).toBeInTheDocument();
});

it("주소 복사 중에는 중복 실행을 막는다", async () => {
  let resolveCopy: () => void;
  vi.mocked(copyText).mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        resolveCopy = resolve;
      })
  );
  render(<DirectionsSheet onClose={vi.fn()} />);

  const copyButton = screen.getByRole("button", { name: "주소 복사" });
  fireEvent.click(copyButton);
  fireEvent.click(copyButton);

  expect(copyText).toHaveBeenCalledTimes(1);
  expect(copyButton).toBeDisabled();

  resolveCopy!();
  await waitFor(() => expect(copyButton).not.toBeDisabled());
});
