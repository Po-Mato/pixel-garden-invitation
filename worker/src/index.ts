import { handleApiRequest } from "./http";
import { cleanupExpiredInvitationData } from "./cleanup";

export interface Env {
  DB: D1Database;
  GARDEN_ROOM: DurableObjectNamespace;
  EMAIL?: SendEmail;
  RSVP_ADMIN_PASSWORD_HASH: string;
  RSVP_ADMIN_SESSION_SECRET: string;
  RSVP_CLIENT_KEY_SECRET: string;
  RSVP_ALLOWED_ORIGINS: string;
  ADMIN_NOTIFICATION_EMAIL_TO?: string;
  ADMIN_NOTIFICATION_EMAIL_FROM?: string;
  ADMIN_NOTIFICATION_BASE_URL?: string;
}

export { GardenRoom } from "./GardenRoom";

export default {
  async fetch(
    request: Request = new Request("https://worker.test/"),
    env: Env = {} as Env,
    ctx?: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      const clientKey = request.headers.get("cf-connecting-ip") ?? "local";
      return handleApiRequest(request, env, clientKey, {
        waitUntil: ctx ? (task) => ctx.waitUntil(task) : undefined
      });
    }

    const roomMatch = url.pathname.match(/^\/rooms\/([^/]+)$/);
    if (roomMatch) {
      const id = env.GARDEN_ROOM.idFromName(roomMatch[1]);
      return env.GARDEN_ROOM.get(id).fetch(request);
    }

    return new Response("Wedding game worker is running", {
      headers: { "content-type": "text/plain; charset=utf-8" }
    });
  },

  scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): void {
    const cleanup = cleanupExpiredInvitationData(env.DB, new Date(controller.scheduledTime)).then((result) => {
      console.info(JSON.stringify({ event: "invitation_data_cleanup", ...result }));
      return result;
    });
    ctx.waitUntil(cleanup);
  }
};
