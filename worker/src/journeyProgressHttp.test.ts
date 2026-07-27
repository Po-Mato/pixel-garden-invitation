import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./journeyProgressRepository", () => ({
  loadJourneyProgress: vi.fn(),
  mergeJourneyProgress: vi.fn()
}));

import { handleJourneyProgressRequest } from "./journeyProgressHttp";
import * as repository from "./journeyProgressRepository";
import type { Env } from "./index";

const progress = { version: 1 as const, completedIds: ["directions" as const], updatedAt: "2026-07-28T00:00:00.000Z" };
const env = { DB: {} as D1Database } as Env;

describe("journey progress HTTP", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(repository.loadJourneyProgress).mockResolvedValue(progress);
    vi.mocked(repository.mergeJourneyProgress).mockResolvedValue(progress);
  });

  it("유효한 개인 초대 토큰으로 진행도를 조회한다", async () => {
    const response = await handleJourneyProgressRequest(new Request("https://worker.test/journey-progress", {
      headers: { "x-invite-token": "A".repeat(43) }
    }), env, "sample-garden");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("저장 요청을 검증하고 초대 토큰이 없으면 존재 여부를 숨긴다", async () => {
    const stored = await handleJourneyProgressRequest(new Request("https://worker.test/journey-progress", {
      method: "PUT",
      headers: { "x-invite-token": "A".repeat(43), "content-type": "application/json" },
      body: JSON.stringify(progress)
    }), env, "sample-garden");
    expect(stored.status).toBe(200);
    expect(repository.mergeJourneyProgress).toHaveBeenCalledWith(
      env.DB,
      "sample-garden",
      "A".repeat(43),
      ["directions"]
    );

    const missing = await handleJourneyProgressRequest(
      new Request("https://worker.test/journey-progress"),
      env,
      "sample-garden"
    );
    expect(missing.status).toBe(404);
  });
});
