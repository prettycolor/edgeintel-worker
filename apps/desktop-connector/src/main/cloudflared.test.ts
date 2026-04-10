import { describe, expect, it } from "vitest";
import {
  extractChecksumFromReleaseNotes,
  getCloudflaredAssetNameForArch,
} from "./cloudflared";

describe("cloudflared helpers", () => {
  it("selects the correct macOS asset name for arm64", () => {
    expect(getCloudflaredAssetNameForArch("arm64")).toBe("cloudflared-darwin-arm64.tgz");
  });

  it("selects the amd64 asset for non-arm macOS builds", () => {
    expect(getCloudflaredAssetNameForArch("x64")).toBe("cloudflared-darwin-amd64.tgz");
  });

  it("extracts the published sha256 checksum for an asset", () => {
    const releaseBody = `
### SHA256 Checksums:
\`\`\`
cloudflared-darwin-arm64.tgz: 633cee0fd41fd2020e17498beecc54811bf4fc99f891c080dc9343eb0f449c60
cloudflared-darwin-amd64.tgz: b91dbec79a3e3809d5508b96d8b0bdfbf3ad7d51f858200228fa3e57100580d9
\`\`\`
`;

    expect(
      extractChecksumFromReleaseNotes(
        releaseBody,
        "cloudflared-darwin-arm64.tgz",
      ),
    ).toBe("633cee0fd41fd2020e17498beecc54811bf4fc99f891c080dc9343eb0f449c60");
  });
});
