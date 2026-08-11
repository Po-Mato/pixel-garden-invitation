const infrastructurePatterns = [
  /simulator|simctl|xcrun|xcode|bootstatus|device is not available/i,
  /appium 서버|econnrefused.*4723|socket hang up/i
];

const wdaPatterns = [
  /webdriveragent|\bwda\b|port 8100|econnrefused.*8100|wdaLaunchTimeout/i
];

const webdriverPatterns = [
  /webdriver|invalid session|no such (?:window|context)|unknown command|execute\/sync/i
];

const compositorPatterns = [
  /compositor|framebuffer|네이티브 캡처|합성기/i
];

const productPhaseKinds = Object.freeze({
  "portrait-game": "product-game-render",
  "directions-200": "product-directions-layout",
  landscape: "product-landscape-layout",
  "pwa-offline": "product-pwa-offline",
  "baseline-comparison": "product-visual-regression"
});

export function classifyIosSafariFailure(error, { phase = null } = {}) {
  const message = error instanceof Error ? error.message : String(error ?? "unknown failure");
  const details = `${message}\n${error instanceof Error ? error.stack ?? "" : ""}`;
  if (compositorPatterns.some((pattern) => pattern.test(details))) {
    return {
      category: "automation",
      kind: "automation-compositor",
      phase,
      retryable: true,
      message
    };
  }
  if (phase === "wda-session" || wdaPatterns.some((pattern) => pattern.test(details))) {
    return {
      category: "automation",
      kind: "automation-wda",
      phase,
      retryable: true,
      message
    };
  }
  if (phase === "appium-readiness" || infrastructurePatterns.some((pattern) => pattern.test(details))) {
    return {
      category: "infrastructure",
      kind: phase === "appium-readiness" ? "infrastructure-appium" : "infrastructure-simulator",
      phase,
      retryable: true,
      message
    };
  }
  if (webdriverPatterns.some((pattern) => pattern.test(details))) {
    return {
      category: "automation",
      kind: "automation-webdriver",
      phase,
      retryable: true,
      message
    };
  }
  if (phase && productPhaseKinds[phase]) {
    return {
      category: "product",
      kind: productPhaseKinds[phase],
      phase,
      retryable: false,
      message
    };
  }
  return {
    category: "unknown",
    kind: "unknown",
    phase,
    retryable: false,
    message
  };
}
