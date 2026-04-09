import { describe, expect, it } from "vitest";
import {
  buildCanonicalUrl,
  normalizeDomain,
  normalizeRequestedDomains,
} from "../src/lib/domain";

describe("domain normalization", () => {
  it("normalizes URLs to public hostnames", () => {
    expect(normalizeDomain("https://WWW.Example.com/path?q=1")).toBe(
      "www.example.com",
    );
  });

  it("rejects local or private targets", () => {
    expect(() => normalizeDomain("http://localhost:3000")).toThrow(
      /Only public, internet-visible domains/,
    );
    expect(() => normalizeDomain("http://192.168.1.20")).toThrow(
      /Only public, internet-visible domains/,
    );
  });

  it("deduplicates and enforces batch limits", () => {
    expect(
      normalizeRequestedDomains(
        "https://example.com",
        ["example.com", "api.example.com"],
        5,
      ),
    ).toEqual(["example.com", "api.example.com"]);
  });

  it("builds canonical scan urls", () => {
    expect(buildCanonicalUrl("example.com")).toBe("https://example.com");
  });
});
