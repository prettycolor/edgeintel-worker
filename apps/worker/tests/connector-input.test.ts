import { describe, expect, it } from "vitest";
import {
  normalizePairingCreateInput,
  normalizePairingExchangeInput,
  normalizeTunnelHeartbeatInput,
} from "../src/lib/connector-input";

describe("connector input normalization", () => {
  it("normalizes connector pairing metadata and strips multiline input", () => {
    const normalized = normalizePairingExchangeInput({
      pairingToken: "  token-value  ",
      connectorName: "  EdgeIntel Connector \n Beta ",
      connectorVersion: " 1.2.3 ",
      note: " ready \n for pairing ",
    });

    expect(normalized).toEqual({
      pairingToken: "token-value",
      connectorName: "EdgeIntel Connector Beta",
      connectorVersion: "1.2.3",
      note: "ready for pairing",
    });
  });

  it("rejects malformed pairing exchange and heartbeat payloads", () => {
    expect(() =>
      normalizePairingExchangeInput({
        pairingToken: "",
      }),
    ).toThrow("pairingToken is required.");

    expect(() =>
      normalizeTunnelHeartbeatInput({
        connectorStatus: "pwned" as never,
      }),
    ).toThrow("connectorStatus must be one of");

    expect(() =>
      normalizeTunnelHeartbeatInput({
        localServiceReachable: "true" as never,
      }),
    ).toThrow("localServiceReachable must be a boolean");
  });

  it("rejects invalid pairing creation payloads and clamps optional text fields", () => {
    const normalized = normalizePairingCreateInput({
      tunnelId: "  tunnel-1  ",
      label: "  MacBook Pro  ",
      note: "  local gemma route  ",
    });

    expect(normalized.tunnelId).toBe("tunnel-1");
    expect(normalized.label).toBe("MacBook Pro");
    expect(normalized.note).toBe("local gemma route");

    expect(() =>
      normalizePairingCreateInput({
        tunnelId: 123 as never,
      }),
    ).toThrow("tunnelId must be a string");
  });
});
