import { describe, expect, it } from "vitest";
import { InkLoomError, PLATFORM_BRIDGE_VERSION, workspacePath } from "./index";

describe("workspacePath", () => {
  it("normalizes platform separators into a logical path", () => {
    expect(workspacePath("产品\\设计\\路线图.md")).toBe("产品/设计/路线图.md");
  });

  it("rejects traversal and empty segments", () => {
    expect(() => workspacePath("../secret.md")).toThrow(InkLoomError);
    expect(() => workspacePath("docs//secret.md")).toThrow(InkLoomError);
    expect(() => workspacePath("docs/./secret.md")).toThrow(InkLoomError);
  });

  it("rejects absolute and platform URI paths instead of rebasing them", () => {
    expect(() => workspacePath("/etc/passwd")).toThrow(InkLoomError);
    expect(() => workspacePath("C:\\Users\\PC\\secret.md")).toThrow(
      InkLoomError
    );
    expect(() => workspacePath("\\\\server\\share\\secret.md")).toThrow(
      InkLoomError
    );
    expect(() => workspacePath("file:///secret.md")).toThrow(InkLoomError);
  });
});

describe("platform contract", () => {
  it("keeps an explicit bridge protocol version", () => {
    expect(PLATFORM_BRIDGE_VERSION).toBe(1);
  });
});
