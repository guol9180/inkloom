import type { WorkspaceId } from "@inkloom/core";
import type { CloudAsset, CloudAssetKind } from "@inkloom/storage";
import { cloudClient } from "../../cloud-workspace";

export type AssetUploadTask = {
  id: string;
  file: File;
  kind: CloudAssetKind;
  progress: number;
  state: "uploading" | "complete" | "failed" | "cancelled";
  asset?: CloudAsset;
  error?: string;
};

export function uploadAssetWithProgress({
  workspaceId,
  file,
  kind,
  signal,
  onProgress
}: {
  workspaceId: string;
  file: File;
  kind: CloudAssetKind;
  signal: AbortSignal;
  onProgress: (progress: number) => void;
}): Promise<{ asset: CloudAsset; deduplicated: boolean }> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", cloudClient.assetEndpoint(workspaceId as WorkspaceId));
    request.withCredentials = true;
    request.setRequestHeader("Accept", "application/json");
    request.setRequestHeader(
      "Content-Type",
      file.type || "application/octet-stream"
    );
    request.setRequestHeader("X-InkLoom-Kind", kind);
    request.setRequestHeader(
      "X-InkLoom-Filename",
      encodeURIComponent(file.name)
    );
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });
    signal.addEventListener(
      "abort",
      () => {
        request.abort();
      },
      { once: true }
    );
    request.addEventListener("load", () => {
      try {
        const payload = JSON.parse(request.responseText) as {
          asset?: CloudAsset;
          deduplicated?: boolean;
          error?: { message?: string };
        };
        if (request.status < 200 || request.status >= 300 || !payload.asset) {
          reject(
            new Error(payload.error?.message ?? "资产上传失败，请稍后重试。")
          );
          return;
        }
        onProgress(100);
        resolve({
          asset: payload.asset,
          deduplicated: Boolean(payload.deduplicated)
        });
      } catch {
        reject(new Error("资产服务返回了无法识别的响应。"));
      }
    });
    request.addEventListener("error", () => {
      reject(new Error("网络连接中断，资产上传失败。"));
    });
    request.addEventListener("abort", () => {
      reject(new DOMException("Upload cancelled", "AbortError"));
    });
    request.send(file);
  });
}

export function classifyAssetFile(file: File): {
  kind: "image" | "svg" | "attachment";
  mime: string;
} {
  const mime = file.type || "application/octet-stream";
  if (mime === "image/svg+xml") return { kind: "svg", mime };
  if (mime.startsWith("image/")) return { kind: "image", mime };
  return { kind: "attachment", mime };
}
