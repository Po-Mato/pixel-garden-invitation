import { createGameSaveBackup, parseGameSaveBackup, type GameSaveBackup } from "./gameSaveBackup";

export type EncryptedGameSaveEnvelope = {
  schema: "wedding-game-encrypted-save";
  version: 1;
  createdAt: string;
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
  expiresAt?: string;
};

type CryptoProvider = Pick<Crypto, "getRandomValues" | "subtle">;

type NearbyShareEnvironment = {
  share?: (data: ShareData) => Promise<void>;
  canShare?: (data: ShareData) => boolean;
  createObjectUrl: (blob: Blob) => string;
  clickDownload: (url: string, filename: string) => void;
  revokeObjectUrl: (url: string) => void;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const defaultIterations = 120_000;
const maximumQrSourceBytes = 520;
export const gameTransferLifetimeMs = 15 * 60 * 1_000;

function browserCrypto(): CryptoProvider {
  if (!globalThis.crypto?.subtle) throw new Error("이 브라우저는 암호화 백업을 지원하지 않습니다.");
  return globalThis.crypto;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 32_768) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 32_768));
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function deriveKey(
  passphrase: string,
  salt: Uint8Array,
  iterations: number,
  provider: CryptoProvider,
  usage: KeyUsage
) {
  if (passphrase.trim().length < 6) throw new Error("암호는 6자 이상 입력해 주세요.");
  const material = await provider.subtle.importKey("raw", encoder.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return provider.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    [usage]
  );
}

export async function encryptGameSaveBackup(
  backup: GameSaveBackup,
  passphrase: string,
  provider: CryptoProvider = browserCrypto(),
  iterations = defaultIterations
): Promise<EncryptedGameSaveEnvelope> {
  const salt = provider.getRandomValues(new Uint8Array(16));
  const iv = provider.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, iterations, provider, "encrypt");
  const encrypted = await provider.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    encoder.encode(JSON.stringify(backup))
  );
  return {
    schema: "wedding-game-encrypted-save",
    version: 1,
    createdAt: backup.createdAt,
    iterations,
    salt: bytesToBase64Url(salt),
    iv: bytesToBase64Url(iv),
    ciphertext: bytesToBase64Url(new Uint8Array(encrypted))
  };
}

export function parseEncryptedGameSaveEnvelope(source: string): EncryptedGameSaveEnvelope {
  const value = JSON.parse(source) as Partial<EncryptedGameSaveEnvelope> | null;
  if (
    value?.schema !== "wedding-game-encrypted-save"
    || value.version !== 1
    || typeof value.createdAt !== "string"
    || !Number.isInteger(value.iterations)
    || value.iterations! < 10_000
    || value.iterations! > 1_000_000
    || typeof value.salt !== "string"
    || typeof value.iv !== "string"
    || typeof value.ciphertext !== "string"
    || (value.expiresAt !== undefined && (typeof value.expiresAt !== "string" || Number.isNaN(Date.parse(value.expiresAt))))
  ) throw new Error("지원하지 않는 암호화 백업 파일입니다.");
  return value as EncryptedGameSaveEnvelope;
}

export async function decryptGameSaveBackup(
  envelope: EncryptedGameSaveEnvelope,
  passphrase: string,
  provider: CryptoProvider = browserCrypto()
): Promise<GameSaveBackup> {
  try {
    const salt = base64UrlToBytes(envelope.salt);
    const iv = base64UrlToBytes(envelope.iv);
    const key = await deriveKey(passphrase, salt, envelope.iterations, provider, "decrypt");
    const decrypted = await provider.subtle.decrypt(
      { name: "AES-GCM", iv: iv as BufferSource },
      key,
      base64UrlToBytes(envelope.ciphertext) as BufferSource
    );
    return parseGameSaveBackup(decoder.decode(decrypted));
  } catch (error) {
    if (error instanceof Error && error.message.includes("6자")) throw error;
    throw new Error("암호가 다르거나 백업 데이터가 손상되었습니다.");
  }
}

const qrPriority = [
  "wedding-game:journey-progress:",
  "wedding-world-secrets:v1",
  "wedding-game:celebration-",
  "wedding-game:npc-dialogue-memory:",
  "wedding-game:first-visit-guide:",
  "wedding-view-preferences:v1",
  "wedding-game:destination-",
  "wedding-game:zone-mini-quest:"
] as const;

export function createCompactGameSaveBackup(storage: Storage, createdAt = new Date().toISOString()): GameSaveBackup {
  const full = createGameSaveBackup(storage, createdAt);
  const entries: Record<string, string> = {};
  const candidates = Object.entries(full.entries)
    .filter(([key]) => !key.includes(":photo-"))
    .sort(([left], [right]) => {
      const leftRank = qrPriority.findIndex((prefix) => left.startsWith(prefix));
      const rightRank = qrPriority.findIndex((prefix) => right.startsWith(prefix));
      return (leftRank < 0 ? qrPriority.length : leftRank) - (rightRank < 0 ? qrPriority.length : rightRank);
    });
  for (const [key, value] of candidates) {
    const next = { ...entries, [key]: value };
    if (encoder.encode(JSON.stringify(next)).byteLength > maximumQrSourceBytes) continue;
    entries[key] = value;
  }
  if (Object.keys(entries).length === 0) throw new Error("QR로 옮길 수 있는 핵심 진행 데이터가 아직 없습니다.");
  return { ...full, entries };
}

