import type { StorageCapabilities } from "./workspace";

export const PLATFORM_BRIDGE_VERSION = 1 as const;

export type PlatformKind =
  | "web"
  | "tauri-desktop"
  | "tauri-mobile"
  | "harmony";

export type PlatformCapabilities = {
  platform: PlatformKind;
  bridgeVersion: typeof PLATFORM_BRIDGE_VERSION;
  storage: StorageCapabilities;
  supportsSystemFilePicker: boolean;
  supportsShareTarget: boolean;
  supportsBackgroundSync: boolean;
  supportsSecureStorage: boolean;
  supportsTouchCanvas: boolean;
};

export type BridgeMethod =
  | "platform.getCapabilities"
  | "workspace.pickDirectory"
  | "workspace.importFile"
  | "workspace.exportFile"
  | "storage.readText"
  | "storage.writeText"
  | "sync.flush"
  | "auth.openSession";

export type BridgeRequest<TPayload = unknown> = {
  version: typeof PLATFORM_BRIDGE_VERSION;
  id: string;
  method: BridgeMethod;
  payload: TPayload;
};

export type BridgeResponse<TResult = unknown> =
  | {
      version: typeof PLATFORM_BRIDGE_VERSION;
      id: string;
      ok: true;
      result: TResult;
    }
  | {
      version: typeof PLATFORM_BRIDGE_VERSION;
      id: string;
      ok: false;
      error: {
        code: string;
        message: string;
        retryable: boolean;
      };
    };

/**
 * Implemented by each native host. The Web app only sees this versioned
 * request/response contract and never receives raw native objects.
 */
export interface PlatformBridge {
  getCapabilities(): Promise<PlatformCapabilities>;
  request<TPayload, TResult>(request: BridgeRequest<TPayload>): Promise<BridgeResponse<TResult>>;
}
