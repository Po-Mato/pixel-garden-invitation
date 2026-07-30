import { webcrypto } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  createCompactGameSaveBackup,
  createGameTransferUrl,
  decodeGameTransferEnvelope,
  decryptGameSaveBackup,
  encodeGameTransferEnvelope,
  encryptGameSaveBackup,
  readGameTransferFromScannedValue,
  readGameTransferFromUrl,
  shareEncryptedGameSaveNearby
} from "./gameSaveTransfer";
import { memoryStorage } from "../test/memoryStorage";

const backup = {
  schema: "wedding-game-save" as const,
  version: 1 as const,
  createdAt: "2026-07-30T00:00:00.000Z",
  entries: { "wedding-world-secrets:v1": "{\"version\":1}" }
};

describe("gameSaveTransfer", () => {
  it("비밀번호로 백업을 암호화하고 같은 비밀번호로만 복호화한다", async () => {
    const provider = webcrypto as unknown as Crypto;
    const envelope = await encryptGameSaveBackup(backup, "garden12", provider, 10_000);
    await expect(decryptGameSaveBackup(envelope, "garden12", provider)).resolves.toEqual(backup);
    await expect(decryptGameSaveBackup(envelope, "wrong12", provider)).rejects.toThrow(/암호가 다르거나/);
  });

  it("암호화 데이터를 QR URL 조각으로 왕복한다", async () => {
    const envelope = await encryptGameSaveBackup(backup, "garden12", webcrypto as unknown as Crypto, 10_000);
    expect(decodeGameTransferEnvelope(encodeGameTransferEnvelope(envelope))).toEqual(envelope);
    const url = createGameTransferUrl(envelope, "https://example.test/invitation/?invite=guest");
    expect(url).toContain("#game-transfer=");
    expect(url).not.toContain("invite=guest");
    expect(readGameTransferFromUrl(url)).toEqual(envelope);
    expect(readGameTransferFromScannedValue(url)).toEqual(envelope);
    expect(readGameTransferFromScannedValue(`game-transfer=${url.split("game-transfer=")[1]}`)).toEqual(envelope);
  });

  it("QR 이전에는 사진과 민감 데이터를 제외하고 핵심 진행만 담는다", () => {
    const storage = memoryStorage();
    storage.setItem("wedding-game:journey-progress:v1", JSON.stringify({ completedIds: ["directions"] }));
    storage.setItem("wedding-world-secrets:v1", JSON.stringify({ discoveredIds: ["first-invitation"] }));
    storage.setItem("wedding-game:photo-album:v2", "data:image/jpeg;base64," + "x".repeat(2_000));
    storage.setItem("wedding-admin-session:v1", "secret");
    const compact = createCompactGameSaveBackup(storage, backup.createdAt);
    expect(compact.entries).toMatchObject({
      "wedding-game:journey-progress:v1": expect.any(String),
      "wedding-world-secrets:v1": expect.any(String)
    });
    expect(Object.keys(compact.entries)).not.toContain("wedding-game:photo-album:v2");
    expect(Object.keys(compact.entries)).not.toContain("wedding-admin-session:v1");
  });

  it("사진이 포함된 전체 암호화 백업을 운영체제 근거리 공유창으로 보낸다", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const environment = {
      share,
      canShare: vi.fn(() => true),
      createObjectUrl: vi.fn(() => "blob:save"),
      clickDownload: vi.fn(),
      revokeObjectUrl: vi.fn()
    };
    await expect(shareEncryptedGameSaveNearby(backup, "garden12", environment, webcrypto as unknown as Crypto)).resolves.toBe("shared");
    expect(share).toHaveBeenCalledWith(expect.objectContaining({ files: [expect.any(File)] }));
    expect(environment.clickDownload).not.toHaveBeenCalled();
  });
});
