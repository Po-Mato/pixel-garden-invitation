import { describe, expect, it, vi } from "vitest";
import { copyText, downloadIcs } from "./browserActions";

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

  it("downloads one UTF-8 calendar file and revokes its URL", () => {
    const createObjectUrl = vi.fn(() => "blob:wedding-event");
    const clickDownload = vi.fn();
    const revokeObjectUrl = vi.fn();

    downloadIcs("BEGIN:VCALENDAR\\r\\n", { createObjectUrl, clickDownload, revokeObjectUrl });

    expect(createObjectUrl).toHaveBeenCalledWith(expect.any(Blob));
    expect(clickDownload).toHaveBeenCalledWith("blob:wedding-event", "wedding-event.ics");
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:wedding-event");
  });
});
