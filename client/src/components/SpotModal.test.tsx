import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SpotModal } from "./SpotModal";

const api = vi.hoisted(() => ({
  fetchGuestbookMessages: vi.fn().mockResolvedValue([]),
  submitGuestbook: vi.fn()
}));

vi.mock("../api/weddingApi", async (importOriginal) => ({
  ...await importOriginal<typeof import("../api/weddingApi")>(),
  ...api
}));
vi.mock("./RsvpPanel", () => ({ RsvpPanel: () => <div>참석 답변 전용 패널</div> }));
vi.mock("./GuestbookPanel", () => ({ GuestbookPanel: () => <div>방명록 전용 패널</div> }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("지점 모달", () => {
  it.each([
    ["couple", "서로의 계절을 함께 걷기로 한 두 사람을 소개합니다.", "신랑 이승재"],
    ["story", "첫 만남부터 결혼식까지 이어진 이야기를 따라 걸어보세요.", "첫 인사"]
  ] as const)("%s 지점에서 기본 문구와 전용 패널을 함께 표시한다", (spotId, body, panelHeading) => {
    render(<SpotModal spotId={spotId} nickname="하객1" onClose={vi.fn()} />);

    expect(screen.getByText(body)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: panelHeading })).toBeInTheDocument();
  });

  it("참석 답변과 방명록 전용 분기를 유지한다", async () => {
    const { rerender } = render(<SpotModal spotId="rsvp" nickname="하객1" onClose={vi.fn()} />);
    expect(screen.getByText("참석 답변 전용 패널")).toBeInTheDocument();

    rerender(<SpotModal spotId="guestbook" nickname="하객1" onClose={vi.fn()} />);
    expect(await screen.findByText("방명록 전용 패널")).toBeInTheDocument();
    expect(api.fetchGuestbookMessages).toHaveBeenCalledTimes(1);
  });
});
