import type { ReadStream } from "node:fs";

export type AssetBlobSource = AsyncIterable<Uint8Array>;

export type AssetBlobStore = {
  put(
    workspaceId: string,
    source: AssetBlobSource,
    maxBytes: number
  ): Promise<{ hash: string; size: number; storageKey: string }>;
  open(storageKey: string): ReadStream;
  remove(storageKey: string): Promise<void>;
};

export class AssetUploadError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "AssetUploadError";
  }
}
