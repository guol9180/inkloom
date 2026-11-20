import { describe, expect, it } from "vitest";
import { extractDocumentLinks } from "./links";

describe("document link extraction", () => {
  it("finds Markdown, wiki, anchor and broken internal links", () => {
    expect(
      extractDocumentLinks(
        "[产品](产品/需求.md#范围) [[架构|系统架构]] ![图](assets/hash.png) [外链](https://example.com)"
      )
    ).toEqual([
      { targetPath: "产品/需求.md", linkText: "产品", anchor: "范围" },
      { targetPath: "架构", linkText: "系统架构" }
    ]);
  });
});
