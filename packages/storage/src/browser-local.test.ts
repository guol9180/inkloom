import { describe, expect, it } from "vitest";
import {
  RevisionConflictError,
  contentHash,
  workspacePath,
  type DocumentSnapshot
} from "@inkloom/core";
import {
  BrowserLocalAdapter,
  type BrowserKeyValueStorage
} from "./browser-local";

class MemoryStorage implements BrowserKeyValueStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

function documentFixture(
  id = "note-1",
  path = "产品/愿景.md",
  revision = 1
): DocumentSnapshot {
  const markdown = "# 愿景\n\n从文件开始。\n";
  return {
    meta: {
      id,
      workspaceId: "prototype",
      path: workspacePath(path),
      title: "愿景",
      tags: ["产品"],
      revision,
      contentHash: contentHash(markdown),
      createdAt: "2026-11-18T08:00:00.000Z",
      updatedAt: "2026-11-18T08:00:00.000Z"
    },
    markdown
  };
}

describe("BrowserLocalAdapter", () => {
  it("round-trips workspace documents and the active document", () => {
    const adapter = new BrowserLocalAdapter({
      storage: new MemoryStorage(),
      now: () => "2026-11-18T09:00:00.000Z"
    });
    const document = documentFixture();

    adapter.saveWorkspace({
      documents: [document],
      activeDocumentId: document.meta.id
    });

    expect(adapter.loadWorkspace()).toEqual({
      documents: [document],
      activeDocumentId: document.meta.id
    });
  });

  it("falls back when persisted data is malformed", () => {
    const storage = new MemoryStorage();
    storage.setItem("inkloom.workspace.v1", "{broken");
    const adapter = new BrowserLocalAdapter({ storage });
    const fallback = documentFixture();

    expect(adapter.loadWorkspace([fallback])).toEqual({
      documents: [fallback]
    });
  });

  it("enforces baseRevision for document writes", async () => {
    const adapter = new BrowserLocalAdapter({
      storage: new MemoryStorage(),
      now: () => "2026-11-18T09:00:00.000Z"
    });
    const document = documentFixture();
    adapter.saveWorkspace({ documents: [document] });

    await expect(
      adapter.writeDocument({
        documentId: document.meta.id,
        markdown: "# 新标题\n",
        baseRevision: 0
      })
    ).rejects.toBeInstanceOf(RevisionConflictError);

    const next = await adapter.writeDocument({
      documentId: document.meta.id,
      markdown: "# 新标题\n",
      baseRevision: 1,
      title: "新标题"
    });
    expect(next.meta.revision).toBe(2);
    expect(next.markdown).toBe("# 新标题\n");
  });

  it("lists logical folders without exposing storage details", async () => {
    const adapter = new BrowserLocalAdapter({ storage: new MemoryStorage() });
    adapter.saveWorkspace({ documents: [documentFixture()] });

    const tree = await adapter.listTree();
    expect(tree.kind).toBe("folder");
    if (tree.kind !== "folder") return;
    expect(tree.children[0]?.name).toBe("产品");
    expect(tree.children[0]?.kind).toBe("folder");
  });
});
