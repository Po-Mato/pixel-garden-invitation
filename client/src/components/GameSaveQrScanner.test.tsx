import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createGameTransferUrl, type EncryptedGameSaveEnvelope } from "../game/gameSaveTransfer";
import { GameSaveQrScanner } from "./GameSaveQrScanner";

vi.mock("@zxing/browser", () => ({
  BrowserQRCodeReader: class {
    decodeFromConstraints() {
      return Promise.reject(new Error("camera unavailable in test"));
    }
  }
}));

describe("GameSaveQrScanner", () => {
  it("앱 안에서 QR 링크를 읽어 암호화 진행 데이터로 넘긴다", () => {
    const envelope: EncryptedGameSaveEnvelope = {
      schema: "wedding-game-encrypted-save",
      version: 1,
      createdAt: "2026-07-30T00:00:00.000Z",
      iterations: 120_000,
      salt: "c2FsdA",
      iv: "aXY",
      ciphertext: "ZGF0YQ"
    };
    const onDetected = vi.fn();
    render(<GameSaveQrScanner onDetected={onDetected} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("QR 링크"), { target: { value: createGameTransferUrl(envelope, "https://example.test/") } });
    fireEvent.click(screen.getByRole("button", { name: "읽기" }));
    expect(onDetected).toHaveBeenCalledWith(envelope);
  });
});
