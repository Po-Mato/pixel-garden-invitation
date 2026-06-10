import { describe, expect, it } from "vitest";
import { MemoryRateLimiter } from "./rateLimit";

describe("MemoryRateLimiter", () => {
  it("allows requests under the limit", () => {
    const limiter = new MemoryRateLimiter({ limit: 2, windowMs: 1000 });
    expect(limiter.allow("a", 0)).toBe(true);
    expect(limiter.allow("a", 100)).toBe(true);
  });

  it("blocks requests over the limit", () => {
    const limiter = new MemoryRateLimiter({ limit: 2, windowMs: 1000 });
    limiter.allow("a", 0);
    limiter.allow("a", 100);
    expect(limiter.allow("a", 200)).toBe(false);
  });
});
