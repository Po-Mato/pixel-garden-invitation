type RateLimiterOptions = {
  limit: number;
  windowMs: number;
};

export class MemoryRateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(private readonly options: RateLimiterOptions) {}

  allow(key: string, now = Date.now()): boolean {
    const start = now - this.options.windowMs;
    const current = (this.hits.get(key) ?? []).filter((timestamp) => timestamp > start);
    if (current.length >= this.options.limit) {
      this.hits.set(key, current);
      return false;
    }
    current.push(now);
    this.hits.set(key, current);
    return true;
  }
}
