import type { Env } from './index';
import { verifyAdminToken } from './security';

const OWNER_INVITATION = 'sample-garden';
const DAY = 86_400_000;
export const localDay = (date: Date) => new Date(date.getTime() + 9 * 3_600_000).toISOString().slice(0, 10);
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
const validDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;

export async function cleanupPagesReceipts(db: D1Database, now = new Date()) {
  return db.prepare('DELETE FROM pages_analytics_receipts WHERE expires_at <= ?').bind(now.toISOString()).run();
}
export async function recordBlogVisit(db: D1Database, eventId: string, now = new Date()) {
  await db.prepare(`INSERT OR IGNORE INTO pages_analytics_receipts(event_id, site, local_date, expires_at)
    VALUES (?, 'blog', ?, ?)`).bind(eventId, localDay(now), new Date(now.getTime() + DAY).toISOString()).run();
}
export async function readCommonPages(db: D1Database, from: string, to: string) {
  const config = await db.prepare("SELECT enabled_at FROM pages_analytics_config WHERE site = 'blog'").bind().first<{ enabled_at: string }>();
  const blog = await db.prepare('SELECT local_date, visits FROM pages_analytics_daily WHERE site = ? AND local_date BETWEEN ? AND ?')
    .bind('blog', from, to).all<{ local_date: string; visits: number }>();
  const wedding = await db.prepare(`SELECT local_date, SUM(event_count) AS visits FROM invitation_analytics_daily
    WHERE invitation_id = ? AND event_name = 'visit' AND local_date BETWEEN ? AND ? GROUP BY local_date`)
    .bind(OWNER_INVITATION, from, to).all<{ local_date: string; visits: number }>();
  const first = await db.prepare("SELECT MIN(local_date) AS day FROM invitation_analytics_daily WHERE invitation_id = ? AND event_name = 'visit'")
    .bind(OWNER_INVITATION).first<{ day: string | null }>();
  const blogStart = config ? localDay(new Date(config.enabled_at)) : null;
  const blogMap = new Map(blog.results.map(r => [r.local_date, r.visits]));
  const weddingMap = new Map(wedding.results.map(r => [r.local_date, r.visits]));
  const days = [];
  for (let time = Date.parse(from); time <= Date.parse(to); time += DAY) {
    const day = new Date(time).toISOString().slice(0, 10);
    const b = blogStart && day >= blogStart ? blogMap.get(day) ?? 0 : null;
    const w = first?.day && day >= first.day ? weddingMap.get(day) ?? 0 : null;
    days.push({ day, blog: b, wedding: w, recordedTotal: (b ?? 0) + (w ?? 0), complete: b !== null && w !== null });
  }
  return { from, to, timezone: 'Asia/Seoul', blogEnabledAt: config?.enabled_at ?? null,
    weddingFirstRecordedDay: first?.day ?? null, days,
    totals: { blog: days.reduce((s, d) => s + (d.blog ?? 0), 0), wedding: days.reduce((s, d) => s + (d.wedding ?? 0), 0),
      recordedTotal: days.reduce((s, d) => s + d.recordedTotal, 0), complete: days.every(d => d.complete) } };
}
export async function handleCommonPages(request: Request, env: Env, invitationId?: string): Promise<Response> {
  if (invitationId === undefined) {
    if (request.method !== 'POST') return json({ error: 'not_found' }, 404);
    if (request.headers.get('origin') !== 'https://po-mato.github.io') return json({ error: 'forbidden_origin' }, 403);
    // Do not inspect or persist URL, Referer, IP, User-Agent, or client identity.
    const reader = request.body?.getReader();
    if (!reader) return json({ error: 'invalid_request' }, 400);
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > 256) { await reader.cancel(); return json({ error: 'invalid_request' }, 400); }
        chunks.push(chunk.value);
      }
    } catch { return json({ error: 'invalid_request' }, 400); }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const text = new TextDecoder().decode(bytes);
    let body: { site?: unknown; event?: unknown; eventId?: unknown };
    try { body = JSON.parse(text); } catch { return json({ error: 'invalid_request' }, 400); }
    if (!body || typeof body !== 'object' || Object.keys(body).sort().join(',') !== 'event,eventId,site'
      || body.site !== 'blog' || body.event !== 'visit' || typeof body.eventId !== 'string'
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(body.eventId)) return json({ error: 'invalid_request' }, 400);
    try { await recordBlogVisit(env.DB, body.eventId); return new Response(null, { status: 204 }); }
    catch { return json({ error: 'unavailable' }, 503); }
  }
  if (request.method !== 'GET') return json({ error: 'not_found' }, 404);
  const token = request.headers.get('authorization')?.match(/^Bearer ([^\s]+)$/)?.[1];
  if (invitationId !== OWNER_INVITATION || !token || !env.RSVP_ADMIN_SESSION_SECRET
    || !await verifyAdminToken(token, env.RSVP_ADMIN_SESSION_SECRET, OWNER_INVITATION, Date.now())) return json({ error: 'unauthorized' }, 401);
  const url = new URL(request.url), to = url.searchParams.get('to') ?? localDay(new Date());
  if (!validDay(to)) return json({ error: 'invalid_range' }, 400);
  const from = url.searchParams.get('from') ?? new Date(Date.parse(to) - 29 * DAY).toISOString().slice(0, 10);
  if (!validDay(from) || !validDay(to) || from > to || Date.parse(to) - Date.parse(from) > 729 * DAY) return json({ error: 'invalid_range' }, 400);
  try { return json(await readCommonPages(env.DB, from, to)); } catch { return json({ error: 'unavailable' }, 503); }
}
