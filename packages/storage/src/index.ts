export type {
  AssetStore,
  CreateDocumentInput,
  DeleteNodeInput,
  MoveNodeInput,
  StorageCapabilities,
  StorageKind,
  WorkspaceAdapter,
  WriteDocumentInput
} from "@inkloom/core";

export * from "./browser-local";
export * from "./cloud";

export const SUPPORTED_STORAGE_KINDS = [
  "browser-local",
  "browser-opfs",
  "file-system-access",
  "tauri-folder",
  "cloud",
  "harmony-sandbox"
] as const;
