import { createGameSaveBackup, parseGameSaveBackup, type GameSaveBackup } from "./gameSaveBackup";

export type EncryptedGameSaveEnvelope = {
  schema: "wedding-game-encrypted-save";
  version: 1;
  createdAt: string;
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
};

type CryptoProvider = Pick<Crypto, "getRandomValues" | "subtle">;

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const defaultIterations = 120_000;
const maximumQrSourceBytes = 520;

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

export function createGameTransferUrl(envelope: EncryptedGameSaveEnvelope, currentUrl: string): string {
  const url = new URL(currentUrl);
  url.search = "";
  url.hash = `game-transfer=${encodeGameTransferEnvelope(envelope)}`;
  return url.href;
}

export function readGameTransferFromUrl(url: string): EncryptedGameSaveEnvelope | null {
  const hash = new URL(url).hash.slice(1);
  if (!hash.startsWith("game-transfer=")) return null;
  return decodeGameTransferEnvelope(hash.slice("game-transfer=".length));
}

export function encryptedGameSaveFilename(createdAt = new Date()): string {
  return `wedding-game-encrypted-${createdAt.toISOString().slice(0, 10)}.wgsave`;
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
