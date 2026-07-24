import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadGuestbookFormDraft, saveGuestbookFormDraft } from "../invitation/publicFormDraftStorage";
import { loadGuestbookSendQueue } from "../invitation/publicFormQueueStorage";
import { installMemoryLocalStorage } from "../test/memoryStorage";
import { GuestbookPanel } from "./GuestbookPanel";

beforeEach(() => {
  installMemoryLocalStorage();
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
});

afterEach(() => {
  cleanup();
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
});

const callbacks = () => ({
  onCreate: vi.fn().mockResolvedValue(undefined),
  onUpdate: vi.fn().mockResolvedValue(undefined),
  onDelete: vi.fn().mockResolvedValue(undefined),
  onLoadMore: vi.fn().mockResolvedValue(undefined),
  onRetry: vi.fn().mockResolvedValue(undefined)
});

function renderPanel(overrides: Partial<React.ComponentProps<typeof GuestbookPanel>> = {}) {
  const actions = callbacks();
  render(<GuestbookPanel
    nickname="하객1"
    messages={[]}
    ownedMessage={null}
    ownerError=""
    nextCursor={null}
    isLoading={false}
    isLoadingMore={false}
    listError=""
    {...actions}
    {...overrides}
  />);
  return actions;
}

const ownedMessage = {
  id: "guestbook_1",
  nickname: "하객1",
  message: "축하합니다",
  isHidden: false,
  revision: 1,
  createdAt: "2026-07-21T00:00:00.000Z",
  updatedAt: "2026-07-21T00:00:00.000Z"
};

describe("GuestbookPanel", () => {
  it("오프라인 메시지를 전송 대기함에 저장한다", async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    const actions = renderPanel();
    fireEvent.change(screen.getByRole("textbox", { name: "축하 메시지" }), { target: { value: "연결되면 보낼게요" } });

    fireEvent.click(screen.getByRole("button", { name: "전송 대기함에 저장" }));
    await waitFor(() => expect(loadGuestbookSendQueue("sample-garden")?.value.message).toBe("연결되면 보낼게요"));
    expect(actions.onCreate).not.toHaveBeenCalled();
    expect(screen.getByLabelText("축하 메시지 전송 대기함")).toHaveTextContent("연결되면 안전하게");
  });

  it("복원한 메시지 임시 저장을 확인하고 삭제할 수 있다", () => {
    saveGuestbookFormDraft(
      "sample-garden",
      { nickname: "임시 이름", message: "임시 축하" },
      undefined,
      new Date("2027-04-20T03:30:00.000Z")
    );
    renderPanel();

    expect(screen.getByRole("textbox", { name: "축하 메시지" })).toHaveValue("임시 축하");
    expect(screen.getByText(/7일간 보관/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "임시 저장 삭제" }));
    expect(screen.getByRole("textbox", { name: "이름 또는 닉네임" })).toHaveValue("하객1");
    expect(screen.getByRole("textbox", { name: "축하 메시지" })).toHaveValue("");
    expect(loadGuestbookFormDraft("sample-garden")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("임시 저장을 삭제했습니다");
  });

  it("작성한 내용을 정리해 전송하고 같은 기기 수정 안내를 표시한다", async () => {
    const actions = renderPanel();
    fireEvent.change(screen.getByRole("textbox", { name: "축하 메시지" }), { target: { value: "  축하합니다  " } });
    fireEvent.click(screen.getByRole("button", { name: "메시지 남기기" }));

    await waitFor(() => expect(actions.onCreate).toHaveBeenCalledWith({
      nickname: "하객1",
      message: "축하합니다"
    }));
    expect(screen.getByRole("status")).toHaveTextContent("이 기기에서 수정하거나 삭제할 수 있습니다.");
  });

  it("전송 실패 시 입력 내용을 유지한다", async () => {
    const onCreate = vi.fn().mockRejectedValue(new Error("network"));
    renderPanel({ onCreate });
    fireEvent.change(screen.getByRole("textbox", { name: "축하 메시지" }), { target: { value: "지워지면 안 되는 축하" } });
    fireEvent.click(screen.getByRole("button", { name: "메시지 남기기" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("작성한 내용은 그대로 유지됩니다.");
    expect(screen.getByRole("textbox", { name: "축하 메시지" })).toHaveValue("지워지면 안 되는 축하");
  });

  it("소유 메시지를 수정하고 삭제 확인 후 삭제한다", async () => {
    const actions = renderPanel({ ownedMessage });
    fireEvent.click(screen.getByRole("button", { name: "수정" }));
    fireEvent.change(screen.getByRole("textbox", { name: "축하 메시지" }), { target: { value: "수정한 축하" } });
    fireEvent.click(screen.getByRole("button", { name: "수정 저장" }));
    await waitFor(() => expect(actions.onUpdate).toHaveBeenCalledWith({
      nickname: "하객1",
      message: "수정한 축하",
      revision: 1
    }));

    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    expect(screen.getByText("이 메시지를 삭제할까요?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    await waitFor(() => expect(actions.onDelete).toHaveBeenCalledOnce());
  });

  it("다음 커서가 있으면 더 보기를 요청한다", () => {
    const actions = renderPanel({
      messages: [{ ...ownedMessage, id: "guestbook_2" }],
      nextCursor: "cursor"
    });
    fireEvent.click(screen.getByRole("button", { name: "메시지 더 보기" }));
    expect(actions.onLoadMore).toHaveBeenCalledOnce();
  });
});
