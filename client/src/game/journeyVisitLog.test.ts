import { describe, expect, it } from "vitest";
import { formatJourneyVisitTime, journeyVisitDurationLabel, loadJourneyVisits, recordJourneyVisit } from "./journeyVisitLog";

function memoryStorage() {
  let value: string | null = null;
  return {
    getItem: () => value,
    setItem: (_key: string, next: string) => { value = next; }
  };
}

describe("journeyVisitLog", () => {
  it("records each checkpoint once in journey order", () => {
    const storage = memoryStorage();
    recordJourneyVisit("gallery", storage, "2027-05-01T08:20:00.000Z");
    recordJourneyVisit("directions", storage, "2027-05-01T08:10:00.000Z");
    recordJourneyVisit("gallery", storage, "2027-05-01T09:00:00.000Z");
    expect(loadJourneyVisits(storage)).toEqual([
      { checkpointId: "directions", visitedAt: "2027-05-01T08:10:00.000Z" },
      { checkpointId: "gallery", visitedAt: "2027-05-01T08:20:00.000Z" }
    ]);
  });

  it("formats a readable Korean visit time", () => {
    expect(formatJourneyVisitTime("2027-05-01T08:20:00.000Z")).toContain("5:20");
  });

  it("summarizes the elapsed journey", () => {
    expect(journeyVisitDurationLabel([
      { checkpointId: "directions", visitedAt: "2027-05-01T08:00:00.000Z" },
      { checkpointId: "gallery", visitedAt: "2027-05-01T08:42:00.000Z" }
    ])).toBe("42분의 여정");
  });
});
