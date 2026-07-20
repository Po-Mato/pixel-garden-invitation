import { describe, expect, it, vi } from "vitest";

import type { RsvpSubmission } from "@wedding-game/shared";
import { createRsvp, findRsvp, getRsvpPolicy, updateRsvp } from "./rsvpRepository";
import { hashEditToken } from "./security";

const submission: RsvpSubmission = {
  side: "groom",
  guestName: "이승재",
  phone: "01012345678",
  attendance: "yes",
  partySize: 2,
  mealStatus: "yes",
  note: "창가 자리",
  consentVersion: "2026-07-20"
};

const row = {
  id: "rsvp_1",
  side: "groom",
  guest_name: "이승재",
  phone: "01012345678",
  attendance: "yes",
  party_size: 2,
  meal_status: "yes",
  note: "창가 자리",
  consent_version: "2026-07-20",
  edit_token_hash: "stored-edit-token-hash",
  revision: 1,
  created_at: "2026-07-20T10:00:00.000Z",
  updated_at: "2026-07-20T10:00:00.000Z"
} as const;

function createFirstDb(result: unknown) {
  const first = vi.fn().mockResolvedValue(result);
  const bind = vi.fn(() => ({ first }));
  const prepare = vi.fn(() => ({ bind }));
  return { db: { prepare } as unknown as D1Database, prepare, bind, first };
}

describe("createRsvp", () => {
  it("binds the edit-token hash and maps the inserted row", async () => {
    const { db, prepare, bind } = createFirstDb(row);
    const rawEditToken = "raw-edit-token";
    const editTokenHash = await hashEditToken(rawEditToken);

    const response = await createRsvp(db, {
      id: "rsvp_1",
      invitationId: "sample-garden",
      submission,
      consentedAt: "2026-07-20T10:00:00.000Z",
      editTokenHash
    });

    expect(prepare).toHaveBeenCalledWith(expect.stringMatching(/INSERT INTO rsvps/i));
    expect(prepare).toHaveBeenCalledWith(expect.stringMatching(/RETURNING[\s\S]*guest_name/i));
    expect(bind).toHaveBeenCalledWith(
      "rsvp_1",
      "sample-garden",
      "groom",
      "이승재",
      "01012345678",
      "yes",
      2,
      "yes",
      "창가 자리",
      "2026-07-20",
      "2026-07-20T10:00:00.000Z",
      editTokenHash
    );
    expect(bind.mock.calls.flat()).not.toContain(rawEditToken);
    expect(response).toEqual({
      id: "rsvp_1",
      side: "groom",
      guestName: "이승재",
      phone: "01012345678",
      attendance: "yes",
      partySize: 2,
      mealStatus: "yes",
      note: "창가 자리",
      consentVersion: "2026-07-20",
      revision: 1,
      createdAt: "2026-07-20T10:00:00.000Z",
      updatedAt: "2026-07-20T10:00:00.000Z"
    });
  });
});

describe("findRsvp", () => {
  it("maps a D1 snake_case row and keeps the credential hash separate", async () => {
    const { db, prepare, bind } = createFirstDb(row);

    const found = await findRsvp(db, "sample-garden", "rsvp_1");

    expect(prepare).toHaveBeenCalledWith(expect.stringMatching(/WHERE invitation_id = \? AND id = \?/i));
    expect(bind).toHaveBeenCalledWith("sample-garden", "rsvp_1");
    expect(found).toEqual({
      response: {
        id: "rsvp_1",
        side: "groom",
        guestName: "이승재",
        phone: "01012345678",
        attendance: "yes",
        partySize: 2,
        mealStatus: "yes",
        note: "창가 자리",
        consentVersion: "2026-07-20",
        revision: 1,
        createdAt: "2026-07-20T10:00:00.000Z",
        updatedAt: "2026-07-20T10:00:00.000Z"
      },
      editTokenHash: "stored-edit-token-hash"
    });
  });
});

describe("updateRsvp", () => {
  it("increments only the expected revision and returns the mapped row", async () => {
    const updatedRow = { ...row, side: "bride", revision: 2, updated_at: "2026-07-20T11:00:00.000Z" };
    const { db, prepare, bind } = createFirstDb(updatedRow);

    const response = await updateRsvp(db, {
      invitationId: "sample-garden",
      rsvpId: "rsvp_1",
      submission: { ...submission, side: "bride" },
      expectedRevision: 1,
      updatedAt: "2026-07-20T11:00:00.000Z"
    });

    expect(prepare).toHaveBeenCalledWith(expect.stringMatching(/revision = revision \+ 1/i));
    expect(prepare).toHaveBeenCalledWith(expect.stringMatching(/WHERE invitation_id = \? AND id = \? AND revision = \?/i));
    expect(bind).toHaveBeenCalledWith(
      "bride",
      "이승재",
      "01012345678",
      "yes",
      2,
      "yes",
      "창가 자리",
      "2026-07-20",
      "2026-07-20T11:00:00.000Z",
      "sample-garden",
      "rsvp_1",
      1
    );
    expect(response).toMatchObject({ id: "rsvp_1", side: "bride", revision: 2 });
  });

  it("returns null when the expected revision does not update a row", async () => {
    const { db } = createFirstDb(null);

    await expect(updateRsvp(db, {
      invitationId: "sample-garden",
      rsvpId: "rsvp_1",
      submission,
      expectedRevision: 99,
      updatedAt: "2026-07-20T11:00:00.000Z"
    })).resolves.toBeNull();
  });
});

describe("getRsvpPolicy", () => {
  it("reads the consent version from the invitation D1 policy", async () => {
    const { db, prepare, bind } = createFirstDb({
      config_json: JSON.stringify({ rsvp: { consentVersion: "d1-consent-v2" } }),
      rsvp_deadline: "2027-04-24T14:59:59.000Z",
      rsvp_delete_at: "2027-05-31T14:59:59.000Z"
    });

    await expect(getRsvpPolicy(db, "sample-garden")).resolves.toEqual({
      consentVersion: "d1-consent-v2",
      responseDeadline: "2027-04-24T14:59:59.000Z",
      deleteAt: "2027-05-31T14:59:59.000Z"
    });
    expect(prepare).toHaveBeenCalledWith(expect.stringMatching(/config_json/));
    expect(bind).toHaveBeenCalledWith("sample-garden");
  });
});
