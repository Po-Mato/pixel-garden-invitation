import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import {
  createGuestAnnouncement,
  createGuestFaq,
  deleteGuestInformationItem,
  getGuestInformationAdmin,
  getPublishedGuestInformation,
  recordGuestAnnouncementViews,
  updateGuestAnnouncement,
  updateGuestFaq
} from "./guestInformationRepository";

type SqliteStatement = {
  all(...parameters: unknown[]): unknown[];
  get(...parameters: unknown[]): unknown;
  run(...parameters: unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint };
};

type SqliteDatabase = {
  exec(sql: string): void;
  prepare(sql: string): SqliteStatement;
  close(): void;
};

const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as {
  DatabaseSync: new (path: string) => SqliteDatabase;
};

function d1(database: SqliteDatabase): D1Database {
  const prepare = (sql: string) => ({
    bind(...values: unknown[]) {
      const statement = database.prepare(sql);
      return {
        first: async <T>() => (statement.get(...values) ?? null) as T | null,
        all: async <T>() => ({ results: statement.all(...values) as T[] }),
        run: async () => {
          const result = statement.run(...values);
          return { success: true, meta: { changes: Number(result.changes) } };
        }
      } as unknown as D1PreparedStatement;
    }
  } as D1PreparedStatement);
  return {
    prepare,
    batch: async (statements: D1PreparedStatement[]) => Promise.all(statements.map((statement) => statement.run()))
  } as D1Database;
}

const announcementInput = {
  title: "예식장 입구 안내",
  body: "5층 파티오볼룸으로 바로 올라와 주세요.",
  tone: "important" as const,
  active: true,
  pinned: true,
  startsAt: null,
  endsAt: null,
  actionKind: "directions" as const,
  actionLabel: "길 찾기",
  actionUrl: null,
  sortOrder: 10
};

describe("guest information repository", () => {
  it("예약 공지와 FAQ를 운영하고 공개 범위와 조회 수를 집계한다", async () => {
    const database = new DatabaseSync(":memory:");
    try {
      database.exec(readFileSync(new URL("../migrations/0001_init.sql", import.meta.url), "utf8"));
      database.exec(readFileSync(new URL("../migrations/0016_guest_information.sql", import.meta.url), "utf8"));
      const db = d1(database);
      const now = new Date("2027-05-01T08:00:00.000Z");

      const current = await createGuestAnnouncement(db, "sample-garden", announcementInput, now);
      const future = await createGuestAnnouncement(db, "sample-garden", {
        ...announcementInput,
        title: "저녁 공지",
        startsAt: "2027-05-01T12:00:00.000Z"
      }, now);
      const faq = await createGuestFaq(db, "sample-garden", {
        category: "예식 안내",
        question: "접수대는 어디인가요?",
        answer: "5층 홀 앞에 있습니다.",
        active: true,
        featured: false,
        sortOrder: 50
      }, now);

      expect(current?.id).toMatch(/^notice_/);
      expect(future?.id).toMatch(/^notice_/);
      expect(faq?.id).toMatch(/^faq_/);
      const published = await getPublishedGuestInformation(db, "sample-garden", now);
      expect(published?.announcements.map(({ title }) => title)).toEqual(["예식장 입구 안내"]);
      expect(published?.faqs).toHaveLength(5);

      await recordGuestAnnouncementViews(db, "sample-garden", [current!.id]);
      await expect(getGuestInformationAdmin(db, "sample-garden", now)).resolves.toMatchObject({
        summary: {
          totalAnnouncements: 2,
          activeAnnouncements: 1,
          urgentAnnouncements: 0,
          totalFaqs: 5,
          activeFaqs: 5,
          announcementViews: 1
        }
      });

      await expect(updateGuestAnnouncement(db, "sample-garden", current!.id, {
        ...announcementInput,
        active: false
      }, now)).resolves.toMatchObject({ active: false, viewCount: 1 });
      await expect(updateGuestFaq(db, "sample-garden", faq!.id, {
        category: "현장 안내",
        question: faq!.question,
        answer: faq!.answer,
        active: false,
        featured: true,
        sortOrder: 5
      }, now)).resolves.toMatchObject({ category: "현장 안내", active: false, featured: true });
      await expect(deleteGuestInformationItem(db, "sample-garden", "faqs", faq!.id)).resolves.toBe(true);
      await expect(deleteGuestInformationItem(db, "sample-garden", "faqs", faq!.id)).resolves.toBe(false);
      await expect(getGuestInformationAdmin(db, "missing", now)).resolves.toBeNull();
    } finally {
      database.close();
    }
  });
});
