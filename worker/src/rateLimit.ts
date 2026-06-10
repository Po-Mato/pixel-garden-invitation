type RateLimiterOptions = {
  limit: number;
  windowMs: number;
};

export class MemoryRateLimiter {
  private readonly hits = new Map<string, number[]>();
  private readonly limit: number;
  private readonly windowMs: number;

  constructor(options: RateLimiterOptions) {
    validatePositiveInteger("limit", options.limit);
    validatePositiveInteger("windowMs", options.windowMs);
    this.limit = options.limit;
    this.windowMs = options.windowMs;
  }

  allow(key: string, now = Date.now()): boolean {
    const start = now - this.windowMs;
    const current = (this.hits.get(key) ?? []).filter((timestamp) => timestamp > start);
    if (current.length >= this.limit) {
      this.hits.set(key, current);
      return false;
    }
    current.push(now);
    this.hits.set(key, current);
    return true;
  }
}

function validatePositiveInteger(name: string, value: number): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(`${name} must be a positive integer`);
  }
}
