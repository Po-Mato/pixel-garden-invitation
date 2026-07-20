import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearAdminSession,
  clearRsvpCredential,
  loadAdminSession,
  loadRsvpCredential,
  saveAdminSession,
  saveRsvpCredential
} from "./rsvpStorage";

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key) {
      return values.get(key) ?? null;
    },
    key(index) {
      return [...values.keys()][index] ?? null;
    },
    removeItem(key) {
      values.delete(key);
    },
    setItem(key, value) {
      values.set(key, value);
    }
  };
}

beforeEach(() => {
  Object.defineProperty(window, "localStorage", { configurable: true, value: memoryStorage() });
  Object.defineProperty(window, "sessionStorage", { configurable: true, value: memoryStorage() });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("rsvpStorage", () => {
  it("stores guest credentials by invitation and only the credential fields", () => {
    saveRsvpCredential("sample-garden", { rsvpId: "rsvp_1", editToken: "edit-token", ignored: "value" } as never);
    saveRsvpCredential("other", { rsvpId: "rsvp_2", editToken: "other-token" });

    expect(loadRsvpCredential("sample-garden")).toEqual({ rsvpId: "rsvp_1", editToken: "edit-token" });
    expect(loadRsvpCredential("other")).toEqual({ rsvpId: "rsvp_2", editToken: "other-token" });
    expect(JSON.parse(window.localStorage.getItem("wedding:rsvp:sample-garden") ?? "null")).toEqual({
      rsvpId: "rsvp_1",
      editToken: "edit-token"
    });
  });

  it("removes damaged guest credential values without throwing", () => {
    window.localStorage.setItem("wedding:rsvp:sample-garden", "{bad json");
    expect(loadRsvpCredential("sample-garden")).toBeNull();
    expect(window.localStorage.getItem("wedding:rsvp:sample-garden")).toBeNull();
  });

  it("stores numeric admin session expirations in sessionStorage and clears them independently", () => {
    saveAdminSession("sample-garden", { token: "admin-token", expiresAt: 1_800_000_000_000, extra: true } as never);
    expect(loadAdminSession("sample-garden")).toEqual({ token: "admin-token", expiresAt: 1_800_000_000_000 });
    expect(window.localStorage.getItem("wedding:rsvp-admin:sample-garden")).toBeNull();

    expect(clearAdminSession("sample-garden")).toBe(true);
    expect(clearRsvpCredential("sample-garden")).toBe(false);
  });

  it("removes expired and malformed admin sessions using the current clock", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_700_000_000_000);
    window.sessionStorage.setItem("wedding:rsvp-admin:expired", JSON.stringify({
      token: "admin-token",
      expiresAt: 1_700_000_000_000
    }));
    window.sessionStorage.setItem("wedding:rsvp-admin:malformed", JSON.stringify({
      token: "admin-token",
      expiresAt: "1_800_000_000_000"
    }));
    window.sessionStorage.setItem("wedding:rsvp-admin:fraction", JSON.stringify({
      token: "admin-token",
      expiresAt: 1_800_000_000_000.5
    }));

    expect(loadAdminSession("expired")).toBeNull();
    expect(loadAdminSession("malformed")).toBeNull();
    expect(loadAdminSession("fraction")).toBeNull();
    expect(window.sessionStorage.getItem("wedding:rsvp-admin:expired")).toBeNull();
    expect(window.sessionStorage.getItem("wedding:rsvp-admin:malformed")).toBeNull();
    expect(window.sessionStorage.getItem("wedding:rsvp-admin:fraction")).toBeNull();
  });

  it("does not throw when browser storage access or writes are denied", () => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("Denied", "SecurityError");
      }
    });
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      get() {
        throw new DOMException("Denied", "SecurityError");
      }
    });

    expect(loadRsvpCredential("sample-garden")).toBeNull();
    expect(saveRsvpCredential("sample-garden", { rsvpId: "rsvp_1", editToken: "edit-token" })).toBe(false);
    expect(loadAdminSession("sample-garden")).toBeNull();
    expect(saveAdminSession("sample-garden", { token: "admin-token", expiresAt: 1_800_000_000_000 })).toBe(false);

    const deniedWrite = memoryStorage();
    deniedWrite.setItem = () => {
      throw new DOMException("Denied", "QuotaExceededError");
    };
    Object.defineProperty(window, "localStorage", { configurable: true, value: deniedWrite });
    Object.defineProperty(window, "sessionStorage", { configurable: true, value: deniedWrite });

    expect(saveRsvpCredential("sample-garden", { rsvpId: "rsvp_1", editToken: "edit-token" })).toBe(false);
    expect(saveAdminSession("sample-garden", { token: "admin-token", expiresAt: 1_800_000_000_000 })).toBe(false);
  });
});
