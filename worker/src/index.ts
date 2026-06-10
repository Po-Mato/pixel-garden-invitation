export interface Env {
  DB: D1Database;
  GARDEN_ROOM: DurableObjectNamespace;
}

export { GardenRoom } from "./GardenRoom";

export default {
  async fetch(): Promise<Response> {
    return new Response("Wedding game worker is running", {
      headers: { "content-type": "text/plain; charset=utf-8" }
    });
  }
};
