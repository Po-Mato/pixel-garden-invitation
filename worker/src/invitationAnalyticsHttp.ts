import {
  invitationAnalyticsEventNames,
  type InvitationAnalyticsEvent,
  type InvitationAnalyticsEventName
} from "@wedding-game/shared";
import type { Env } from "./index";
import {
  analyticsLocalDate,
  getInvitationAnalytics,
  recordInvitationAnalytics
} from "./invitationAnalyticsRepository";
import { verifyAdminToken } from "./security";
import {
  getInvitationPerformanceAdminState,
  setInvitationPerformanceMode
} from "./invitationPerformanceConfig";
import { adminNotificationEmailConfigured } from "./adminNotificationEmail";
import { getDeviceQaDetailAdminState, updateDeviceQaAlertSettings } from "./deviceQaReportRepository";

const eventNames = new Set<string>(invitationAnalyticsEventNames);
const contextPattern = /^(entry|game|simple)$/;
const dimensionRules: Record<InvitationAnalyticsEventName, RegExp> = {
  visit: /^(entry|game|simple):(new|returning):(mobile|tablet|desktop)$/,
  mode_open: /^(game|simple)$/,
  directions_view: contextPattern,
  map_click: /^(naver|kakao|google)$/,
  call_click: /^(venue|family)$/,
  share_click: /^(native|copy|fallback)$/,
  calendar_click: /^(ics|google|copy)$/,
  rsvp_view: contextPattern,
  rsvp_start: contextPattern,
  rsvp_submit: contextPattern,
  guestbook_view: contextPattern,
  gallery_view: contextPattern,
  gallery_zoom: contextPattern,
  page_load: /^(mobile|tablet|desktop)$/,
  client_error: /^(script|promise|resource)$/,
  character_asset_fallback: /^[a-z0-9-]{3,40}$/,
  performance_fps: /^(standard|lite):(standard|memory|processor|network|frame-rate|battery|background)$/,
  performance_long_task: /^(mobile|tablet|desktop)$/,
  performance_quality_change: /^(standard|lite):(standard|memory|processor|network|frame-rate|battery|background)$/,
  quality_camera_center: /^(mobile|tablet|desktop):(interior|edge)$/,
  quality_cls: /^(mobile|tablet|desktop)$/,
  quality_long_frame: /^(mobile|tablet|desktop)$/,
  device_qa: /^(ios|android|other):(complete|warning|issue-(viewport|touch|storage|audio|movement|portal|feedback|layout|photo))$/
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseEvent(value: unknown): InvitationAnalyticsEvent | null {
  if (!isRecord(value) || typeof value.name !== "string" || !eventNames.has(value.name)) return null;
  if (typeof value.dimension !== "string") return null;
  const name = value.name as InvitationAnalyticsEventName;
  if (!dimensionRules[name].test(value.dimension)) return null;
  if (name === "page_load" || name === "performance_long_task") {
    if (!Number.isInteger(value.value) || (value.value as number) < 0 || (value.value as number) > 60_000) return null;
    return { name, dimension: value.dimension, value: value.value as number };
  }
  if (name === "performance_fps") {
    if (!Number.isInteger(value.value) || (value.value as number) < 1 || (value.value as number) > 120) return null;
    return { name, dimension: value.dimension, value: value.value as number };
  }
  if (name === "quality_camera_center" || name === "quality_cls" || name === "quality_long_frame") {
    if (!Number.isInteger(value.value) || (value.value as number) < 0 || (value.value as number) > 1_000) return null;
    return { name, dimension: value.dimension, value: value.value as number };
  }
  if (value.value !== undefined) return null;
  return { name, dimension: value.dimension };
}

function parseBatch(value: unknown): InvitationAnalyticsEvent[] | null {
  if (!isRecord(value) || !Array.isArray(value.events) || value.events.length < 1 || value.events.length > 16) {
    return null;
  }
  const events = value.events.map(parseEvent);
  return events.every((event): event is InvitationAnalyticsEvent => event !== null) ? events : null;
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export async function handlePublicInvitationAnalyticsRequest(
  request: Request,
  env: Env,
  invitationId: string
): Promise<Response> {
  if (request.method !== "POST") return json({ error: "not_found" }, 404);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_request" }, 400);
  }
  const events = parseBatch(body);
  if (!events) return json({ error: "invalid_request" }, 400);

  try {
    const recorded = await recordInvitationAnalytics(env.DB, invitationId, events);
    return recorded ? new Response(null, { status: 204 }) : json({ error: "not_found" }, 404);
  } catch {
    return json({ error: "internal_error" }, 500);
  }
}

export async function handleAdminInvitationAnalyticsRequest(
  request: Request,
  env: Env,
  invitationId: string
): Promise<Response> {
  if (request.method !== "GET" && request.method !== "POST") return json({ error: "not_found" }, 404);
  const token = request.headers.get("authorization")?.match(/^Bearer ([^\s]+)$/)?.[1] ?? "";
  if (!token || !env.RSVP_ADMIN_SESSION_SECRET) return json({ error: "unauthorized" }, 401);
  const session = await verifyAdminToken(token, env.RSVP_ADMIN_SESSION_SECRET, invitationId, Date.now());
  if (!session) return json({ error: "unauthorized" }, 401);

  if (request.method === "POST") {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ error: "invalid_request" }, 400);
    }
    const deviceQaAlerts = body && typeof body === "object" && "deviceQaAlerts" in body
      ? (body as { deviceQaAlerts?: unknown }).deviceQaAlerts
      : null;
    if (deviceQaAlerts && typeof deviceQaAlerts === "object") {
      const candidate = deviceQaAlerts as { emailEnabled?: unknown; warningThreshold?: unknown };
      if (typeof candidate.emailEnabled !== "boolean" || !Number.isInteger(candidate.warningThreshold) || (candidate.warningThreshold as number) < 2 || (candidate.warningThreshold as number) > 20) {
        return json({ error: "invalid_request" }, 400);
      }
      if (candidate.emailEnabled && !adminNotificationEmailConfigured(env)) return json({ error: "email_not_configured" }, 409);
      try {
        const updated = await updateDeviceQaAlertSettings(env.DB, invitationId, {
          emailEnabled: candidate.emailEnabled,
          warningThreshold: candidate.warningThreshold as number
        });
        if (!updated) return json({ error: "not_found" }, 404);
        return json(await getDeviceQaDetailAdminState(env.DB, invitationId, adminNotificationEmailConfigured(env)));
      } catch {
        return json({ error: "internal_error" }, 500);
      }
    }
    const performanceMode = body && typeof body === "object" && "performanceMode" in body
      ? (body as { performanceMode?: unknown }).performanceMode
      : null;
    if (performanceMode !== "adaptive" && performanceMode !== "safe-default") {
      return json({ error: "invalid_request" }, 400);
    }
    try {
      const performance = await setInvitationPerformanceMode(env.DB, invitationId, performanceMode);
      return performance ? json(performance) : json({ error: "not_found" }, 404);
    } catch {
      return json({ error: "internal_error" }, 500);
    }
  }

  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to") ?? analyticsLocalDate();
  if ((from !== null && !validDate(from)) || !validDate(to) || (from !== null && from > to)) {
    return json({ error: "invalid_range" }, 400);
  }

  try {
    const [result, performance, deviceQaDetail] = await Promise.all([
      getInvitationAnalytics(env.DB, invitationId, { from, to }),
      getInvitationPerformanceAdminState(env.DB, invitationId),
      getDeviceQaDetailAdminState(env.DB, invitationId, adminNotificationEmailConfigured(env))
    ]);
    return result && performance && deviceQaDetail ? json({ ...result, performance, deviceQaDetail }) : json({ error: "not_found" }, 404);
  } catch {
    return json({ error: "internal_error" }, 500);
  }
}
