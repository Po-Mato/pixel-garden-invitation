import { beforeEach, describe, expect, it } from "vitest";
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

  it("stores admin sessions in sessionStorage and clears them independently", () => {
    saveAdminSession("sample-garden", { token: "admin-token", expiresAt: "2026-07-21T00:00:00.000Z", extra: true } as never);
    expect(loadAdminSession("sample-garden")).toEqual({ token: "admin-token", expiresAt: "2026-07-21T00:00:00.000Z" });
    expect(window.localStorage.getItem("wedding:rsvp-admin:sample-garden")).toBeNull();

    expect(clearAdminSession("sample-garden")).toBe(true);
    expect(clearRsvpCredential("sample-garden")).toBe(false);
  });
});
