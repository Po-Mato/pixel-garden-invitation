import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resetPwaClientForTests, startPwaClient } from "../pwa/pwaClient";
import { PwaStatusCenter } from "./PwaStatusCenter";

afterEach(() => {
  cleanup();
  resetPwaClientForTests();
  Reflect.deleteProperty(navigator, "serviceWorker");
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  window.sessionStorage.clear();
});

describe("PwaStatusCenter", () => {
  async function failOfflinePreparation() {
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        addEventListener: vi.fn(),
        register: vi.fn(async () => { throw new Error("temporary registration failure"); })
      }
    });
    await startPwaClient(true, "./");
  }

  it("announces offline mode and then a recovered connection", () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    render(<PwaStatusCenter playing={false} showInstall={false} />);

    fireEvent(window, new Event("offline"));
    expect(screen.getByRole("status")).toHaveTextContent("오프라인 모드");

    fireEvent(window, new Event("online"));
    expect(screen.getByRole("status")).toHaveTextContent("연결이 복구됐어요");
  });

  it("offers the native home-screen prompt only on the entry screen", async () => {
    const prompt = vi.fn(async () => undefined);
    const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
      prompt,
      userChoice: Promise.resolve({ outcome: "accepted" as const })
    });
    const rendered = render(<PwaStatusCenter playing={false} showInstall />);

    fireEvent(window, event);
    fireEvent.click(screen.getByRole("button", { name: "홈 화면에 추가" }));

    await waitFor(() => expect(prompt).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.queryByRole("button", { name: "홈 화면에 추가" })).not.toBeInTheDocument());

    rendered.rerender(<PwaStatusCenter playing showInstall={false} />);
    expect(screen.queryByText("웨딩 가든 설치")).not.toBeInTheDocument();
  });

  it("allows the optional install offer to be dismissed for the session", () => {
    const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
      prompt: vi.fn(async () => undefined),
      userChoice: Promise.resolve({ outcome: "dismissed" as const })
    });
    render(<PwaStatusCenter playing={false} showInstall />);

    fireEvent(window, event);
    fireEvent.click(screen.getByRole("button", { name: "설치 안내 닫기" }));

    expect(screen.queryByText("웨딩 가든 설치")).not.toBeInTheDocument();
    expect(window.sessionStorage.getItem("wedding-garden:pwa-install-dismissed:v1")).toBe("true");
  });

  it("keeps an offline-save failure secondary to the usable invitation", async () => {
    await failOfflinePreparation();
    render(<PwaStatusCenter playing={false} showInstall />);

    expect(screen.getByRole("status")).toHaveTextContent("오프라인 저장은 아직 준비 중이에요");
    expect(screen.getByRole("status")).toHaveTextContent("초대장과 게임은 지금 그대로 이용할 수 있어요");
    expect(screen.queryByText("연결 상태를 확인해 주세요")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "오프라인 저장 안내 닫기" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("does not overlay offline-save preparation errors while the guest is playing", async () => {
    await failOfflinePreparation();
    render(<PwaStatusCenter playing showInstall={false} />);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
