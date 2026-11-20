import { describe, expect, it } from "vitest";
import { createStoreZip } from "./zip";

describe("createStoreZip", () => {
  it("creates a UTF-8, uncompressed ZIP with stable entries", () => {
    const markdown = Uint8Array.from([35, 32, 101, 120, 112, 111, 114, 116, 10]);
    const image = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const zip = createStoreZip(
      [
        { path: "文档.md", data: markdown },
        { path: "assets/image.png", data: image }
      ],
      new Date("2026-11-20T12:00:00+08:00")
    );
    const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    expect(view.getUint16(8, true)).toBe(0);
    expect(view.getUint32(zip.length - 22, true)).toBe(0x06054b50);
    expect(view.getUint16(zip.length - 12, true)).toBe(2);

    const firstDataOffset = 30 + 9;
    expect(
      zip.slice(firstDataOffset, firstDataOffset + markdown.length)
    ).toEqual(markdown);
  });
});
