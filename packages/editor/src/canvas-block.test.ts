import { describe, expect, it } from "vitest";
import {
  isCanvasBlockAttrs,
  parseCanvasBlock,
  serializeCanvasBlock
} from "./canvas-block";

const HASH_A =
  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const HASH_B =
  "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

describe("portable canvas blocks", () => {
  it("round-trips scene and SVG references without embedding scene JSON", () => {
    const attrs = {
      id: "canvas-1",
      title: "系统边界",
      sceneHash: HASH_A,
      previewHash: HASH_B
    };
    const markdown = serializeCanvasBlock(attrs);
    expect(markdown).toContain(`scene: assets/${HASH_A}.excalidraw`);
    expect(markdown).toContain(`![系统边界](assets/${HASH_B}.svg)`);
    expect(markdown).not.toContain('"elements"');
    expect(parseCanvasBlock(markdown)).toEqual(attrs);
  });

  it("rejects incomplete or malformed asset references", () => {
    expect(
      parseCanvasBlock(`<!-- inkloom:canvas
id: canvas-1
title: Missing scene
preview: assets/${HASH_B}.svg
-->
![Missing scene](assets/${HASH_B}.svg)
<!-- /inkloom:canvas -->`)
    ).toBeUndefined();
    expect(
      isCanvasBlockAttrs({
        id: "canvas-1",
        title: "Bad hash",
        sceneHash: "not-a-hash",
        previewHash: HASH_B
      })
    ).toBe(false);
  });
});
