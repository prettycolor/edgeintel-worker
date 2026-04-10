import { describe, expect, it } from "vitest";
import type { Env } from "../src/env";
import {
  buildPairingSecretView,
  issueConnectorSession,
  issuePairingSecret,
  serializePairingSession,
  verifyOpaqueToken,
} from "../src/lib/pairings";
import type { PersistedPairingSession } from "../src/types";

const env = {
  PAIRING_TOKEN_TTL_SECONDS: "120",
  CONNECTOR_TOKEN_TTL_SECONDS: "7200",
} as Env;

const pairingRecord: PersistedPairingSession = {
  id: "pairing-1",
  tunnelId: "tunnel-1",
  issuedBySubject: "user-1",
  issuedByEmail: "owner@example.com",
  status: "pending",
  pairingTokenHash: "hash",
  connectorTokenHash: null,
  connectorName: null,
  connectorVersion: null,
  exchangeCount: 0,
  issuedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  exchangedAt: null,
  connectorExpiresAt: null,
  lastSeenAt: null,
  revokedAt: null,
  expiredAt: null,
  metadataJson: JSON.stringify({ label: "MacBook Pro" }),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe("pairing helpers", () => {
  it("issues a pairing secret and verifies the stored hash", async () => {
    const issued = await issuePairingSecret(env);

    expect(issued.pairingToken).toBeTruthy();
    await expect(
      verifyOpaqueToken(issued.pairingToken, issued.pairingTokenHash),
    ).resolves.toBe(true);
    await expect(
      verifyOpaqueToken("wrong-token", issued.pairingTokenHash),
    ).resolves.toBe(false);
  });

  it("issues a connector bearer token with an expiry", async () => {
    const issued = await issueConnectorSession(env);

    expect(issued.connectorToken).toBeTruthy();
    expect(new Date(issued.expiresAt).getTime()).toBeGreaterThan(Date.now());
    await expect(
      verifyOpaqueToken(issued.connectorToken, issued.connectorTokenHash),
    ).resolves.toBe(true);
  });

  it("serializes pairing sessions and builds a one-time handoff view", () => {
    const pairing = serializePairingSession(pairingRecord);
    const secret = buildPairingSecretView(
      new Request("https://edgeintel.example.com/app/tunnels"),
      {
        id: "tunnel-1",
        publicHostname: "llm.example.com",
      },
      pairingRecord,
      "pairing-secret",
    );

    expect(pairing.metadata).toEqual({ label: "MacBook Pro" });
    expect(secret.exchangeEndpoint).toBe(
      "https://edgeintel.example.com/api/pairings/pairing-1/exchange",
    );
    expect(secret.publicHostname).toBe("llm.example.com");
  });
});
