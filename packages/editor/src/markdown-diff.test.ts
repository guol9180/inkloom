import { describe, expect, it } from "vitest";
import { diffMarkdownBlocks } from "./markdown-diff";

describe("Markdown block diff", () => {
  it("marks changed, added and removed top-level blocks", () => {
    const previous = "# 标题\n\n旧段落\n\n保留段落";
    const current = "# 标题\n\n新段落\n\n保留段落\n\n## 新章节";
    expect(diffMarkdownBlocks(previous, current)).toEqual([
      { kind: "unchanged", source: "# 标题" },
      { kind: "removed", source: "旧段落" },
      { kind: "added", source: "新段落" },
      { kind: "unchanged", source: "保留段落" },
      { kind: "added", source: "## 新章节" }
    ]);
  });

  it("keeps code and diagram blocks as single diff units", () => {
    expect(
      diffMarkdownBlocks(
        "```mermaid\nflowchart LR\n A-->B\n```",
        "```mermaid\nflowchart LR\n A-->C\n```"
      )
    ).toEqual([
      {
        kind: "removed",
        source: "```mermaid\nflowchart LR\n A-->B\n```"
      },
      {
        kind: "added",
        source: "```mermaid\nflowchart LR\n A-->C\n```"
      }
    ]);
  });
});
