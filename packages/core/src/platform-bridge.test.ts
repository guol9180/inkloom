import { describe, expect, it } from "vitest";
import {
  InkLoomError,
  BRIDGE_METHODS,
  PLATFORM_KINDS,
  bridgeUnavailable,
  createBridgeRequest,
  isBridgePayload,
  parseBridgeRequest
} from "./index";

describe("PlatformBridge protocol", () => {
  it("declares every supported platform and bridge method", () => {
    expect(PLATFORM_KINDS).toEqual(["web", "tauri-desktop", "tauri-mobile", "harmony"]);
    expect(BRIDGE_METHODS).toContain("storage.writeText");
  });

  it("creates and parses a versioned JSON-safe request", () => {
    const request = createBridgeRequest("request-1", "storage.writeText", {
      path: "个人/说明.md",
      text: "# 标题"
    });

    expect(parseBridgeRequest(JSON.parse(JSON.stringify(request)))).toEqual(request);
  });

  it("rejects empty ids and non-JSON payloads", () => {
    expect(() => createBridgeRequest("", "sync.flush", {})).toThrow(InkLoomError);
    expect(isBridgePayload({ value: undefined })).toBe(false);
    expect(isBridgePayload({ value: Number.NaN })).toBe(false);
    expect(isBridgePayload({ value: () => undefined })).toBe(false);

    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(isBridgePayload(cyclic)).toBe(false);
  });

  it("rejects unknown methods and versions", () => {
    expect(() =>
      parseBridgeRequest({
        version: 1,
        id: "request-2",
        method: "native.executeArbitraryCode",
        payload: {}
      })
    ).toThrow(InkLoomError);
    expect(() =>
      parseBridgeRequest({
        version: 99,
        id: "request-3",
        method: "sync.flush",
        payload: {}
      })
    ).toThrow(InkLoomError);
  });

  it("describes cached-only degradation when a platform method is unavailable", () => {
    expect(
      bridgeUnavailable("unsupported", "当前平台不支持目录写入，正在读取本地缓存。")
    ).toEqual({
      status: "degraded",
      mode: "cached-only",
      reason: "unsupported",
      message: "当前平台不支持目录写入，正在读取本地缓存。"
    });
  });
});
