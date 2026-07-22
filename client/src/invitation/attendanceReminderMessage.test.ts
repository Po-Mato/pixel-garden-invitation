import { describe, expect, it } from "vitest";
import { buildAttendanceReminderMessage } from "./attendanceReminderMessage";

describe("attendance reminder message", () => {
  it("includes the guest, couple, deadline and personal invitation URL", () => {
    const message = buildAttendanceReminderMessage("김하객", "https://example.test/?invite=token");
    expect(message).toContain("김하객님");
    expect(message).toContain("이건희 · 이승재");
    expect(message).toContain("2027년 4월 24일");
    expect(message).toContain("https://example.test/?invite=token");
  });
});
