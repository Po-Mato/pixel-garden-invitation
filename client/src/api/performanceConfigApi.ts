import type { InvitationPerformanceConfig } from "@wedding-game/shared";

function apiBase(): string {
  return (import.meta.env.VITE_WORKER_URL ?? "").replace(/\/+$/, "");
}

function invitationId(): string {
  return import.meta.env.VITE_INVITATION_ID ?? "sample-garden";
}

export async function fetchInvitationPerformanceConfig(): Promise<InvitationPerformanceConfig> {
  const response = await fetch(
    `${apiBase()}/api/invitations/${invitationId()}/performance-config`,
    { method: "GET", headers: { accept: "application/json" } }
  );
  if (!response.ok) throw new Error("performance_config_unavailable");
  return response.json() as Promise<InvitationPerformanceConfig>;
}
