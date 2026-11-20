import { describe, expect, it } from "vitest";
import {
  matchingMermaidTemplate,
  MERMAID_TEMPLATES,
  toMermaidRenderError
} from "./mermaid";

describe("Mermaid editor helpers", () => {
  it("keeps every starter template valid, unique and round-trippable", () => {
    expect(MERMAID_TEMPLATES.length).toBeGreaterThanOrEqual(5);
    expect(new Set(MERMAID_TEMPLATES.map((item) => item.id)).size).toBe(
      MERMAID_TEMPLATES.length
    );
    for (const template of MERMAID_TEMPLATES) {
      expect(matchingMermaidTemplate(template.source)).toBe(template.id);
    }
  });

  it("recognizes edited source as custom", () => {
    expect(matchingMermaidTemplate("flowchart LR\n  A --> B")).toBe("custom");
  });

  it("extracts the first parser line and column for inline errors", () => {
    expect(
      toMermaidRenderError(
        new Error("Parse error on line 4, column 7: unexpected token")
      )
    ).toEqual({
      message: "Parse error on line 4, column 7: unexpected token",
      line: 4,
      column: 7
    });
  });

  it("always returns a readable fallback message", () => {
    expect(toMermaidRenderError(undefined)).toEqual({
      message: "图表语法需要检查。"
    });
  });
});
