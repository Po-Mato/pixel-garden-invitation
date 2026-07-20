import { handleApiRequest } from "./http";

export interface Env {
  DB: D1Database;
  GARDEN_ROOM: DurableObjectNamespace;
}

export { GardenRoom } from "./GardenRoom";

export default {
  async fetch(request: Request = new Request("https://worker.test/"), env: Env = {} as Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      const clientKey = request.headers.get("cf-connecting-ip") ?? "local";
      return handleApiRequest(request, env, clientKey);
    }

    const roomMatch = url.pathname.match(/^\/rooms\/([^/]+)$/);
    if (roomMatch) {
      const id = env.GARDEN_ROOM.idFromName(roomMatch[1]);
      return env.GARDEN_ROOM.get(id).fetch(request);
    }

    return new Response("Wedding game worker is running", {
      headers: { "content-type": "text/plain; charset=utf-8" }
    });
  }
};
