import { describe, expect, it, vi } from "vitest";

import { cleanupExpiredRsvpData } from "./cleanup";

type Invitation = { id: string; rsvpDeleteAt: string | null };
type Attempt = { id: string; windowStartedAt: string };

function createDb(invitations: Invitation[], rsvpInvitationIds: string[], attempts: Attempt[]) {
  const rsvps = [...rsvpInvitationIds];
  const loginAttempts = [...attempts];
  const prepare = vi.fn((sql: string) => ({
    bind: (...values: unknown[]) => ({
      run: async () => {
        const cutoff = String(values[0]);
        if (/DELETE FROM rsvps/i.test(sql)) {
          const expiredIds = new Set(invitations
            .filter(({ rsvpDeleteAt }) => rsvpDeleteAt !== null && rsvpDeleteAt <= cutoff)
            .map(({ id }) => id));
          const before = rsvps.length;
          for (let index = rsvps.length - 1; index >= 0; index -= 1) {
            if (expiredIds.has(rsvps[index])) rsvps.splice(index, 1);
          }
          return { success: true, meta: { changes: before - rsvps.length } };
        }

        const before = loginAttempts.length;
        for (let index = loginAttempts.length - 1; index >= 0; index -= 1) {
          if (loginAttempts[index].windowStartedAt < cutoff) loginAttempts.splice(index, 1);
        }
        return { success: true, meta: { changes: before - loginAttempts.length } };
      }
    })
  }));

  return { db: { prepare } as unknown as D1Database, prepare, rsvps, loginAttempts };
}

describe("cleanupExpiredRsvpData", () => {
  it("keeps RSVP data immediately before its deletion time", async () => {
    const { db, rsvps } = createDb(
      [{ id: "sample-garden", rsvpDeleteAt: "2027-05-31T14:59:59.000Z" }],
      ["sample-garden"],
      []
    );

    const result = await cleanupExpiredRsvpData(db, new Date("2027-05-31T14:59:58.999Z"));

    expect(result).toEqual({ rsvps: 0, attempts: 0 });
    expect(rsvps).toEqual(["sample-garden"]);
  });

  it("deletes RSVP data at the policy boundary and stale login attempts", async () => {
    const { db, rsvps, loginAttempts, prepare } = createDb(
      [
        { id: "expired", rsvpDeleteAt: "2027-05-31T14:59:59.000Z" },
        { id: "active", rsvpDeleteAt: "2027-06-01T00:00:00.001Z" },
        { id: "retained", rsvpDeleteAt: null }
      ],
      ["expired", "active", "retained"],
      [
        { id: "stale", windowStartedAt: "2027-05-31T23:49:59.999Z" },
        { id: "boundary", windowStartedAt: "2027-05-31T23:50:00.000Z" }
      ]
    );

    const result = await cleanupExpiredRsvpData(db, new Date("2027-06-01T00:00:00.000Z"));

    expect(result).toEqual({ rsvps: 1, attempts: 1 });
    expect(rsvps).toEqual(["active", "retained"]);
    expect(loginAttempts).toEqual([{ id: "boundary", windowStartedAt: "2027-05-31T23:50:00.000Z" }]);
    expect(prepare).toHaveBeenCalledWith(expect.stringMatching(/rsvp_delete_at\s*<=\s*\?/i));
    expect(prepare).toHaveBeenCalledWith(expect.stringMatching(/window_started_at\s*<\s*\?/i));
  });

  it("is idempotent when the same cleanup runs again", async () => {
    const { db } = createDb(
      [{ id: "expired", rsvpDeleteAt: "2027-05-31T14:59:59.000Z" }],
      ["expired"],
      [{ id: "stale", windowStartedAt: "2027-05-31T00:00:00.000Z" }]
    );
    const now = new Date("2027-06-01T00:00:00.000Z");

    await expect(cleanupExpiredRsvpData(db, now)).resolves.toEqual({ rsvps: 1, attempts: 1 });
    await expect(cleanupExpiredRsvpData(db, now)).resolves.toEqual({ rsvps: 0, attempts: 0 });
  });
});
