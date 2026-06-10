import { describe, expect, test } from "vitest";

import worker, { GardenRoom } from "./index";

describe("worker scaffold", () => {
  test("returns a worker health response", async () => {
    const response = await worker.fetch();

    await expect(response.text()).resolves.toBe("Wedding game worker is running");
    expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
  });

  test("returns a garden room health response", async () => {
    const room = new GardenRoom({} as DurableObjectState);
    const response = await room.fetch();

    await expect(response.text()).resolves.toBe("Garden room is running");
    expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
  });
});
