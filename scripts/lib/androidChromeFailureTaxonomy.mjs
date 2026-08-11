const rendererDisconnectPatterns = Object.freeze([
  /disconnected: Unable to receive message from renderer/i,
  /not connected to DevTools/i
]);

export function classifyAndroidChromeFailure(errorText = "") {
  const message = String(errorText);
  if (rendererDisconnectPatterns.some((pattern) => pattern.test(message))) {
    return {
      category: "automation-renderer",
      kind: "renderer-disconnect",
      retryable: true
    };
  }
  return {
    category: "product-or-unknown",
    kind: "unclassified",
    retryable: false
  };
}
