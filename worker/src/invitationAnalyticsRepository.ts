import type {
  InvitationAnalyticsAdminResult,
  InvitationAnalyticsBreakdown,
  InvitationAnalyticsEvent
} from "@wedding-game/shared";

type AnalyticsRow = {
  local_date: string;
  event_name: InvitationAnalyticsEvent["name"];
  dimension: string;
  event_count: number;
  value_sum: number;
};

type RsvpDailyRow = {
  local_date: string;
  response_count: number;
  attending_guests: number;
};

type GuestbookDailyRow = {
  local_date: string;
  message_count: number;
};

type FirstDateRow = { first_date: string | null };

const DAY_MS = 86_400_000;
const MAX_RANGE_DAYS = 730;

function localDate(date: Date): string {
  return new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function dateValue(value: string): number {
  return Date.parse(`${value}T00:00:00.000Z`);
}

function addDays(value: string, days: number): string {
  return new Date(dateValue(value) + days * DAY_MS).toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  return Math.floor((dateValue(to) - dateValue(from)) / DAY_MS) + 1;
}

function increment(target: Map<string, number>, key: string, count: number): void {
  target.set(key, (target.get(key) ?? 0) + count);
}

function breakdown(target: Map<string, number>): InvitationAnalyticsBreakdown[] {
  return [...target.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key));
}

export function analyticsLocalDate(now = new Date()): string {
  return localDate(now);
}

export async function recordInvitationAnalytics(
  db: D1Database,
  invitationId: string,
  events: readonly InvitationAnalyticsEvent[],
  now = new Date()
): Promise<boolean> {
  const invitation = await db.prepare("SELECT id FROM invitations WHERE id = ?")
    .bind(invitationId)
    .first<{ id: string }>();
  if (!invitation) return false;

  const consolidated = new Map<string, { event: InvitationAnalyticsEvent; count: number; valueSum: number }>();
  for (const event of events) {
    const key = `${event.name}\u0000${event.dimension}`;
    const current = consolidated.get(key);
    if (current) {
      current.count += 1;
      current.valueSum += event.value ?? 0;
    } else {
      consolidated.set(key, { event, count: 1, valueSum: event.value ?? 0 });
    }
  }

  const occurredOn = localDate(now);
  const updatedAt = now.toISOString();
  const statements = [...consolidated.values()].map(({ event, count, valueSum }) => db.prepare(`
    INSERT INTO invitation_analytics_daily (
      invitation_id, local_date, event_name, dimension, event_count, value_sum, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (invitation_id, local_date, event_name, dimension)
    DO UPDATE SET
      event_count = event_count + excluded.event_count,
      value_sum = value_sum + excluded.value_sum,
      updated_at = excluded.updated_at
  `).bind(invitationId, occurredOn, event.name, event.dimension, count, valueSum, updatedAt));
  if (statements.length > 0) await db.batch(statements);
  return true;
}

async function earliestAvailableDate(db: D1Database, invitationId: string): Promise<string | null> {
  const row = await db.prepare(`
    SELECT MIN(day) AS first_date
    FROM (
      SELECT MIN(local_date) AS day
      FROM invitation_analytics_daily
      WHERE invitation_id = ?
      UNION ALL
      SELECT MIN(date(datetime(created_at, '+9 hours'))) AS day
      FROM rsvps
      WHERE invitation_id = ?
      UNION ALL
      SELECT MIN(date(datetime(created_at, '+9 hours'))) AS day
      FROM guestbook_messages
      WHERE invitation_id = ?
    )
  `).bind(invitationId, invitationId, invitationId).first<FirstDateRow>();
  return row?.first_date ?? null;
}

function normalizeRange(from: string | null, to: string, earliest: string | null): { from: string; to: string; days: number } {
  let normalizedFrom = from ?? earliest ?? addDays(to, -29);
  if (normalizedFrom > to) normalizedFrom = to;
  if (daysBetween(normalizedFrom, to) > MAX_RANGE_DAYS) {
    normalizedFrom = addDays(to, -(MAX_RANGE_DAYS - 1));
  }
  return { from: normalizedFrom, to, days: daysBetween(normalizedFrom, to) };
}

