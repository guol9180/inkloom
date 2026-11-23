import { createHash } from "node:crypto";
import { createReadStream, type ReadStream } from "node:fs";
import { mkdir, open, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import {
  AssetUploadError,
  type AssetBlobSource,
  type AssetBlobStore
} from "./asset-blob-store";

export class LocalDiskAssetStore implements AssetBlobStore {
  constructor(
    private readonly rootDirectory: string,
    private readonly createId = () =>
      `upload-${Date.now()}-${Math.random().toString(36).slice(2)}`
  ) {}

  async put(workspaceId: string, source: AssetBlobSource, maxBytes: number) {
    const workspaceKey = createHash("sha256")
      .update(workspaceId)
      .digest("hex")
      .slice(0, 24);
    const temporaryDirectory = join(this.rootDirectory, ".tmp");
    await mkdir(temporaryDirectory, { recursive: true });
    const temporaryPath = join(
      temporaryDirectory,
      `${this.createId()}.partial`
    );
    const handle = await open(temporaryPath, "wx", 0o600);
    const hash = createHash("sha256");
    let size = 0;
    try {
      for await (const chunk of source) {
        const buffer = Buffer.from(chunk);
        size += buffer.length;
        if (size > maxBytes) {
          throw new AssetUploadError(
            413,
            "ASSET_TOO_LARGE",
            `资产不能超过 ${Math.floor(maxBytes / 1024 / 1024)} MiB。`
          );
        }
        hash.update(buffer);
        await handle.write(buffer);
      }
      await handle.sync();
      await handle.close();
      const digest = hash.digest("hex");
      const directory = join(
        this.rootDirectory,
        workspaceKey,
        digest.slice(0, 2)
      );
      await mkdir(directory, { recursive: true });
      const storageKey = join(workspaceKey, digest.slice(0, 2), digest);
      await rename(temporaryPath, join(this.rootDirectory, storageKey));
      return { hash: digest, size, storageKey };
    } catch (error) {
      await handle.close().catch(() => undefined);
      await rm(temporaryPath, { force: true }).catch(() => undefined);
      throw error;
    }
  }

  open(storageKey: string): ReadStream {
    return createReadStream(join(this.rootDirectory, storageKey));
  }

  async remove(storageKey: string): Promise<void> {
    await rm(join(this.rootDirectory, storageKey), { force: true });
  }
}
