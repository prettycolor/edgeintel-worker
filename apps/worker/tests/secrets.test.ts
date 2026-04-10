import { describe, expect, it } from "vitest";
import type { Env } from "../src/env";
import {
  decryptProviderSecretPayload,
  encryptProviderSecretPayload,
  hasProviderSecretPayload,
} from "../src/lib/secrets";

function createEnvWithSecret(): Env {
  return {
    PROVIDER_SECRET_ENCRYPTION_KEY: Buffer.from(
      crypto.getRandomValues(new Uint8Array(32)),
    ).toString("base64"),
  } as Env;
}

describe("provider secret encryption", () => {
  it("round-trips encrypted provider secrets", async () => {
    const env = createEnvWithSecret();
    const envelope = await encryptProviderSecretPayload(env, {
      apiKey: "test-key",
      accessClientId: "client-id",
      accessClientSecret: "client-secret",
    });

    expect(envelope).toBeTruthy();

    const decrypted = await decryptProviderSecretPayload(env, envelope);
    expect(decrypted).toEqual({
      apiKey: "test-key",
      accessClientId: "client-id",
      accessClientSecret: "client-secret",
    });
  });

  it("detects when a provider secret payload is empty", () => {
    expect(hasProviderSecretPayload({ apiKey: "  " })).toBe(false);
    expect(hasProviderSecretPayload({ apiKey: "value" })).toBe(true);
  });
});
