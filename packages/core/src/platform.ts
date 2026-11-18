import { InkLoomError } from "./errors";
import type { StorageCapabilities } from "./workspace";

export const PLATFORM_BRIDGE_VERSION = 1 as const;
export const PLATFORM_KINDS = [
  "web",
  "tauri-desktop",
  "tauri-mobile",
  "harmony"
] as const;

export type PlatformKind = (typeof PLATFORM_KINDS)[number];

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

export const BRIDGE_METHODS = [
  "platform.getCapabilities",
  "workspace.pickDirectory",
  "workspace.importFile",
  "workspace.exportFile",
  "storage.readText",
  "storage.writeText",
  "sync.flush",
  "auth.openSession"
] as const;

export type BridgeMethod = (typeof BRIDGE_METHODS)[number];

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

export type BridgeDegradationReason = "unsupported" | "protocol-error" | "offline";

export type BridgeAvailability =
  | { status: "ready" }
  | {
      status: "degraded";
      mode: "cached-only";
      reason: BridgeDegradationReason;
      message: string;
    };

const bridgeMethodSet = new Set<string>(BRIDGE_METHODS);

export function isBridgeMethod(value: unknown): value is BridgeMethod {
  return typeof value === "string" && bridgeMethodSet.has(value);
}

export function isBridgePayload(value: unknown): boolean {
  return isJsonValue(value, 0, new Set<object>());
}

export function createBridgeRequest<TPayload>(
  id: string,
  method: BridgeMethod,
  payload: TPayload
): BridgeRequest<TPayload> {
  if (id.trim().length === 0) {
    throw new InkLoomError("BRIDGE_PROTOCOL_ERROR", "Bridge request id must not be empty.");
  }
  if (!isBridgeMethod(method)) {
    throw new InkLoomError("BRIDGE_PROTOCOL_ERROR", `Unsupported bridge method: ${method}`);
  }
  if (!isBridgePayload(payload)) {
    throw new InkLoomError(
      "BRIDGE_PROTOCOL_ERROR",
      "Bridge payload must be JSON-safe and acyclic."
    );
  }
  return {
    version: PLATFORM_BRIDGE_VERSION,
    id,
    method,
    payload
  };
}

export function parseBridgeRequest(value: unknown): BridgeRequest {
  if (!value || typeof value !== "object") {
    throw new InkLoomError("BRIDGE_PROTOCOL_ERROR", "Bridge request must be an object.");
  }

  const request = value as Partial<BridgeRequest>;
  if (request.version !== PLATFORM_BRIDGE_VERSION) {
    throw new InkLoomError(
      "BRIDGE_PROTOCOL_ERROR",
      `Unsupported bridge version: ${String(request.version)}`
    );
  }
  if (typeof request.id !== "string" || request.id.trim().length === 0) {
    throw new InkLoomError("BRIDGE_PROTOCOL_ERROR", "Bridge request id must not be empty.");
  }
  if (!isBridgeMethod(request.method)) {
    throw new InkLoomError(
      "BRIDGE_PROTOCOL_ERROR",
      `Unsupported bridge method: ${String(request.method)}`
    );
  }
  if (!isBridgePayload(request.payload)) {
    throw new InkLoomError(
      "BRIDGE_PROTOCOL_ERROR",
      "Bridge payload must be JSON-safe and acyclic."
    );
  }

  return request as BridgeRequest;
}

export function bridgeUnavailable(
  reason: BridgeDegradationReason,
  message: string
): BridgeAvailability {
  return {
    status: "degraded",
    mode: "cached-only",
    reason,
    message
  };
}

function isJsonValue(value: unknown, depth: number, ancestors: Set<object>): boolean {
  if (depth > 64) return false;
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object") return false;
  if (ancestors.has(value)) return false;

  ancestors.add(value);
  const valid = Array.isArray(value)
    ? value.every((item) => isJsonValue(item, depth + 1, ancestors))
    : Object.getPrototypeOf(value) === Object.prototype &&
      Object.values(value).every((item) => isJsonValue(item, depth + 1, ancestors));
  ancestors.delete(value);
  return valid;
}
