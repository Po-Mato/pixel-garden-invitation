import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { copyText, downloadIcs } from "../invitation/browserActions";
import { CalendarSaveSheet } from "./CalendarSaveSheet";

vi.mock("../invitation/browserActions", () => ({
  copyText: vi.fn(),
  downloadIcs: vi.fn()
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("CalendarSaveSheet", () => {
  it("offers native calendar, Google Calendar, and event copy", () => {
    render(<CalendarSaveSheet onClose={vi.fn()} />);

    expect(screen.getByRole("dialog", { name: "캘린더 저장" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "기본 캘린더에 저장" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Google 캘린더에서 열기" })).toHaveAttribute(
      "href",
      expect.stringContaining("calendar.google.com/calendar/render")
    );
    expect(screen.getByRole("button", { name: "일정 내용 복사" })).toBeInTheDocument();
    expect(screen.getByText(/2027년 5월 1일 토요일/)).toBeInTheDocument();
  });

  it("reports copy success and failure without hiding the source text", async () => {
    const mockedCopyText = vi.mocked(copyText);
    mockedCopyText.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("denied"));
    render(<CalendarSaveSheet onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "일정 내용 복사" }));
    expect(await screen.findByText("일정을 복사했습니다.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "일정 내용 복사" }));
    expect(await screen.findByText("복사하지 못했습니다. 내용을 길게 눌러 복사해주세요.")).toBeInTheDocument();
    expect(screen.getByText(/MJ컨벤션 5층 파티오볼룸/)).toBeInTheDocument();
  });

  it("downloads one calendar file and reports download failures", () => {
    const mockedDownloadIcs = vi.mocked(downloadIcs);
    mockedDownloadIcs.mockImplementationOnce(() => undefined).mockImplementationOnce(() => {
      throw new Error("blocked");
    });
    render(<CalendarSaveSheet onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "기본 캘린더에 저장" }));
    expect(mockedDownloadIcs).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "기본 캘린더에 저장" }));
    expect(screen.getByText("캘린더 파일을 만들지 못했습니다. 다시 시도해주세요.")).toBeInTheDocument();
    expect(screen.getByText(/경기 부천시 소사구 경인로 386/)).toBeInTheDocument();
  });
});
