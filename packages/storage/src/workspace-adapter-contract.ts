import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  InkLoomError,
  RevisionConflictError,
  workspacePath,
  type DocumentSnapshot,
  type WorkspaceAdapter,
  type WorkspaceNode,
  type WorkspacePath
} from "@inkloom/core";

export type WorkspaceAdapterContractFixture = {
  adapter: WorkspaceAdapter;
  workspaceId: string;
  cleanup?: () => void | Promise<void>;
};

export type WorkspaceAdapterFactory = () =>
  WorkspaceAdapterContractFixture | Promise<WorkspaceAdapterContractFixture>;

export function defineWorkspaceAdapterContract(
  name: string,
  createFixture: WorkspaceAdapterFactory
): void {
  describe(`${name} WorkspaceAdapter contract`, () => {
    let fixture: WorkspaceAdapterContractFixture;

    beforeEach(async () => {
      fixture = await createFixture();
    });

    afterEach(async () => {
      await fixture.cleanup?.();
    });

    it("creates, reads, and lists a document", async () => {
      const document = await createFixtureDocument(fixture, "产品/契约测试.md");
      const loaded = await fixture.adapter.readDocument(document.meta.id);
      const tree = await fixture.adapter.listTree();

      expect(loaded).toEqual(document);
      expect(findDocumentNode(tree, document.meta.path)?.id).toBe(
        document.meta.id
      );
    });

    it("updates metadata and increments revision when baseRevision matches", async () => {
      const document = await createFixtureDocument(fixture, "产品/版本测试.md");
      const next = await fixture.adapter.writeDocument({
        documentId: document.meta.id,
        baseRevision: document.meta.revision,
        markdown: "# 新标题\n",
        title: "新标题",
        tags: ["契约"],
        extensions: { canvas: { title: "测试画布", elements: [] } }
      });

      expect(next.meta.revision).toBe(document.meta.revision + 1);
      expect(next.meta.title).toBe("新标题");
      expect(next.meta.tags).toEqual(["契约"]);
      expect(next.markdown).toBe("# 新标题\n");
    });

    it("rejects writes from a stale revision", async () => {
      const document = await createFixtureDocument(fixture, "产品/冲突测试.md");
      await fixture.adapter.writeDocument({
        documentId: document.meta.id,
        baseRevision: document.meta.revision,
        markdown: "# 第一次更新\n"
      });

      await expect(
        fixture.adapter.writeDocument({
          documentId: document.meta.id,
          baseRevision: document.meta.revision,
          markdown: "# 冲突写入\n"
        })
      ).rejects.toBeInstanceOf(RevisionConflictError);
    });

    it("moves a document using its stable id", async () => {
      const document = await createFixtureDocument(fixture, "产品/移动测试.md");
      const targetPath = workspacePath("架构/已移动.md");
      const moved = await fixture.adapter.moveNode({
        nodeId: document.meta.id,
        targetPath,
        baseRevision: document.meta.revision
      });

      expect(moved.id).toBe(document.meta.id);
      expect(moved.path).toBe(targetPath);
      expect(
        (await fixture.adapter.readDocument(document.meta.id)).meta.path
      ).toBe(targetPath);
    });

    it("deletes a document and reports a typed not-found error", async () => {
      const document = await createFixtureDocument(fixture, "产品/删除测试.md");
      await fixture.adapter.deleteNode({
        nodeId: document.meta.id,
        baseRevision: document.meta.revision
      });

      await expect(
        fixture.adapter.readDocument(document.meta.id)
      ).rejects.toMatchObject({
        code: "DOCUMENT_NOT_FOUND"
      } satisfies Partial<InkLoomError>);
    });
  });
}

async function createFixtureDocument(
  fixture: WorkspaceAdapterContractFixture,
  path: string
): Promise<DocumentSnapshot> {
  return fixture.adapter.createDocument({
    workspaceId: fixture.workspaceId,
    path: workspacePath(path),
    title: "契约测试",
    markdown: "# 契约测试\n"
  });
}

function findDocumentNode(
  node: WorkspaceNode,
  path: WorkspacePath
): WorkspaceNode | undefined {
  if (node.kind === "document") return node.path === path ? node : undefined;
  for (const child of node.children) {
    const match = findDocumentNode(child, path);
    if (match) return match;
  }
  return undefined;
}
