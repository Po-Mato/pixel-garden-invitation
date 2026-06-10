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

  it.each([
    { limit: 0, windowMs: 1000 },
    { limit: -1, windowMs: 1000 },
    { limit: 1.5, windowMs: 1000 },
    { limit: Number.NaN, windowMs: 1000 },
    { limit: Number.POSITIVE_INFINITY, windowMs: 1000 },
    { limit: 2, windowMs: 0 },
    { limit: 2, windowMs: -1 },
    { limit: 2, windowMs: 1.5 },
    { limit: 2, windowMs: Number.NaN },
    { limit: 2, windowMs: Number.POSITIVE_INFINITY },
  ])("rejects invalid options %#", (options) => {
    expect(() => new MemoryRateLimiter(options)).toThrow(RangeError);
  });
});
