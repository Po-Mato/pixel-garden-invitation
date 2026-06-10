import { MemoryRateLimiter } from "./rateLimit";
import { parseGuestbookPayload, parseRsvpPayload } from "./validation";

const writeLimiter = new MemoryRateLimiter({ limit: 10, windowMs: 60_000 });

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type"
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...corsHeaders
    }
  });
}

function id(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

async function readJson(request: Request): Promise<unknown | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function handleApiRequest(request: Request, db: D1Database, clientKey: string): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  if (!writeLimiter.allow(clientKey)) {
    return json({ error: "rate_limited" }, 429);
  }

  const url = new URL(request.url);
  const match = url.pathname.match(/^\/api\/invitations\/([^/]+)\/(rsvps|guestbook)$/);
  if (!match) {
    return json({ error: "not_found" }, 404);
  }

  const [, invitationId, resource] = match;
  const body = await readJson(request);

  if (resource === "rsvps") {
    const payload = parseRsvpPayload(body);
    if (!payload) {
      return json({ error: "invalid_request" }, 400);
    }

    await db
      .prepare(
        `INSERT INTO rsvps (id, invitation_id, guest_name, attendance, party_size, note)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(id("rsvp"), invitationId, payload.guestName, payload.attendance, payload.partySize, payload.note)
      .run();

    return json({ ok: true }, 201);
  }

  const payload = parseGuestbookPayload(body);
  if (!payload) {
    return json({ error: "invalid_request" }, 400);
  }

  await db
    .prepare(
      `INSERT INTO guestbook_messages (id, invitation_id, nickname, message)
       VALUES (?, ?, ?, ?)`
    )
    .bind(id("guestbook"), invitationId, payload.nickname, payload.message)
    .run();

  return json({ ok: true }, 201);
}
