import { describe, expect, test, vi } from "vitest";

import worker, { GardenRoom, type Env } from "./index";

describe("worker scaffold", () => {
  test("returns a worker health response", async () => {
    const response = await worker.fetch();

    await expect(response.text()).resolves.toBe("Wedding game worker is running");
    expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
  });

  test("returns a garden room health response", async () => {
    const room = new GardenRoom({} as DurableObjectState);
    const response = await room.fetch();

    await expect(response.text()).resolves.toBe("Garden room is running");
    expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
  });

  test("passes scheduled cleanup work to waitUntil", async () => {
    const run = vi.fn().mockResolvedValue({ success: true, meta: { changes: 0 } });
    const db = {
      prepare: vi.fn(() => ({ bind: vi.fn(() => ({ run })) }))
    } as unknown as D1Database;
    const waitUntil = vi.fn();
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    worker.scheduled(
      { scheduledTime: Date.parse("2027-06-01T00:00:00.000Z") } as ScheduledController,
      { DB: db } as Env,
      { waitUntil } as unknown as ExecutionContext
    );

    expect(waitUntil).toHaveBeenCalledOnce();
    await expect(waitUntil.mock.calls[0][0]).resolves.toEqual({
      emailQueue: { attempted: 0, sent: 0, failed: 0 },
      cleanup: { rsvps: 0, guestbookMessages: 0, notifications: 0, attempts: 0 }
    });
    expect(run).toHaveBeenCalledTimes(4);
    expect(info).toHaveBeenCalledWith(JSON.stringify({
      event: "admin_notification_email_queue",
      attempted: 0,
      sent: 0,
      failed: 0
    }));
    expect(info).toHaveBeenCalledWith(JSON.stringify({
      event: "invitation_data_cleanup",
      rsvps: 0,
      guestbookMessages: 0,
      notifications: 0,
      attempts: 0
    }));
    info.mockRestore();
  });

  test("runs only the email queue on the five-minute cron", async () => {
    const prepare = vi.fn();
    const waitUntil = vi.fn();
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    worker.scheduled(
      {
        scheduledTime: Date.parse("2027-06-01T00:05:00.000Z"),
        cron: "*/5 * * * *"
      } as ScheduledController,
      { DB: { prepare } as unknown as D1Database } as Env,
      { waitUntil } as unknown as ExecutionContext
    );

    await expect(waitUntil.mock.calls[0][0]).resolves.toEqual({
      emailQueue: { attempted: 0, sent: 0, failed: 0 },
      cleanup: null
    });
    expect(prepare).not.toHaveBeenCalled();
    info.mockRestore();
  });
});
