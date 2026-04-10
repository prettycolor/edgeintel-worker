import type {
  DesktopTunnelBootstrapView,
  PairingSessionView,
} from "@edgeintel/shared-contracts";
import { app, safeStorage } from "electron";
import Store from "electron-store";

interface PersistedPlainState {
  apiBase: string | null;
  pairingId: string | null;
  connectorName: string;
  autoLaunchOnLogin: boolean;
  pairedAt: string | null;
  publicHostname: string | null;
  managedCloudflaredPath: string | null;
  managedCloudflaredReleaseTag: string | null;
  managedCloudflaredAssetName: string | null;
}

interface PersistedSecretState {
  connectorToken: string | null;
  connectorSessionExpiresAt: string | null;
  pairing: PairingSessionView | null;
  bootstrap: DesktopTunnelBootstrapView | null;
}

const PLAIN_STATE_KEY = "desktop.connector.plain";
const SECRET_STATE_KEY = "desktop.connector.secrets";

const DEFAULT_PLAIN_STATE: PersistedPlainState = {
  apiBase: null,
  pairingId: null,
  connectorName: "EdgeIntel Connector",
  autoLaunchOnLogin: false,
  pairedAt: null,
  publicHostname: null,
  managedCloudflaredPath: null,
  managedCloudflaredReleaseTag: null,
  managedCloudflaredAssetName: null,
};

const DEFAULT_SECRET_STATE: PersistedSecretState = {
  connectorToken: null,
  connectorSessionExpiresAt: null,
  pairing: null,
  bootstrap: null,
};

export interface PersistedDesktopState {
  plain: PersistedPlainState;
  secrets: PersistedSecretState;
}

export class DesktopConnectorStore {
  private readonly store = new Store<Record<string, unknown>>({
    name: "edgeintel-desktop",
  });

  read(): PersistedDesktopState {
    return {
      plain: this.readPlain(),
      secrets: this.readSecrets(),
    };
  }

  readPlain(): PersistedPlainState {
    const stored = this.store.get(PLAIN_STATE_KEY);
    if (!stored || typeof stored !== "object" || Array.isArray(stored)) {
      return { ...DEFAULT_PLAIN_STATE };
    }

    return {
      ...DEFAULT_PLAIN_STATE,
      ...(stored as Partial<PersistedPlainState>),
    };
  }

  writePlain(patch: Partial<PersistedPlainState>): PersistedPlainState {
    const next = {
      ...this.readPlain(),
      ...patch,
    };
    this.store.set(PLAIN_STATE_KEY, next);
    return next;
  }

  readSecrets(): PersistedSecretState {
    const encoded = this.store.get(SECRET_STATE_KEY);
    if (typeof encoded !== "string" || !encoded) {
      return { ...DEFAULT_SECRET_STATE };
    }

    try {
      if (!safeStorage.isEncryptionAvailable()) {
        return { ...DEFAULT_SECRET_STATE };
      }

      const decrypted = safeStorage.decryptString(Buffer.from(encoded, "base64"));
      const parsed = JSON.parse(decrypted) as Partial<PersistedSecretState>;
      return {
        ...DEFAULT_SECRET_STATE,
        ...parsed,
      };
    } catch {
      return { ...DEFAULT_SECRET_STATE };
    }
  }

  writeSecrets(next: PersistedSecretState): PersistedSecretState {
    if (!safeStorage.isEncryptionAvailable()) {
      this.store.delete(SECRET_STATE_KEY);
      return next;
    }

    const encrypted = safeStorage.encryptString(JSON.stringify(next));
    this.store.set(SECRET_STATE_KEY, encrypted.toString("base64"));
    return next;
  }

  clear(): void {
    this.store.delete(PLAIN_STATE_KEY);
    this.store.delete(SECRET_STATE_KEY);
  }

  getManagedCloudflaredPath(): string {
    const storedPath = this.readPlain().managedCloudflaredPath;
    if (storedPath) return storedPath;
    return `${app.getPath("userData")}/bin/cloudflared`;
  }
}
