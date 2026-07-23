import { describe, expect, it, vi } from "vitest";
import {
  journeyKeepsakeFilename,
  saveJourneyKeepsake,
  shareJourneyKeepsake,
  type JourneyKeepsakeData
} from "./journeyKeepsake";

const data: JourneyKeepsakeData = {
  guestName: " 김 하객 ",
  coupleNames: "이건희 · 이승재",
  dateLabel: "2027년 5월 1일 토요일",
  timeLabel: "오후 5시 10분",
  venueLabel: "MJ컨벤션 5층 파티오볼룸",
  checkpointLabels: ["오시는 길", "웨딩 갤러리", "신부에게 인사", "예식홀", "축하 메시지"],
  photoUrl: "https://example.com/photo.webp",
  publicUrl: "https://example.com/invitation"
};

function downloadEnvironment() {
  return {
    createObjectUrl: vi.fn(() => "blob:keepsake"),
    clickDownload: vi.fn(),
    revokeObjectUrl: vi.fn()
  };
}

describe("journeyKeepsake", () => {
  it("creates a filesystem-safe personalized filename", () => {
    expect(journeyKeepsakeFilename(data.guestName)).toBe("wedding-garden-김-하객.png");
    expect(journeyKeepsakeFilename(" !!! ")).toBe("wedding-garden-guest.png");
  });

  it("downloads the generated PNG and always releases its temporary URL", async () => {
    const environment = downloadEnvironment();
    const blob = new Blob(["png"], { type: "image/png" });
    const createBlob = vi.fn(async () => blob);

    await saveJourneyKeepsake(data, environment, createBlob);

    expect(createBlob).toHaveBeenCalledWith(data);
    expect(environment.createObjectUrl).toHaveBeenCalledWith(blob);
    expect(environment.clickDownload).toHaveBeenCalledWith("blob:keepsake", "wedding-garden-김-하객.png");
    expect(environment.revokeObjectUrl).toHaveBeenCalledWith("blob:keepsake");
  });

  it("shares the PNG file when native file sharing is supported", async () => {
    const environment = {
      ...downloadEnvironment(),
      share: vi.fn(async (_data: ShareData) => undefined),
      canShare: vi.fn(() => true)
    };

    await expect(shareJourneyKeepsake(
      data,
      environment,
      async () => new Blob(["png"], { type: "image/png" })
    )).resolves.toBe("shared");

    const shareData = environment.share.mock.calls[0]![0];
    expect(shareData.title).toBe("이건희 · 이승재 결혼식 여정 카드");
    expect(shareData.files?.[0]).toMatchObject({ name: "wedding-garden-김-하객.png", type: "image/png" });
    expect(environment.clickDownload).not.toHaveBeenCalled();
  });

  it("saves the image when native file sharing is unavailable", async () => {
    const environment = downloadEnvironment();

    await expect(shareJourneyKeepsake(
      data,
      environment,
      async () => new Blob(["png"], { type: "image/png" })
    )).resolves.toBe("saved");

    expect(environment.clickDownload).toHaveBeenCalledWith("blob:keepsake", "wedding-garden-김-하객.png");
  });

  it("falls back to saving when the native share sheet rejects the file", async () => {
    const environment = {
      ...downloadEnvironment(),
      share: vi.fn(async () => { throw new Error("unsupported file share"); }),
      canShare: vi.fn(() => true)
    };

    await expect(shareJourneyKeepsake(
      data,
      environment,
      async () => new Blob(["png"], { type: "image/png" })
    )).resolves.toBe("saved");

    expect(environment.clickDownload).toHaveBeenCalledTimes(1);
  });
});
