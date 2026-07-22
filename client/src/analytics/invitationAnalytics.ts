import type {
  InvitationAnalyticsEvent,
  InvitationAnalyticsEventName
} from "@wedding-game/shared";
import {
  invitationAnalyticsEventsUrl,
  postInvitationAnalyticsEvents
} from "../api/invitationAnalyticsApi";

export type AnalyticsContext = "entry" | "game" | "simple";
type DeviceType = "mobile" | "tablet" | "desktop";

const FLUSH_DELAY_MS = 300;
const MAX_BATCH_SIZE = 16;
let context: AnalyticsContext = "entry";
let started = false;
let queue: InvitationAnalyticsEvent[] = [];
let flushTimer: number | null = null;

function invitationId(): string {
  return import.meta.env.VITE_INVITATION_ID ?? "sample-garden";
}

function deviceType(): DeviceType {
  if (typeof window === "undefined") return "desktop";
  if (window.innerWidth < 768) return "mobile";
  if (window.innerWidth < 1100) return "tablet";
  return "desktop";
}

function storage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

function scheduleFlush(): void {
  if (typeof window === "undefined" || flushTimer !== null) return;
  flushTimer = window.setTimeout(() => {
    flushTimer = null;
    void flushInvitationAnalytics();
  }, FLUSH_DELAY_MS);
}

export function analyticsContext(): AnalyticsContext {
  return context;
}

export function setAnalyticsContext(next: AnalyticsContext): void {
  context = next;
}

export function trackInvitationAnalytics(
  name: InvitationAnalyticsEventName,
  dimension: string,
  value?: number
): void {
  queue.push({ name, dimension, ...(value === undefined ? {} : { value }) });
  if (queue.length >= MAX_BATCH_SIZE) void flushInvitationAnalytics();
  else scheduleFlush();
}

export function trackAnalyticsContextEvent(
  name: Extract<InvitationAnalyticsEventName,
    "directions_view" | "rsvp_view" | "rsvp_start" | "rsvp_submit" |
    "guestbook_view" | "gallery_view" | "gallery_zoom">
): void {
  trackInvitationAnalytics(name, context);
}

export function trackAnalyticsModeOpen(mode: "game" | "simple"): void {
  setAnalyticsContext(mode);
  trackInvitationAnalytics("mode_open", mode);
}

export async function flushInvitationAnalytics(): Promise<void> {
  if (flushTimer !== null && typeof window !== "undefined") {
    window.clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (queue.length === 0) return;
  const events = queue.splice(0, MAX_BATCH_SIZE);
  try {
    await postInvitationAnalyticsEvents({ events });
  } catch {
    // Analytics must never interrupt the invitation experience.
  }
  if (queue.length > 0) scheduleFlush();
}

function flushWithBeacon(): void {
  if (queue.length === 0 || typeof navigator.sendBeacon !== "function") {
    void flushInvitationAnalytics();
    return;
  }
  const events = queue.splice(0, MAX_BATCH_SIZE);
  const sent = navigator.sendBeacon(invitationAnalyticsEventsUrl(), JSON.stringify({ events }));
  if (!sent) queue.unshift(...events);
  if (queue.length > 0) void flushInvitationAnalytics();
}

function reportPageLoad(): void {
  const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  const duration = navigation?.duration && navigation.duration > 0 ? navigation.duration : performance.now();
  trackInvitationAnalytics("page_load", deviceType(), Math.min(60_000, Math.max(0, Math.round(duration))));
}

export function startInvitationAnalytics(initialContext: AnalyticsContext): void {
  if (started || typeof window === "undefined") return;
  started = true;
  context = initialContext;

  const visitedKey = `wedding:analytics:visited:${invitationId()}`;
  const localStorage = storage();
  const returning = localStorage?.getItem(visitedKey) === "1";
  trackInvitationAnalytics("visit", `${context}:${returning ? "returning" : "new"}:${deviceType()}`);
  if (context === "simple") trackInvitationAnalytics("mode_open", "simple");
  try {
    localStorage?.setItem(visitedKey, "1");
  } catch {
    // Storage can be unavailable in private browsing modes.
  }

  window.addEventListener("error", (event) => {
    trackInvitationAnalytics("client_error", event.target && event.target !== window ? "resource" : "script");
  }, true);
  window.addEventListener("unhandledrejection", () => {
    trackInvitationAnalytics("client_error", "promise");
  });
  window.addEventListener("pagehide", flushWithBeacon);

  if (document.readyState === "complete") window.setTimeout(reportPageLoad, 0);
  else window.addEventListener("load", reportPageLoad, { once: true });
}

export function observeAnalyticsSections(
  sections: ReadonlyArray<{ id: string; event: "directions_view" | "rsvp_view" | "guestbook_view" | "gallery_view" }>
): () => void {
  if (typeof IntersectionObserver !== "function") return () => undefined;
  const seen = new Set<string>();
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting || entry.intersectionRatio < 0.15 || seen.has(entry.target.id)) continue;
      const section = sections.find(({ id }) => id === entry.target.id);
      if (!section) continue;
      seen.add(section.id);
      trackAnalyticsContextEvent(section.event);
      observer.unobserve(entry.target);
    }
  }, { threshold: [0.15] });
  for (const section of sections) {
    const element = document.getElementById(section.id);
    if (element) observer.observe(element);
  }
  return () => observer.disconnect();
}