export async function getInvitationAnalytics(
  db: D1Database,
  invitationId: string,
  input: { from: string | null; to: string; now?: Date }
): Promise<InvitationAnalyticsAdminResult | null> {
  const invitation = await db.prepare("SELECT id FROM invitations WHERE id = ?")
    .bind(invitationId)
    .first<{ id: string }>();
  if (!invitation) return null;

  const earliest = input.from ? null : await earliestAvailableDate(db, invitationId);
  const range = normalizeRange(input.from, input.to, earliest);
  const analytics = await db.prepare(`
    SELECT local_date, event_name, dimension, event_count, value_sum
    FROM invitation_analytics_daily
    WHERE invitation_id = ? AND local_date BETWEEN ? AND ?
    ORDER BY local_date ASC
  `).bind(invitationId, range.from, range.to).all<AnalyticsRow>();
  const rsvps = await db.prepare(`
    SELECT
      date(datetime(created_at, '+9 hours')) AS local_date,
      COUNT(*) AS response_count,
      COALESCE(SUM(CASE WHEN attendance = 'yes' THEN party_size ELSE 0 END), 0) AS attending_guests
    FROM rsvps
    WHERE invitation_id = ?
      AND date(datetime(created_at, '+9 hours')) BETWEEN ? AND ?
    GROUP BY local_date
    ORDER BY local_date ASC
  `).bind(invitationId, range.from, range.to).all<RsvpDailyRow>();
  const guestbook = await db.prepare(`
    SELECT
      date(datetime(created_at, '+9 hours')) AS local_date,
      COUNT(*) AS message_count
    FROM guestbook_messages
    WHERE invitation_id = ?
      AND date(datetime(created_at, '+9 hours')) BETWEEN ? AND ?
    GROUP BY local_date
    ORDER BY local_date ASC
  `).bind(invitationId, range.from, range.to).all<GuestbookDailyRow>();

  const daily = new Map<string, InvitationAnalyticsAdminResult["daily"][number]>();
  for (let day = range.from; day <= range.to; day = addDays(day, 1)) {
    daily.set(day, {
      date: day,
      visits: 0,
      returningVisits: 0,
      gameEntries: 0,
      simpleEntries: 0,
      rsvpResponses: 0,
      guestbookMessages: 0,
      shares: 0,
      clientErrors: 0
    });
  }

  const totals: InvitationAnalyticsAdminResult["totals"] = {
    visits: 0,
    returningVisits: 0,
    gameEntries: 0,
    simpleEntries: 0,
    directionsViews: 0,
    mapClicks: 0,
    callClicks: 0,
    shareClicks: 0,
    calendarClicks: 0,
    rsvpViews: 0,
    rsvpStarts: 0,
    rsvpSubmits: 0,
    rsvpResponses: 0,
    attendingGuests: 0,
    guestbookViews: 0,
    guestbookMessages: 0,
    galleryViews: 0,
    galleryZooms: 0,
    clientErrors: 0,
    pageLoadSamples: 0,
    averagePageLoadMs: null
  };
  const devices = new Map<string, number>();
  const modes = new Map<string, number>();
  const maps = new Map<string, number>();
  const shares = new Map<string, number>();
  const calendars = new Map<string, number>();
  let pageLoadValueSum = 0;

  for (const row of analytics.results) {
    const item = daily.get(row.local_date);
    if (!item) continue;
    const count = row.event_count;
    switch (row.event_name) {
      case "visit": {
        totals.visits += count;
        item.visits += count;
        const [, visitorKind, device] = row.dimension.split(":");
        if (visitorKind === "returning") {
          totals.returningVisits += count;
          item.returningVisits += count;
        }
        if (device) increment(devices, device, count);
        break;
      }
      case "mode_open":
        increment(modes, row.dimension, count);
        if (row.dimension === "game") {
          totals.gameEntries += count;
          item.gameEntries += count;
        } else if (row.dimension === "simple") {
          totals.simpleEntries += count;
          item.simpleEntries += count;
        }
        break;
      case "directions_view": totals.directionsViews += count; break;
      case "map_click": totals.mapClicks += count; increment(maps, row.dimension, count); break;
      case "call_click": totals.callClicks += count; break;
      case "share_click":
        totals.shareClicks += count;
        item.shares += count;
        increment(shares, row.dimension, count);
        break;
      case "calendar_click": totals.calendarClicks += count; increment(calendars, row.dimension, count); break;
      case "rsvp_view": totals.rsvpViews += count; break;
      case "rsvp_start": totals.rsvpStarts += count; break;
      case "rsvp_submit": totals.rsvpSubmits += count; break;
      case "guestbook_view": totals.guestbookViews += count; break;
      case "gallery_view": totals.galleryViews += count; break;
      case "gallery_zoom": totals.galleryZooms += count; break;
      case "page_load":
        totals.pageLoadSamples += count;
        pageLoadValueSum += row.value_sum;
        break;
      case "client_error":
        totals.clientErrors += count;
        item.clientErrors += count;
        break;
    }
  }

  for (const row of rsvps.results) {
    totals.rsvpResponses += row.response_count;
    totals.attendingGuests += row.attending_guests;
    const item = daily.get(row.local_date);
    if (item) item.rsvpResponses += row.response_count;
  }
  for (const row of guestbook.results) {
    totals.guestbookMessages += row.message_count;
    const item = daily.get(row.local_date);
    if (item) item.guestbookMessages += row.message_count;
  }
  if (totals.pageLoadSamples > 0) {
    totals.averagePageLoadMs = Math.round(pageLoadValueSum / totals.pageLoadSamples);
  }

  return {
    range,
    totals,
    daily: [...daily.values()],
    breakdowns: {
      devices: breakdown(devices),
      modes: breakdown(modes),
      maps: breakdown(maps),
      shares: breakdown(shares),
      calendars: breakdown(calendars)
    },
    generatedAt: (input.now ?? new Date()).toISOString()
  };
}
