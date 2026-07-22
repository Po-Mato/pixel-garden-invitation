import { useEffect, useState } from "react";
import type { PublicInvitationInvite } from "@wedding-game/shared";
import { fetchPublicInvitationInvite } from "../api/invitationInviteLinksApi";
import {
  clearStoredInvitationInvite,
  loadStoredInvitationInvite,
  saveStoredInvitationInvite
} from "./inviteLinkStorage";

export type InvitationInviteState = {
  invite: PublicInvitationInvite | null;
  loading: boolean;
  notice: string;
};

const pendingResolutions = new Map<string, Promise<PublicInvitationInvite>>();

function resolveInvite(token: string): Promise<PublicInvitationInvite> {
  const existing = pendingResolutions.get(token);
  if (existing) return existing;
  const pending = fetchPublicInvitationInvite(token);
  pendingResolutions.set(token, pending);
  void pending.finally(() => {
    window.setTimeout(() => {
      if (pendingResolutions.get(token) === pending) pendingResolutions.delete(token);
    }, 1_000);
  }).catch(() => undefined);
  return pending;
}

function invitationId(): string {
  return import.meta.env.VITE_INVITATION_ID ?? "sample-garden";
}

function stripInviteQuery(): void {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("invite")) return;
  url.searchParams.delete("invite");
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

export function useInvitationInvite(enabled = true): InvitationInviteState {
  const id = invitationId();
  const [state, setState] = useState<InvitationInviteState>(() => ({
    invite: enabled ? loadStoredInvitationInvite(id)?.invite ?? null : null,
    loading: false,
    notice: ""
  }));

  useEffect(() => {
    if (!enabled) return;
    const queryToken = new URLSearchParams(window.location.search).get("invite");
    const stored = loadStoredInvitationInvite(id);
    const token = queryToken ?? stored?.token ?? null;
    if (!token) return;
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
      if (queryToken) stripInviteQuery();
      clearStoredInvitationInvite(id);
      setState({ invite: null, loading: false, notice: "개인 초대 정보를 확인하지 못해 일반 초대장으로 열었습니다." });
      return;
    }

    let active = true;
    setState((current) => ({ ...current, loading: true, notice: "" }));
    void resolveInvite(token).then((invite) => {
      if (!active) return;
      saveStoredInvitationInvite(id, { token, invite });
      if (queryToken) stripInviteQuery();
      setState({ invite, loading: false, notice: "" });
    }).catch((error: unknown) => {
      if (!active) return;
      if (queryToken) stripInviteQuery();
      if (error && typeof error === "object" && "status" in error && error.status === 404) {
        clearStoredInvitationInvite(id);
        setState({ invite: null, loading: false, notice: "개인 초대 정보를 확인하지 못해 일반 초대장으로 열었습니다." });
        return;
      }
      setState((current) => ({
        ...current,
        loading: false,
        notice: "개인 초대 정보를 불러오지 못했습니다. 일반 초대장은 그대로 이용할 수 있습니다."
      }));
    });
    return () => { active = false; };
  }, [enabled, id]);

  return state;
}
