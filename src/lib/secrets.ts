import type { Env } from "../env";
import type { ProviderSecretPayload } from "../types";

interface SecretEnvelope {
  alg: "AES-GCM";
  version: 1;
  iv: string;
  ciphertext: string;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function encodeBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }

  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function decodeBase64(value: string): Uint8Array {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(value, "base64"));
  }

  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function importProviderSecretKey(env: Env): Promise<CryptoKey> {
  if (!env.PROVIDER_SECRET_ENCRYPTION_KEY) {
    throw new Error(
      "PROVIDER_SECRET_ENCRYPTION_KEY must be configured before storing provider secrets.",
    );
  }

  const keyBytes = decodeBase64(env.PROVIDER_SECRET_ENCRYPTION_KEY);
  if (keyBytes.byteLength !== 32) {
    throw new Error(
      "PROVIDER_SECRET_ENCRYPTION_KEY must be a base64-encoded 32-byte key.",
    );
  }

  return crypto.subtle.importKey(
    "raw",
    toArrayBuffer(keyBytes),
    "AES-GCM",
    false,
    ["encrypt", "decrypt"],
  );
}

function normalizeProviderSecrets(
  payload: ProviderSecretPayload,
): ProviderSecretPayload {
  return Object.fromEntries(
    Object.entries(payload)
      .filter((entry): entry is [string, string] => typeof entry[1] === "string")
      .map(([key, value]) => [key, value.trim()])
      .filter((entry) => entry[1].length > 0),
  );
}

export function hasProviderSecretPayload(
  payload: ProviderSecretPayload | null | undefined,
): boolean {
  return Boolean(payload && Object.keys(normalizeProviderSecrets(payload)).length > 0);
}

export async function encryptProviderSecretPayload(
  env: Env,
  payload: ProviderSecretPayload,
): Promise<string | null> {
  const normalized = normalizeProviderSecrets(payload);
  if (Object.keys(normalized).length === 0) return null;

  const key = await importProviderSecretKey(env);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(normalized));
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    key,
    plaintext,
  );

  const envelope: SecretEnvelope = {
    alg: "AES-GCM",
    version: 1,
    iv: encodeBase64(iv),
    ciphertext: encodeBase64(new Uint8Array(ciphertext)),
  };

  return JSON.stringify(envelope);
}

export async function decryptProviderSecretPayload(
  env: Env,
  envelopeJson: string | null,
): Promise<ProviderSecretPayload | null> {
  if (!envelopeJson) return null;

  let envelope: SecretEnvelope;
  try {
    envelope = JSON.parse(envelopeJson) as SecretEnvelope;
  } catch {
    throw new Error("Stored provider secret envelope is invalid JSON.");
  }

  if (envelope.alg !== "AES-GCM" || envelope.version !== 1) {
    throw new Error("Stored provider secret envelope uses an unsupported format.");
  }

  const key = await importProviderSecretKey(env);
  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: toArrayBuffer(decodeBase64(envelope.iv)),
    },
    key,
    toArrayBuffer(decodeBase64(envelope.ciphertext)),
  );

  const decoded = new TextDecoder().decode(plaintext);
  return normalizeProviderSecrets(JSON.parse(decoded) as ProviderSecretPayload);
}
