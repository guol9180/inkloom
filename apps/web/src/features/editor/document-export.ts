import { createStoreZip, type DocumentSnapshot, type WorkspaceId } from "@inkloom/core";
import { cloudClient } from "../../cloud-workspace";

const ASSET_URL_PATTERN =
  /\/api\/workspaces\/[^/\s)]+\/assets\/([a-f0-9]{64})(?:\.[a-z0-9]+)?/gi;

export async function exportDocumentZip(
  document: DocumentSnapshot,
  markdown: string
) {
  const hashes = [
    ...new Set(
      [...markdown.matchAll(ASSET_URL_PATTERN)].map((match) =>
        match[1].toLowerCase()
      )
    )
  ];
  const assets = new Map<string, { path: string; data: Uint8Array }>();
  for (const hash of hashes) {
    const info = await cloudClient.getAssetInfo(
      document.meta.workspaceId as WorkspaceId,
      hash
    );
    const data = await cloudClient.downloadAsset(
      document.meta.workspaceId as WorkspaceId,
      hash
    );
    assets.set(hash, {
      path: `assets/${hash}.${extensionForMime(info.mime)}`,
      data
    });
  }
  const rewritten = markdown.replace(
    ASSET_URL_PATTERN,
    (_match, hash: string) => {
      const asset = assets.get(hash.toLowerCase());
      return asset?.path ?? `assets/${hash}`;
    }
  );
  const entries = [
    {
      path: `${safeFileName(document.meta.title)}.md`,
      data: new TextEncoder().encode(rewritten)
    },
    ...assets.values()
  ];
  if (document.extensions?.canvas !== undefined) {
    entries.push({
      path: `assets/${safeFileName(document.meta.id)}.excalidraw`,
      data: new TextEncoder().encode(
        JSON.stringify(document.extensions.canvas, null, 2)
      )
    });
  }
  const zip = createStoreZip(entries);
  const buffer = zip.buffer.slice(
    zip.byteOffset,
    zip.byteOffset + zip.byteLength
  ) as ArrayBuffer;
  downloadBlob(
    new Blob([buffer], { type: "application/zip" }),
    `${safeFileName(document.meta.title)}.zip`
  );
}

function extensionForMime(mime: string) {
  const known: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/avif": "avif",
    "image/svg+xml": "svg",
    "application/pdf": "pdf",
    "application/json": "json",
    "application/vnd.excalidraw+json": "excalidraw"
  };
  return known[mime] ?? "bin";
}

function safeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|\r\n]/g, "-").trim() || "文档";
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
