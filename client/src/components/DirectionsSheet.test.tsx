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

  const dialog = screen.getByRole("dialog", { name: "오시는 길" });
  expect(dialog).toHaveClass("invitation-detail-sheet--directions");
  expect(dialog).toHaveAccessibleDescription("지도 앱과 이동 방법을 한곳에서 확인하세요.");
  expect(dialog).toHaveTextContent(
    "MJ컨벤션 5층 파티오볼룸"
  );
  expect(screen.getByText("경기 부천시 소사구 경인로 386")).toBeInTheDocument();
  expect(screen.getByText("1호선·서해선 소사역 1번 출구에서 도보 약 3분")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "지도 앱으로 길 찾기" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "교통 안내" })).toBeInTheDocument();
  expect(screen.getByText("ARRIVAL GUIDE")).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: /대중교통/ })).toHaveAttribute("aria-selected", "true");
  expect(screen.getByRole("tab", { name: /자가용·주차/ })).toHaveAttribute("aria-selected", "false");
  expect(screen.getByRole("tabpanel")).toHaveTextContent("지하철에서 예식장까지");
  expect(screen.getByText("추천 경로")).toBeInTheDocument();
  expect(screen.getByText("NAVER MAP")).toBeInTheDocument();
  expect(screen.getByText("KAKAO MAP")).toBeInTheDocument();
  expect(screen.getByText("GOOGLE MAP")).toBeInTheDocument();

  for (const name of ["네이버지도", "카카오맵", "Google 지도"]) {
    const link = screen.getByRole("link", { name });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  }
  expect(screen.getByRole("link", { name: "032-347-5500 전화하기" })).toHaveAttribute(
    "href",
    "tel:0323475500"
  );
  expect(screen.getByRole("button", { name: "주소 복사" })).toHaveTextContent("주소 복사");
});

it("이동 방법 탭을 바꾸면 한 카드 안에서 필요한 안내만 보여준다", () => {
  render(<DirectionsSheet onClose={vi.fn()} />);

  fireEvent.click(screen.getByRole("tab", { name: /자가용·주차/ }));

  expect(screen.getByRole("tab", { name: /자가용·주차/ })).toHaveAttribute("aria-selected", "true");
  expect(screen.getByRole("tabpanel")).toHaveTextContent("주차장 이용 안내");
  expect(screen.getByRole("tabpanel")).toHaveTextContent("주차 2시간 무료 · 약 500대 이상 주차 가능");
  expect(screen.getByRole("tabpanel")).not.toHaveTextContent("소사역 1번 출구");
});

it("선택한 지도 앱을 강조하고 새 창 안내를 갱신한다", () => {
  render(<DirectionsSheet onClose={vi.fn()} />);

  const kakaoLink = screen.getByRole("link", { name: "카카오맵" });
  expect(kakaoLink).not.toHaveAttribute("aria-current");
  fireEvent.click(kakaoLink);

  expect(kakaoLink).toHaveAttribute("aria-current", "true");
  expect(kakaoLink).toHaveAttribute("data-selected", "true");
  expect(kakaoLink).toHaveTextContent("지금 연 앱");
  expect(screen.getByText("카카오맵을 열었어요").closest(".directions-sheet__map-status")).toHaveAttribute("aria-live", "polite");
});

it("주소를 복사하고 성공 상태를 알린다", async () => {
  vi.mocked(copyText).mockResolvedValue(undefined);
  render(<DirectionsSheet onClose={vi.fn()} />);

  fireEvent.click(screen.getByRole("button", { name: "주소 복사" }));

  expect(copyText).toHaveBeenCalledWith("경기 부천시 소사구 경인로 386");
  expect(await screen.findByRole("status")).toHaveTextContent("주소 복사를 완료했어요");
  expect(screen.getByRole("status")).toHaveTextContent("지도 앱 검색창에 바로 붙여넣을 수 있습니다.");
  expect(screen.getByRole("button", { name: "주소 복사" })).toHaveTextContent("복사 완료");
  expect(screen.getByRole("button", { name: "주소 복사" })).toHaveAttribute("aria-describedby", "directions-copy-feedback");
});

it("주소 복사 실패 후에도 주소를 표시하고 오류를 알린다", async () => {
  vi.mocked(copyText).mockRejectedValue(new Error("denied"));
  render(<DirectionsSheet onClose={vi.fn()} />);

  fireEvent.click(screen.getByRole("button", { name: "주소 복사" }));

  expect(
    await screen.findByRole("alert")
  ).toHaveTextContent("주소를 복사하지 못했어요");
  expect(screen.getByRole("alert")).toHaveTextContent("위 주소를 길게 눌러 직접 복사해주세요.");
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
