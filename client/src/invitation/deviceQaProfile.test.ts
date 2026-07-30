import { describe, expect, it } from "vitest";
import { detectDeviceQaProfile } from "./deviceQaProfile";

describe("deviceQaProfile", () => {
  it("iPhone Safari의 OS와 브라우저 주요 버전을 익명 분류한다", () => {
    expect(detectDeviceQaProfile(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1",
      "iPhone"
    )).toEqual({ platform: "ios", osName: "iOS", osVersion: "17", browserName: "Safari", browserVersion: "17" });
  });

  it("Android Chrome의 주요 버전을 분류한다", () => {
    expect(detectDeviceQaProfile(
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126.0.0.0 Mobile Safari/537.36",
      "Linux armv8l"
    )).toMatchObject({ platform: "android", osName: "Android", osVersion: "14", browserName: "Chrome", browserVersion: "126" });
  });
});
