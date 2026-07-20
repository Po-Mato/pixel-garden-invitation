import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readMigration(filename: string): string {
  return readFileSync(new URL(`../migrations/${filename}`, import.meta.url), "utf8")
    .replace(/\s+/g, " ")
    .trim();
}

const invitationValues = [
  "이승재 & 이건희의 정원",
  "2027-05-01",
  "MJ컨벤션 5층 파티오볼룸",
  "경기 부천시 소사구 경인로 386"
];

describe("invitation migrations", () => {
  it("seeds sample-garden with the confirmed invitation details", () => {
    const migration = readMigration("0001_init.sql");

    for (const value of invitationValues) {
      expect(migration).toContain(`'${value}'`);
    }
  });

  it("updates an existing sample-garden row to the confirmed invitation details", () => {
    const migration = readMigration("0002_update_invitation_details.sql");

    expect(migration).toMatch(/UPDATE invitations SET .+ WHERE id = 'sample-garden';/);
    for (const value of invitationValues) {
      expect(migration).toContain(`'${value}'`);
    }
  });
});
