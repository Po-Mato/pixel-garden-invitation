import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { copyText } from "../invitation/browserActions";
import { WeddingEventSummary } from "./WeddingEventSummary";

vi.mock("../invitation/browserActions", () => ({
  copyText: vi.fn(),
  downloadIcs: vi.fn()
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("renders a compact entry summary with only a machine-readable start time", () => {
  render(<WeddingEventSummary variant="compact" />);

  expect(screen.getByText("2027년 5월 1일 토요일")).toBeInTheDocument();
  expect(screen.getByText("오후 5시 10분")).toHaveAttribute("dateTime", "2027-05-01T17:10:00+09:00");
  expect(screen.queryByText("오후 6시 40분")).not.toBeInTheDocument();
  expect(screen.getByText("MJ컨벤션 5층 파티오볼룸")).toBeInTheDocument();
  expect(screen.queryByText("경기 부천시 소사구 경인로 386")).not.toBeInTheDocument();
});

it("compact 요약에서 공통 오시는 길 시트를 연다", () => {
  render(<WeddingEventSummary variant="compact" />);

  fireEvent.click(screen.getByRole("button", { name: "오시는 길" }));

  expect(screen.getByRole("dialog", { name: "오시는 길" })).toHaveTextContent("소사역 1번 출구");
});

it("renders details and reports address copy status", async () => {
  vi.mocked(copyText).mockResolvedValue(undefined);
  const { container } = render(<WeddingEventSummary variant="detail" />);

  const timeRange = container.querySelector(".wedding-event-summary__date strong");
  expect(timeRange).toHaveTextContent("오후 5시 10분 - 오후 6시 40분");
  expect(timeRange?.querySelector('time[datetime="2027-05-01T17:10:00+09:00"]')).toHaveTextContent("오후 5시 10분");
  expect(timeRange?.querySelector('time[datetime="2027-05-01T18:40:00+09:00"]')).toHaveTextContent("오후 6시 40분");
  expect(screen.getByText("경기 부천시 소사구 경인로 386")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "주소 복사" }));
  expect(await screen.findByText("주소를 복사했습니다.")).toBeInTheDocument();
});

it("keeps the address selectable and reports copy failure", async () => {
  vi.mocked(copyText).mockRejectedValue(new Error("denied"));
  render(<WeddingEventSummary variant="detail" />);

  fireEvent.click(screen.getByRole("button", { name: "주소 복사" }));

  expect(await screen.findByText("복사하지 못했습니다. 주소를 길게 눌러 복사해주세요.")).toBeInTheDocument();
  expect(screen.getByText("경기 부천시 소사구 경인로 386")).toBeInTheDocument();
});

it("notifies its owner while the calendar sheet is open", () => {
  const onCalendarSheetOpenChange = vi.fn();
  render(
    <WeddingEventSummary
      variant="detail"
      onCalendarSheetOpenChange={onCalendarSheetOpenChange}
    />
  );

  fireEvent.click(screen.getByRole("button", { name: "캘린더 저장" }));
  expect(onCalendarSheetOpenChange).toHaveBeenLastCalledWith(true);
  fireEvent.click(screen.getByRole("button", { name: "닫기" }));
  expect(onCalendarSheetOpenChange).toHaveBeenLastCalledWith(false);
});

it("상세 요약의 오시는 길 시트 열림 상태를 소유자에게 알린다", () => {
  const onDirectionsSheetOpenChange = vi.fn();
  render(
    <WeddingEventSummary
      variant="detail"
      onDirectionsSheetOpenChange={onDirectionsSheetOpenChange}
    />
  );

  fireEvent.click(screen.getByRole("button", { name: "오시는 길" }));
  expect(onDirectionsSheetOpenChange).toHaveBeenLastCalledWith(true);
  fireEvent.click(screen.getByRole("button", { name: "닫기" }));
  expect(onDirectionsSheetOpenChange).toHaveBeenLastCalledWith(false);
});
