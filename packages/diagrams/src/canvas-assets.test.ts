import { describe, expect, it } from "vitest";
import {
  canvasEditorData,
  fallbackCanvasPreviewSvg,
  parseCanvasSceneFile
} from "./canvas-assets";

describe("canvas scene assets", () => {
  it("restores elements, app state and binary file metadata", () => {
    const scene = parseCanvasSceneFile(
      JSON.stringify({
        type: "excalidraw",
        version: 2,
        elements: [
          {
            id: "rect-1",
            type: "rectangle",
            x: 20,
            y: 30,
            width: 140,
            height: 80
          }
        ],
        appState: { viewBackgroundColor: "#ffffff" },
        files: { file1: { mimeType: "image/png" } }
      })
    );
    expect(scene.elements).toHaveLength(1);
    expect(scene.appState).toEqual({ viewBackgroundColor: "#ffffff" });
    expect(scene.files).toHaveProperty("file1");
  });

  it("normalizes legacy elements with stable editor defaults", () => {
    const data = canvasEditorData({
      elements: [
        {
          type: "text",
          x: 10,
          y: 12,
          text: "旧文字"
        }
      ]
    });
    expect(data.appState.viewBackgroundColor).toBe("#fafbf9");
    expect(data.elements[0]).toMatchObject({
      id: "element-0",
      type: "text",
      text: "旧文字",
      fontSize: 20
    });
  });

  it("rejects scene files without an elements array", () => {
    expect(() => parseCanvasSceneFile('{"type":"excalidraw"}')).toThrow(
      "画布场景缺少图元。"
    );
  });

  it("renders a portable SVG fallback when the browser exporter is unavailable", () => {
    const data = canvasEditorData({
      elements: [
        {
          type: "rectangle",
          x: 32,
          y: 48,
          width: 180,
          height: 90,
          strokeColor: "#26332d",
          backgroundColor: "#edf3ef"
        },
        {
          type: "text",
          x: 60,
          y: 70,
          text: "保存 <画布>",
          fontSize: 20
        }
      ]
    });
    const svg = fallbackCanvasPreviewSvg(data);
    expect(svg).toContain("<svg");
    expect(svg).toContain("<rect");
    expect(svg).toContain("保存 &lt;画布&gt;");
    expect(svg).not.toContain("保存 <画布>");
  });
});
