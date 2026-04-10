import type { DesktopCloudflaredState } from "@edgeintel/shared-contracts";
import { getCloudflaredVersion } from "@edgeintel/connector-core";
import { chmod, copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

const CLOUDFLARED_RELEASE_API =
  "https://api.github.com/repos/cloudflare/cloudflared/releases/latest";

interface GithubReleaseAsset {
  name: string;
  browser_download_url: string;
}

interface GithubReleaseResponse {
  tag_name?: string;
  body?: string;
  assets?: GithubReleaseAsset[];
}

export function getCloudflaredAssetNameForArch(arch: NodeJS.Architecture): string {
  return arch === "arm64"
    ? "cloudflared-darwin-arm64.tgz"
    : "cloudflared-darwin-amd64.tgz";
}

export function extractChecksumFromReleaseNotes(releaseBody: string, assetName: string): string | null {
  const pattern = new RegExp(`^${assetName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:\\s*([a-f0-9]{64})$`, "im");
  return releaseBody.match(pattern)?.[1] ?? null;
}

function classifySource(binaryPath: string | null): "managed" | "system" | "homebrew" | null {
  if (!binaryPath) return null;
  if (binaryPath.includes("/Application Support/")) return "managed";
  if (binaryPath.includes("/opt/homebrew/") || binaryPath.includes("/Cellar/")) {
    return "homebrew";
  }
  return "system";
}

function findPathBinary(command: string): string | null {
  const result = spawnSync("which", [command], { encoding: "utf8" });
  if (result.status !== 0) return null;
  const resolved = result.stdout.trim();
  return resolved || null;
}

export function inspectCloudflaredBinary(managedPath: string | null): DesktopCloudflaredState {
  const versionFromManaged = managedPath ? getCloudflaredVersion(managedPath) : null;
  if (managedPath && versionFromManaged) {
    return {
      status: "ready",
      binaryPath: managedPath,
      version: versionFromManaged,
      source: "managed",
      releaseTag: null,
      assetName: null,
      checksumVerified: true,
      message: "Managed cloudflared binary is available.",
      lastCheckedAt: new Date().toISOString(),
    };
  }

  const systemPath = findPathBinary("cloudflared");
  const systemVersion = systemPath ? getCloudflaredVersion(systemPath) : null;
  if (systemPath && systemVersion) {
    return {
      status: "ready",
      binaryPath: systemPath,
      version: systemVersion,
      source: classifySource(systemPath),
      releaseTag: null,
      assetName: null,
      checksumVerified: false,
      message: "Using an existing cloudflared installation on this machine.",
      lastCheckedAt: new Date().toISOString(),
    };
  }

  return {
    status: "missing",
    binaryPath: null,
    version: null,
    source: null,
    releaseTag: null,
    assetName: null,
    checksumVerified: false,
    message: "cloudflared is not installed yet.",
    lastCheckedAt: new Date().toISOString(),
  };
}

export async function installManagedCloudflared(appUserDataPath: string): Promise<DesktopCloudflaredState> {
  const release = await fetch(CLOUDFLARED_RELEASE_API, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "edgeintel-desktop-connector",
    },
  }).then(async (response) => {
    const json = (await response.json()) as GithubReleaseResponse;
    if (!response.ok) {
      throw new Error(`Failed to fetch cloudflared release metadata (${response.status}).`);
    }
    return json;
  });

  const assetName = getCloudflaredAssetNameForArch(process.arch);
  const asset = release.assets?.find((entry) => entry.name === assetName);
  if (!asset) {
    throw new Error(`Latest cloudflared release did not include ${assetName}.`);
  }

  const checksum = extractChecksumFromReleaseNotes(release.body ?? "", assetName);
  if (!checksum) {
    throw new Error(`Latest cloudflared release did not publish a SHA256 checksum for ${assetName}.`);
  }

  const tempDir = await mkdtemp(join(tmpdir(), "edgeintel-cloudflared-"));
  const archivePath = join(tempDir, assetName);
  const extractPath = join(tempDir, "extract");

  try {
    const archiveResponse = await fetch(asset.browser_download_url, {
      headers: {
        "User-Agent": "edgeintel-desktop-connector",
      },
    });
    if (!archiveResponse.ok) {
      throw new Error(`Failed to download ${assetName} (${archiveResponse.status}).`);
    }

    const archiveBuffer = Buffer.from(await archiveResponse.arrayBuffer());
    const actualChecksum = createHash("sha256").update(archiveBuffer).digest("hex");
    if (actualChecksum !== checksum) {
      throw new Error(`Downloaded ${assetName} failed checksum verification.`);
    }

    await mkdir(extractPath, { recursive: true });
    await writeFile(archivePath, archiveBuffer);

    const extractResult = spawnSync("tar", ["-xzf", archivePath, "-C", extractPath]);
    if (extractResult.status !== 0) {
      throw new Error("Failed to extract cloudflared archive.");
    }

    const extractedBinaryPath = join(extractPath, "cloudflared");
    const managedDir = join(appUserDataPath, "bin");
    const managedPath = join(managedDir, "cloudflared");
    await mkdir(managedDir, { recursive: true });
    await copyFile(extractedBinaryPath, managedPath);
    await chmod(managedPath, 0o755);

    const version = getCloudflaredVersion(managedPath);
    return {
      status: version ? "ready" : "error",
      binaryPath: managedPath,
      version,
      source: "managed",
      releaseTag: release.tag_name ?? null,
      assetName,
      checksumVerified: true,
      message: version
        ? `Installed cloudflared ${release.tag_name ?? ""}`.trim()
        : "cloudflared installed, but version check failed.",
      lastCheckedAt: new Date().toISOString(),
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}
