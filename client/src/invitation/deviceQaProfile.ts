export type DeviceQaProfile = {
  platform: "ios" | "android" | "other";
  osName: string;
  osVersion: string;
  browserName: string;
  browserVersion: string;
};

function major(value: string | undefined) {
  return value?.match(/^\d+/)?.[0] ?? "-";
}

export function detectDeviceQaProfile(userAgent: string, platformHint = ""): DeviceQaProfile {
  const ua = userAgent || "";
  const ios = /iPhone|iPad|iPod/i.test(ua) || /Mac/i.test(platformHint) && /Mobile/i.test(ua);
  const android = /Android/i.test(ua);
  const osName = ios ? "iOS" : android ? "Android" : /Windows/i.test(ua) ? "Windows" : /Mac OS X/i.test(ua) ? "macOS" : "기타 OS";
  const osVersion = ios
    ? major(ua.match(/OS (\d+)[_.]/)?.[1])
    : android
      ? major(ua.match(/Android\s+(\d+)/i)?.[1])
      : /Windows NT 10/i.test(ua) ? "10+" : major(ua.match(/Mac OS X\s+(\d+)[_.]/)?.[1]);
  const browserName = /EdgA?|EdgiOS/i.test(ua) ? "Edge"
    : /FxiOS|Firefox/i.test(ua) ? "Firefox"
      : /CriOS|Chrome/i.test(ua) ? "Chrome"
        : /Safari/i.test(ua) ? "Safari" : "기타 브라우저";
  const browserVersion = browserName === "Edge" ? major(ua.match(/(?:EdgA?|EdgiOS)\/(\d+)/i)?.[1])
    : browserName === "Firefox" ? major(ua.match(/(?:FxiOS|Firefox)\/(\d+)/i)?.[1])
      : browserName === "Chrome" ? major(ua.match(/(?:CriOS|Chrome)\/(\d+)/i)?.[1])
        : browserName === "Safari" ? major(ua.match(/Version\/(\d+)/i)?.[1]) : "-";
  return { platform: ios ? "ios" : android ? "android" : "other", osName, osVersion, browserName, browserVersion };
}

export function currentDeviceQaProfile() {
  return detectDeviceQaProfile(navigator.userAgent, navigator.platform);
}
