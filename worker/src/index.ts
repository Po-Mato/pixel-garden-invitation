import { handleApiRequest } from "./http";
import { cleanupExpiredInvitationData } from "./cleanup";
import { retryPendingAdminNotificationEmails } from "./adminNotificationService";
import { handlePublishedGalleryMediaRequest } from "./invitationGalleryHttp";
import { publishDueInvitationReleases } from "./invitationReleaseRepository";

export interface Env {
  DB: D1Database;
  WEDDING_MEDIA?: KVNamespace;
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
    const galleryMediaMatch = url.pathname.match(/^\/media\/invitations\/([^/]+)\/gallery\/([0-9a-f-]+)-(640|1024)\.webp$/);
    if (galleryMediaMatch) {
      return handlePublishedGalleryMediaRequest(
        request,
        env,
        galleryMediaMatch[1],
        galleryMediaMatch[2],
        Number(galleryMediaMatch[3]) as 640 | 1024
      );
    }
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
    const now = new Date(controller.scheduledTime);
    const work = (async () => {
      const emailQueue = await retryPendingAdminNotificationEmails(env, now);
      console.info(JSON.stringify({ event: "admin_notification_email_queue", ...emailQueue }));

      const invitationReleases = await publishDueInvitationReleases(env.DB, now);
      console.info(JSON.stringify({ event: "invitation_release_queue", ...invitationReleases }));

      if (controller.cron === "17 15 * * *" || !controller.cron) {
        const cleanup = await cleanupExpiredInvitationData(env.DB, now);
        console.info(JSON.stringify({ event: "invitation_data_cleanup", ...cleanup }));
        return { emailQueue, invitationReleases, cleanup };
      }

      return { emailQueue, invitationReleases, cleanup: null };
    })();
    ctx.waitUntil(work);
  }
};
