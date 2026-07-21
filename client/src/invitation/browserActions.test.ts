import { Blob as NodeBlob } from "node:buffer";
import { describe, expect, it, vi } from "vitest";
import {
  copyText,
  downloadIcs,
  isShareAbortError,
  NativeShareUnavailableError,
  shareContent
} from "./browserActions";

describe("wedding browser actions", () => {
  it("writes exact text to the supplied clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);

    await copyText("예식 일정", { writeText });

    expect(writeText).toHaveBeenCalledWith("예식 일정");
  });

  it("surfaces clipboard failures", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));

    await expect(copyText("예식 일정", { writeText })).rejects.toThrow("denied");
  });

  it("passes exact data to the supplied native share function", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const data = { title: "결혼식", text: "초대합니다.", url: "https://example.test/" };

    await shareContent(data, share);

    expect(share).toHaveBeenCalledWith(data);
  });

  it("reports native share support separately from a user cancellation", async () => {
    await expect(shareContent({ title: "결혼식" }, undefined))
      .rejects.toBeInstanceOf(NativeShareUnavailableError);
    expect(isShareAbortError(new DOMException("취소", "AbortError"))).toBe(true);
    expect(isShareAbortError(new Error("blocked"))).toBe(false);
  });

  it("downloads one CRLF UTF-8 calendar Blob and revokes its URL", async () => {
    const ics = "BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n";
    const BrowserBlob = globalThis.Blob;
    vi.stubGlobal("Blob", NodeBlob);
    let downloadedBlob: NodeBlob | undefined;
    const createObjectUrl = vi.fn((blob: Blob) => {
      downloadedBlob = blob as NodeBlob;
      return "blob:wedding-event";
    });
    const clickDownload = vi.fn();
    const revokeObjectUrl = vi.fn();

    try {
      downloadIcs(ics, { createObjectUrl, clickDownload, revokeObjectUrl });
    } finally {
      vi.stubGlobal("Blob", BrowserBlob);
    }

    expect(createObjectUrl).toHaveBeenCalledWith(expect.any(NodeBlob));
    expect(downloadedBlob).toBeDefined();
    expect(downloadedBlob?.type).toBe("text/calendar;charset=utf-8");
    await expect(downloadedBlob?.text()).resolves.toBe(ics);
    expect(clickDownload).toHaveBeenCalledWith("blob:wedding-event", "wedding-event.ics");
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:wedding-event");
  });

  it("revokes the object URL when the download click throws", () => {
    const revokeObjectUrl = vi.fn();
    const error = new Error("download blocked");

    expect(() => downloadIcs("BEGIN:VCALENDAR\r\n", {
      createObjectUrl: () => "blob:wedding-event",
      clickDownload: () => { throw error; },
      revokeObjectUrl
    })).toThrow(error);
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:wedding-event");
  });
});
