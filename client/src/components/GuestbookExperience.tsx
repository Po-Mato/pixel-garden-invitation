import { useEffect, useState } from "react";
import {
  type GuestbookCredential,
  type GuestbookOwnedMessage,
  type GuestbookPage,
  type GuestbookSubmission
} from "@wedding-game/shared";
import {
  createGuestbook,
  deleteOwnedGuestbook,
  fetchGuestbookPage,
  fetchOwnedGuestbook,
  updateOwnedGuestbook,
  WeddingApiError
} from "../api/weddingApi";
import {
  clearGuestbookCredential,
  loadGuestbookCredential,
  saveGuestbookCredential
} from "../invitation/guestbookStorage";
import { GuestbookPanel } from "./GuestbookPanel";

type GuestbookExperienceProps = {
  nickname?: string;
};

export function GuestbookExperience({ nickname = "" }: GuestbookExperienceProps) {
  const invitationId = import.meta.env.VITE_INVITATION_ID ?? "sample-garden";
  const [guestbookPage, setGuestbookPage] = useState<GuestbookPage>({ messages: [], nextCursor: null });
  const [guestbookCredential, setGuestbookCredential] = useState<GuestbookCredential | null>(null);
  const [ownedGuestbook, setOwnedGuestbook] = useState<GuestbookOwnedMessage | null>(null);
  const [guestbookLoading, setGuestbookLoading] = useState(false);
  const [guestbookLoadingMore, setGuestbookLoadingMore] = useState(false);
  const [guestbookListError, setGuestbookListError] = useState("");
  const [guestbookOwnerError, setGuestbookOwnerError] = useState("");

  useEffect(() => {
    let active = true;
    const credential = loadGuestbookCredential(invitationId);
    setGuestbookCredential(credential);
    setGuestbookLoading(true);
    setGuestbookListError("");
    setGuestbookOwnerError("");

    const loadPage = fetchGuestbookPage();
    const loadOwned = credential ? fetchOwnedGuestbook(credential) : Promise.resolve(null);
    void Promise.allSettled([loadPage, loadOwned]).then(([pageResult, ownedResult]) => {
      if (!active) return;
      if (pageResult.status === "fulfilled") setGuestbookPage(pageResult.value);
      else {
        setGuestbookPage({ messages: [], nextCursor: null });
        setGuestbookListError("축하 메시지를 불러오지 못했습니다.");
      }

      if (ownedResult.status === "fulfilled") {
        setOwnedGuestbook(ownedResult.value);
      } else if (ownedResult.reason instanceof WeddingApiError
        && [401, 404].includes(ownedResult.reason.status)) {
        clearGuestbookCredential(invitationId);
        setGuestbookCredential(null);
        setOwnedGuestbook(null);
      } else {
        setGuestbookOwnerError("이 기기에 저장된 내 메시지를 확인하지 못했습니다. 새 메시지를 작성하지 않고 다시 확인해 주세요.");
      }
      setGuestbookLoading(false);
    });

    return () => {
      active = false;
    };
  }, [invitationId]);

  async function refreshGuestbookPage(): Promise<void> {
    try {
      setGuestbookPage(await fetchGuestbookPage());
      setGuestbookListError("");
    } catch {
      setGuestbookListError("축하 메시지를 불러오지 못했습니다.");
    }
  }

  async function handleGuestbookCreate(payload: GuestbookSubmission): Promise<void> {
    const result = await createGuestbook(payload);
    saveGuestbookCredential(invitationId, result.credential);
    setGuestbookCredential(result.credential);
    setOwnedGuestbook(result.response);
    await refreshGuestbookPage();
  }

  async function handleGuestbookUpdate(payload: GuestbookSubmission & { revision: number }): Promise<void> {
    if (!guestbookCredential) throw new Error("Guestbook credential is missing");
    const updated = await updateOwnedGuestbook(guestbookCredential, payload);
    setOwnedGuestbook(updated);
    await refreshGuestbookPage();
  }

  async function handleGuestbookDelete(): Promise<void> {
    if (!guestbookCredential) throw new Error("Guestbook credential is missing");
    await deleteOwnedGuestbook(guestbookCredential);
    clearGuestbookCredential(invitationId);
    setGuestbookCredential(null);
    setOwnedGuestbook(null);
    await refreshGuestbookPage();
  }

  async function handleGuestbookLoadMore(): Promise<void> {
    if (!guestbookPage.nextCursor || guestbookLoadingMore) return;
    setGuestbookLoadingMore(true);
    try {
      const nextPage = await fetchGuestbookPage(guestbookPage.nextCursor);
      setGuestbookPage((current) => {
        const knownIds = new Set(current.messages.map(({ id }) => id));
        return {
          messages: [...current.messages, ...nextPage.messages.filter(({ id }) => !knownIds.has(id))],
          nextCursor: nextPage.nextCursor
        };
      });
      setGuestbookListError("");
    } catch {
      setGuestbookListError("다음 축하 메시지를 불러오지 못했습니다.");
    } finally {
      setGuestbookLoadingMore(false);
    }
  }

  async function handleGuestbookRetry(): Promise<void> {
    setGuestbookLoading(true);
    setGuestbookOwnerError("");
    const credential = guestbookCredential ?? loadGuestbookCredential(invitationId);
    const [pageResult, ownedResult] = await Promise.allSettled([
      fetchGuestbookPage(),
      credential ? fetchOwnedGuestbook(credential) : Promise.resolve(null)
    ]);
    if (pageResult.status === "fulfilled") {
      setGuestbookPage(pageResult.value);
      setGuestbookListError("");
    } else {
      setGuestbookListError("축하 메시지를 불러오지 못했습니다.");
    }
    if (ownedResult.status === "fulfilled") {
      setOwnedGuestbook(ownedResult.value);
    } else if (ownedResult.reason instanceof WeddingApiError && [401, 404].includes(ownedResult.reason.status)) {
      clearGuestbookCredential(invitationId);
      setGuestbookCredential(null);
      setOwnedGuestbook(null);
    } else {
      setGuestbookOwnerError("이 기기에 저장된 내 메시지를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    }
    setGuestbookLoading(false);
  }

  return (
    <GuestbookPanel
      nickname={nickname}
      messages={guestbookPage.messages}
      ownedMessage={ownedGuestbook}
      ownerError={guestbookOwnerError}
      nextCursor={guestbookPage.nextCursor}
      isLoading={guestbookLoading}
      isLoadingMore={guestbookLoadingMore}
      listError={guestbookListError}
      onCreate={handleGuestbookCreate}
      onUpdate={handleGuestbookUpdate}
      onDelete={handleGuestbookDelete}
      onLoadMore={handleGuestbookLoadMore}
      onRetry={handleGuestbookRetry}
    />
  );
}
