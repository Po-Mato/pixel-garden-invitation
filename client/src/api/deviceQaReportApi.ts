import type { DeviceQaDetailAdminState } from "@wedding-game/shared";
import type { DeviceQaProfile } from "../invitation/deviceQaProfile";
import { WeddingApiError } from "./weddingApi";

function root() {
  const base = (import.meta.env.VITE_WORKER_URL ?? "").replace(/\/+$/, "");
  const invitationId = import.meta.env.VITE_INVITATION_ID ?? "sample-garden";
  return `${base}/api/invitations/${encodeURIComponent(invitationId)}`;
}

async function responseJson<T>(response: Response) {
  let body: unknown = null;
  try { body = await response.json(); } catch { body = null; }
  if (!response.ok) {
    const code = body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : "request_failed";
    throw new WeddingApiError(response.status, code);
  }
  return body as T;
}

export function postDeviceQaDetailReport(input: DeviceQaProfile & { status: "complete" | "warning"; issues: string[] }) {
  return fetch(`${root()}/device-qa-reports`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
    keepalive: true
  }).then(responseJson<{ accepted: true }>);
}

export function updateAdminDeviceQaAlertSettings(token: string, input: { emailEnabled: boolean; warningThreshold: number }) {
  return fetch(`${root()}/admin/analytics`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ deviceQaAlerts: input })
  }).then(responseJson<DeviceQaDetailAdminState>);
}