export function encodeGameTransferEnvelope(envelope: EncryptedGameSaveEnvelope): string {
  return bytesToBase64Url(encoder.encode(JSON.stringify(envelope)));
}

export function decodeGameTransferEnvelope(payload: string): EncryptedGameSaveEnvelope {
  return parseEncryptedGameSaveEnvelope(decoder.decode(base64UrlToBytes(payload)));
}

export function gameTransferExpiresAt(envelope: EncryptedGameSaveEnvelope): number | null {
  if (!envelope.expiresAt) return null;
  const expiresAt = Date.parse(envelope.expiresAt);
  return Number.isFinite(expiresAt) ? expiresAt : null;
}

export function assertGameTransferActive(envelope: EncryptedGameSaveEnvelope, now = Date.now()) {
  const expiresAt = gameTransferExpiresAt(envelope);
  if (expiresAt !== null && expiresAt <= now) throw new Error("기기 이전 QR의 15분 사용 시간이 지났습니다. 보내는 기기에서 새 QR을 만들어 주세요.");
  return envelope;
}

export function createGameTransferUrl(envelope: EncryptedGameSaveEnvelope, currentUrl: string, now = Date.now()): string {
  const url = new URL(currentUrl);
  const transferEnvelope = envelope.expiresAt ? envelope : {
    ...envelope,
    expiresAt: new Date(now + gameTransferLifetimeMs).toISOString()
  };
  url.search = "";
  url.hash = `game-transfer=${encodeGameTransferEnvelope(transferEnvelope)}`;
  return url.href;
}

export function readGameTransferFromUrl(url: string, now = Date.now()): EncryptedGameSaveEnvelope | null {
  const hash = new URL(url).hash.slice(1);
  if (!hash.startsWith("game-transfer=")) return null;
  return assertGameTransferActive(decodeGameTransferEnvelope(hash.slice("game-transfer=".length)), now);
}

export function readGameTransferFromScannedValue(value: string, now = Date.now()): EncryptedGameSaveEnvelope {
  const trimmed = value.trim();
  if (!trimmed) throw new Error("QR 데이터가 비어 있습니다.");
  const directPayload = trimmed.startsWith("game-transfer=") ? trimmed.slice("game-transfer=".length) : null;
  const envelope = directPayload
    ? decodeGameTransferEnvelope(directPayload)
    : readGameTransferFromUrl(trimmed, now);
  if (!envelope) throw new Error("웨딩 가든 기기 이전 QR이 아닙니다.");
  return assertGameTransferActive(envelope, now);
}

export function encryptedGameSaveFilename(createdAt = new Date()): string {
  return `wedding-game-encrypted-${createdAt.toISOString().slice(0, 10)}.wgsave`;
}

function browserNearbyShareEnvironment(): NearbyShareEnvironment {
  return {
    share: typeof navigator.share === "function" ? navigator.share.bind(navigator) : undefined,
    canShare: typeof navigator.canShare === "function" ? navigator.canShare.bind(navigator) : undefined,
    createObjectUrl: (blob) => URL.createObjectURL(blob),
    clickDownload: (url, filename) => {
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.hidden = true;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
    },
    revokeObjectUrl: (url) => URL.revokeObjectURL(url)
  };
}

export async function shareEncryptedGameSaveNearby(
  backup: GameSaveBackup,
  passphrase: string,
  environment: NearbyShareEnvironment = browserNearbyShareEnvironment(),
  provider: CryptoProvider = browserCrypto()
): Promise<"shared" | "saved"> {
  const envelope = await encryptGameSaveBackup(backup, passphrase, provider);
  const filename = encryptedGameSaveFilename(new Date(envelope.createdAt));
  const blob = new Blob([JSON.stringify(envelope)], { type: "application/json" });
  const file = new File([blob], filename, { type: blob.type });
  const shareData: ShareData = {
    files: [file],
    title: "웨딩 가든 전체 게임 저장",
    text: "사진과 여정이 포함된 암호화 저장 파일입니다. 받는 기기에서 같은 암호로 복원해 주세요."
  };
  if (environment.share && (!environment.canShare || environment.canShare(shareData))) {
    try {
      await environment.share(shareData);
      return "shared";
    } catch (error) {
      if (typeof error === "object" && error !== null && "name" in error && error.name === "AbortError") throw error;
    }
  }
  const url = environment.createObjectUrl(blob);
  try {
    environment.clickDownload(url, filename);
  } finally {
    environment.revokeObjectUrl(url);
  }
  return "saved";
}

export function downloadEncryptedGameSave(envelope: EncryptedGameSaveEnvelope) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(envelope)], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = encryptedGameSaveFilename(new Date(envelope.createdAt));
  anchor.hidden = true;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
