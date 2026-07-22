import { describe, expect, it } from "vitest";
import { handleApiRequest } from "./http";
import type { Env } from "./index";

describe("invitation gallery CORS", () => {
  it("관리자 사진 업로드용 PUT 메서드와 슬롯 헤더를 허용한다", async () => {
    const origin = "https://po-mato.github.io";
    const response = await handleApiRequest(
      new Request("https://worker.test/api/invitations/sample-garden/admin/gallery/assets/12345678-1234-4000-8123-123456789abc/640", {
        method: "OPTIONS",
        headers: {
          origin,
          "access-control-request-method": "PUT",
          "access-control-request-headers": "authorization,content-type,x-gallery-slot-id"
        }
      }),
      {
        RSVP_ALLOWED_ORIGINS: origin
      } as Env,
      "client"
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe(origin);
    expect(response.headers.get("access-control-allow-methods")).toContain("PUT");
    expect(response.headers.get("access-control-allow-headers")).toContain("x-gallery-slot-id");
  });
});
