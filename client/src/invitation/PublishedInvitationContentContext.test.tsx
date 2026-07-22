import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildDefaultEditableInvitationContent, invitationContent } from "@wedding-game/shared";
import {
  PublishedInvitationContentProvider,
  usePublishedInvitationContent
} from "./PublishedInvitationContentContext";

const api = vi.hoisted(() => ({ fetchPublishedInvitationContent: vi.fn() }));

vi.mock("../api/invitationContentApi", () => api);

function Consumer() {
  const value = usePublishedInvitationContent();
  return (
    <div>
      <span>{value.source}</span>
      <span>{value.content.coupleMessage}</span>
      <span>{value.event.familyContacts.contacts[0].phone || "no-phone"}</span>
      <span>{value.share.description}</span>
    </div>
  );
}

describe("PublishedInvitationContentProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.fetchPublishedInvitationContent.mockResolvedValue({ content: null, revision: null, publishedAt: null });
  });

  afterEach(cleanup);

  it("공개본이 없으면 정적 콘텐츠를 즉시 사용한다", async () => {
    render(<PublishedInvitationContentProvider><Consumer /></PublishedInvitationContentProvider>);

    expect(screen.getByText("static")).toBeInTheDocument();
    expect(screen.getByText(invitationContent.content.coupleMessage)).toBeInTheDocument();
    await waitFor(() => expect(api.fetchPublishedInvitationContent).toHaveBeenCalled());
  });

  it("검증된 공개본을 소개·연락처·공유 문구에 함께 적용한다", async () => {
    const content = buildDefaultEditableInvitationContent(invitationContent.event, invitationContent.content);
    content.coupleIntroduction.together = "공개된 공동 인사말";
    content.familyContacts.contacts[0].phone = "010-1234-5678";
    content.share.description = "공개된 공유 설명";
    api.fetchPublishedInvitationContent.mockResolvedValue({
      content,
      revision: 3,
      publishedAt: "2026-07-22T00:00:00.000Z"
    });

    render(<PublishedInvitationContentProvider><Consumer /></PublishedInvitationContentProvider>);

    expect(await screen.findByText("published")).toBeInTheDocument();
    expect(screen.getByText("공개된 공동 인사말")).toBeInTheDocument();
    expect(screen.getByText("010-1234-5678")).toBeInTheDocument();
    expect(screen.getByText("공개된 공유 설명")).toBeInTheDocument();
  });

  it("공개본 요청 실패 시 정적 콘텐츠를 유지한다", async () => {
    api.fetchPublishedInvitationContent.mockRejectedValue(new Error("network"));
    render(<PublishedInvitationContentProvider><Consumer /></PublishedInvitationContentProvider>);

    await waitFor(() => expect(api.fetchPublishedInvitationContent).toHaveBeenCalled());
    expect(screen.getByText("static")).toBeInTheDocument();
    expect(screen.getByText("no-phone")).toBeInTheDocument();
  });
});
