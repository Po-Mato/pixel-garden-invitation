const retryableAndroidNavigationPatterns = [
  /ERR_ADDRESS_UNREACHABLE/i,
  /ERR_CONNECTION_REFUSED/i,
  /ERR_NETWORK_CHANGED/i,
  /document.+(?:timeout|시간 초과)/i,
  /(?:timeout|시간 초과).+document/i
];

export function isRetryableAndroidNavigationError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return retryableAndroidNavigationPatterns.some((pattern) => pattern.test(message));
}

export async function navigateAndroidChromeWithRetry({
  targetUrl,
  navigate,
  verify,
  maxAttempts = 3,
  delayMs = 1_500,
  wait = (durationMs) => new Promise((resolve) => setTimeout(resolve, durationMs))
}) {
  const attempts = [];
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const startedAt = Date.now();
    try {
      await navigate(targetUrl);
      await verify();
      attempts.push({ attempt, outcome: "ready", durationMs: Date.now() - startedAt, error: null });
      return { targetUrl, outcome: "ready", attempts };
    } catch (error) {
      const retryable = isRetryableAndroidNavigationError(error);
      attempts.push({
        attempt,
        outcome: retryable ? "retryable-failure" : "failure",
        durationMs: Date.now() - startedAt,
        error: error.message
      });
      if (!retryable || attempt === maxAttempts) {
        error.navigationAttempts = attempts;
        throw error;
      }
      await wait(delayMs * attempt);
    }
  }
  throw new Error("Android Chrome URL readiness attempts exhausted");
}
