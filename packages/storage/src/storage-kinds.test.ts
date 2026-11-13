import { describe, expect, it } from "vitest";
import { SUPPORTED_STORAGE_KINDS } from "./index";

describe("supported storage kinds", () => {
  it("declares every host-level persistence strategy", () => {
    expect(SUPPORTED_STORAGE_KINDS).toEqual([
      "browser-local",
      "browser-opfs",
      "file-system-access",
      "tauri-folder",
      "cloud",
      "harmony-sandbox"
    ]);
  });
});
