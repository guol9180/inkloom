import type { AddressInfo } from "node:net";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createApiServer } from "./server";

type TestServer = {
  baseUrl: string;
  close: () => Promise<void>;
};

const activeServers: TestServer[] = [];

afterEach(async () => {
  await Promise.all(activeServers.splice(0).map((fixture) => fixture.close()));
});

describe("InkLoom API", () => {
  it("registers a user, persists documents, and restores an earlier revision", async () => {
    const fixture = await startServer();
    const session = await register(fixture, "writer@example.com", "secret-123");
    const workspaces = await json<{
      workspaces: Array<{ id: string; name: string }>;
    }>(fixture, "/api/workspaces", { cookie: session.cookie });
    const workspaceId = workspaces.workspaces[0].id;

    const created = await json<{
      document: { meta: { id: string; revision: number }; markdown: string };
    }>(fixture, `/api/workspaces/${workspaceId}/documents`, {
      method: "POST",
      cookie: session.cookie,
      body: {
        path: "测试/持久化.md",
        title: "持久化",
        markdown: "# 第一版\n",
        tags: ["测试"]
      }
    });
    const documentId = created.document.meta.id;

    const updated = await json<{
      document: { meta: { revision: number }; markdown: string };
    }>(fixture, `/api/workspaces/${workspaceId}/documents/${documentId}`, {
      method: "PUT",
      cookie: session.cookie,
      body: {
        baseRevision: created.document.meta.revision,
        title: "持久化",
        markdown: "# 第二版\n",
        tags: ["测试", "云端"]
      }
    });
    expect(updated.document.meta.revision).toBe(2);

    const reloaded = await json<{
      document: { markdown: string; meta: { revision: number } };
    }>(fixture, `/api/workspaces/${workspaceId}/documents/${documentId}`, {
      cookie: session.cookie
    });
    expect(reloaded.document.markdown).toBe("# 第二版\n");

    const revisions = await json<{
      revisions: Array<{ revisionId: string; meta: { revision: number } }>;
    }>(
      fixture,
      `/api/workspaces/${workspaceId}/documents/${documentId}/revisions`,
      { cookie: session.cookie }
    );
    expect(revisions.revisions[0].meta.revision).toBe(1);

    await json(
      fixture,
      `/api/workspaces/${workspaceId}/documents/${documentId}/revisions/${
        revisions.revisions[0].revisionId
      }`,
      {
        method: "POST",
        cookie: session.cookie,
        body: { baseRevision: 2 }
      }
    );

    const restored = await json<{
      document: { markdown: string; meta: { revision: number } };
    }>(fixture, `/api/workspaces/${workspaceId}/documents/${documentId}`, {
      cookie: session.cookie
    });
    expect(restored.document).toMatchObject({
      markdown: "# 第一版\n",
      meta: { revision: 3 }
    });
  });

  it("writes autosaves without history until an explicit checkpoint", async () => {
    const fixture = await startServer();
    const session = await register(
      fixture,
      "checkpoint@example.com",
      "secret-123"
    );
    const workspaces = await json<{ workspaces: Array<{ id: string }> }>(
      fixture,
      "/api/workspaces",
      { cookie: session.cookie }
    );
    const workspaceId = workspaces.workspaces[0].id;
    const created = await json<{
      document: { meta: { id: string; revision: number } };
    }>(fixture, `/api/workspaces/${workspaceId}/documents`, {
      method: "POST",
      cookie: session.cookie,
      body: {
        path: "测试/自动保存.md",
        title: "自动保存",
        markdown: "# v1\n"
      }
    });
    const documentId = created.document.meta.id;

    const autosaved = await json<{
      document: { meta: { revision: number } };
    }>(fixture, `/api/workspaces/${workspaceId}/documents/${documentId}`, {
      method: "PUT",
      cookie: session.cookie,
      body: {
        baseRevision: 1,
        checkpoint: false,
        markdown: "# v2\n"
      }
    });
    expect(autosaved.document.meta.revision).toBe(2);

    const emptyHistory = await json<{ revisions: unknown[] }>(
      fixture,
      `/api/workspaces/${workspaceId}/documents/${documentId}/revisions`,
      { cookie: session.cookie }
    );
    expect(emptyHistory.revisions).toEqual([]);

    const checkpointed = await json<{
      document: { meta: { revision: number } };
    }>(fixture, `/api/workspaces/${workspaceId}/documents/${documentId}`, {
      method: "PUT",
      cookie: session.cookie,
      body: {
        baseRevision: 2,
        checkpoint: true,
        markdown: "# v2\n"
      }
    });
    expect(checkpointed.document.meta.revision).toBe(3);

    const history = await json<{
      revisions: Array<{ meta: { revision: number } }>;
    }>(
      fixture,
      `/api/workspaces/${workspaceId}/documents/${documentId}/revisions`,
      { cookie: session.cookie }
    );
    expect(history.revisions.map((entry) => entry.meta.revision)).toEqual([2]);
  });

  it("streams content-addressed assets and keeps referenced blobs", async () => {
    const fixture = await startServer();
    const session = await register(
      fixture,
      "assets@example.com",
      "secret-123"
    );
    const workspaces = await json<{ workspaces: Array<{ id: string }> }>(
      fixture,
      "/api/workspaces",
      { cookie: session.cookie }
    );
    const workspaceId = workspaces.workspaces[0].id;
    const preflight = await raw(
      fixture,
      `/api/workspaces/${workspaceId}/assets`,
      {
        method: "OPTIONS",
        origin: "http://127.0.0.1:4173"
      }
    );
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("access-control-allow-headers")).toContain(
      "X-InkLoom-Kind"
    );
    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(3 * 1024 * 1024, 0x2a)
    ]);
    const hash = createHash("sha256").update(png).digest("hex");
    const uploaded = await json<{
      deduplicated: boolean;
      asset: { id: string; hash: string; size: number; url: string };
    }>(fixture, `/api/workspaces/${workspaceId}/assets`, {
      method: "POST",
      cookie: session.cookie,
      contentType: "image/png",
      headers: { "X-InkLoom-Kind": "image" },
      body: png
    });
    expect(uploaded).toMatchObject({
      deduplicated: false,
      asset: { hash, size: png.length }
    });

    const duplicate = await json<{
      deduplicated: boolean;
      asset: { id: string };
    }>(fixture, `/api/workspaces/${workspaceId}/assets`, {
      method: "POST",
      cookie: session.cookie,
      contentType: "image/png",
      headers: { "X-InkLoom-Kind": "image" },
      body: png
    });
    expect(duplicate.deduplicated).toBe(true);
    expect(duplicate.asset.id).toBe(uploaded.asset.id);

    const content = await raw(
      fixture,
      `/api/workspaces/${workspaceId}/assets/${hash}`,
      { cookie: session.cookie }
    );
    expect(content.status).toBe(200);
    expect(content.headers.get("content-type")).toBe("image/png");
    expect(content.headers.get("cache-control")).toContain("immutable");
    expect(Buffer.from(await content.arrayBuffer()).equals(png)).toBe(true);
    const info = await json<{ asset: { hash: string; size: number } }>(
      fixture,
      `/api/workspaces/${workspaceId}/assets/${hash}/info`,
      { cookie: session.cookie }
    );
    expect(info.asset).toMatchObject({ hash, size: png.length });
    const head = await raw(
      fixture,
      `/api/workspaces/${workspaceId}/assets/${hash}`,
      { method: "HEAD", cookie: session.cookie }
    );
    expect(head.status).toBe(200);
    expect(head.headers.get("content-length")).toBe(String(png.length));
    const bob = await register(fixture, "asset-bob@example.com", "secret-456");
    const forbidden = await raw(
      fixture,
      `/api/workspaces/${workspaceId}/assets/${hash}`,
      { cookie: bob.cookie }
    );
    expect(forbidden.status).toBe(404);

    const created = await json<{
      document: { meta: { id: string; revision: number } };
    }>(fixture, `/api/workspaces/${workspaceId}/documents`, {
      method: "POST",
      cookie: session.cookie,
      body: {
        path: "资产引用.md",
        title: "资产引用",
        markdown: `![测试](assets/${hash}.png)\n`
      }
    });
    const documentId = created.document.meta.id;
    const retained = await json<{ count: number }>(
      fixture,
      `/api/workspaces/${workspaceId}/assets/cleanup`,
      {
        method: "POST",
        cookie: session.cookie,
        body: { unusedForHours: 0 }
      }
    );
    expect(retained.count).toBe(0);

    await json(fixture, `/api/workspaces/${workspaceId}/documents/${documentId}`, {
      method: "PUT",
      cookie: session.cookie,
      body: {
        baseRevision: 1,
        checkpoint: true,
        markdown: "已移除资产引用。\n"
      }
    });
    const removed = await json<{ count: number }>(
      fixture,
      `/api/workspaces/${workspaceId}/assets/cleanup`,
      {
        method: "POST",
        cookie: session.cookie,
        body: { unusedForHours: 0 }
      }
    );
    expect(removed.count).toBe(1);
    const missing = await raw(
      fixture,
      `/api/workspaces/${workspaceId}/assets/${hash}`,
      { cookie: session.cookie }
    );
    expect(missing.status).toBe(404);

    const mismatch = await raw(
      fixture,
      `/api/workspaces/${workspaceId}/assets`,
      {
        method: "POST",
        cookie: session.cookie,
        contentType: "image/png",
        headers: { "X-InkLoom-Kind": "image" },
        body: Buffer.from("not a png")
      }
    );
    expect(mismatch.status).toBe(415);

  });

  it("rejects stale revisions and isolates workspaces between users", async () => {
    const fixture = await startServer();
    const alice = await register(fixture, "alice@example.com", "secret-123");
    const bob = await register(fixture, "bob@example.com", "secret-456");
    const aliceWorkspaces = await json<{ workspaces: Array<{ id: string }> }>(
      fixture,
      "/api/workspaces",
      { cookie: alice.cookie }
    );
    const workspaceId = aliceWorkspaces.workspaces[0].id;
    const created = await json<{ document: { meta: { id: string; revision: number } } }>(
      fixture,
      `/api/workspaces/${workspaceId}/documents`,
      {
        method: "POST",
        cookie: alice.cookie,
        body: {
          path: "测试/冲突.md",
          title: "冲突",
          markdown: "# v1\n"
        }
      }
    );
    const documentId = created.document.meta.id;
    await json(fixture, `/api/workspaces/${workspaceId}/documents/${documentId}`, {
      method: "PUT",
      cookie: alice.cookie,
      body: { baseRevision: 1, markdown: "# v2\n" }
    });

    const conflict = await raw(
      fixture,
      `/api/workspaces/${workspaceId}/documents/${documentId}`,
      {
        method: "PUT",
        cookie: alice.cookie,
        body: { baseRevision: 1, markdown: "# stale\n" }
      }
    );
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toMatchObject({
      error: {
        code: "REVISION_CONFLICT",
        details: { expectedRevision: 1, actualRevision: 2 }
      }
    });

    const forbidden = await raw(fixture, `/api/workspaces/${workspaceId}/tree`, {
      cookie: bob.cookie
    });
    expect(forbidden.status).toBe(404);
  });

  it("round-trips unknown Markdown syntax without changing bytes", async () => {
    const fixture = await startServer();
    const session = await register(
      fixture,
      "fidelity@example.com",
      "secret-123"
    );
    const workspaces = await json<{ workspaces: Array<{ id: string }> }>(
      fixture,
      "/api/workspaces",
      { cookie: session.cookie }
    );
    const workspaceId = workspaces.workspaces[0].id;
    const markdown = [
      "---",
      "title: 保留字段",
      "unknown_field:",
      "  nested: true",
      "---",
      "",
      "# 中文标题，原样保存！",
      "",
      "<!-- inkloom:canvas",
      "id: canvas_01JABC",
      "scene: assets/hash.excalidraw",
      "-->",
      "![系统边界](assets/hash.svg)",
      "<!-- /inkloom:canvas -->",
      "",
      "```unknown-language",
      "raw syntax",
      "```",
      "",
      "[reference]: https://example.com \"引用标题\"",
      "",
      "使用 [引用][reference] 与脚注[^note]。",
      "",
      "[^note]: 脚注定义。",
      "",
      "<aside data-unknown=\"yes\">未知 HTML</aside>",
      "",
      "最后一行没有换行"
    ].join("\n");

    const created = await json<{
      document: { meta: { id: string; revision: number } };
    }>(fixture, `/api/workspaces/${workspaceId}/documents`, {
      method: "POST",
      cookie: session.cookie,
      body: {
        path: "保真.md",
        title: "保真",
        markdown
      }
    });
    const reloaded = await json<{ document: { markdown: string } }>(
      fixture,
      `/api/workspaces/${workspaceId}/documents/${created.document.meta.id}`,
      { cookie: session.cookie }
    );
    expect(reloaded.document.markdown).toBe(markdown);

    const updated = await json<{
      document: { markdown: string; meta: { revision: number } };
    }>(
      fixture,
      `/api/workspaces/${workspaceId}/documents/${created.document.meta.id}`,
      {
        method: "PUT",
        cookie: session.cookie,
        body: {
          baseRevision: created.document.meta.revision,
          markdown: `${markdown}\n\n一次临时修改`
        }
      }
    );
    expect(updated.document.markdown).toBe(`${markdown}\n\n一次临时修改`);

    const revisions = await json<{
      revisions: Array<{ revisionId: string; meta: { revision: number } }>;
    }>(
      fixture,
      `/api/workspaces/${workspaceId}/documents/${created.document.meta.id}/revisions`,
      { cookie: session.cookie }
    );
    expect(revisions.revisions[0].meta.revision).toBe(1);
    await json(
      fixture,
      `/api/workspaces/${workspaceId}/documents/${created.document.meta.id}/revisions/${revisions.revisions[0].revisionId}`,
      {
        method: "POST",
        cookie: session.cookie,
        body: { baseRevision: updated.document.meta.revision }
      }
    );
    const restored = await json<{ document: { markdown: string } }>(
      fixture,
      `/api/workspaces/${workspaceId}/documents/${created.document.meta.id}`,
      { cookie: session.cookie }
    );
    expect(restored.document.markdown).toBe(markdown);
  });

  it("keeps the session across refresh, logs out, and enforces the origin allow list", async () => {
    const fixture = await startServer();
    const session = await register(fixture, "session@example.com", "secret-123");

    const me = await json<{ user: { email: string } }>(fixture, "/api/auth/me", {
      cookie: session.cookie
    });
    expect(me.user.email).toBe("session@example.com");

    const login = await raw(fixture, "/api/auth/login", {
      method: "POST",
      body: { email: "session@example.com", password: "secret-123" }
    });
    expect(login.status).toBe(200);

    const logout = await raw(fixture, "/api/auth/logout", {
      method: "POST",
      cookie: session.cookie
    });
    expect(logout.status).toBe(204);
    const afterLogout = await raw(fixture, "/api/auth/me", {
      cookie: session.cookie
    });
    expect(afterLogout.status).toBe(401);

    const denied = await raw(fixture, "/api/health", {
      origin: "https://attacker.example"
    });
    expect(denied.status).toBe(403);
  });

  it("moves documents by stable id and rejects path traversal", async () => {
    const fixture = await startServer();
    const session = await register(fixture, "move@example.com", "secret-123");
    const workspaces = await json<{ workspaces: Array<{ id: string }> }>(
      fixture,
      "/api/workspaces",
      { cookie: session.cookie }
    );
    const workspaceId = workspaces.workspaces[0].id;
    const created = await json<{ document: { meta: { id: string; revision: number } } }>(
      fixture,
      `/api/workspaces/${workspaceId}/documents`,
      {
        method: "POST",
        cookie: session.cookie,
        body: {
          path: "产品/移动前.md",
          title: "移动前",
          markdown: "# 移动前\n"
        }
      }
    );
    const moved = await json<{
      node: { id: string; path: string; meta: { revision: number } };
    }>(
      fixture,
      `/api/workspaces/${workspaceId}/nodes/${created.document.meta.id}`,
      {
        method: "PUT",
        cookie: session.cookie,
        body: { targetPath: "架构/移动后.md", baseRevision: 1 }
      }
    );
    expect(moved.node).toMatchObject({
      id: created.document.meta.id,
      path: "架构/移动后.md",
      meta: { revision: 2 }
    });

    const traversal = await raw(
      fixture,
      `/api/workspaces/${workspaceId}/documents`,
      {
        method: "POST",
        cookie: session.cookie,
        body: {
          path: "../越界.md",
          title: "越界",
          markdown: "# 越界\n"
        }
      }
    );
    expect(traversal.status).toBe(400);
  });

  it("renames a workspace without exposing it to another user", async () => {
    const fixture = await startServer();
    const alice = await register(fixture, "rename@example.com", "secret-123");
    const bob = await register(fixture, "rename-other@example.com", "secret-456");
    const workspaces = await json<{ workspaces: Array<{ id: string; name: string }> }>(
      fixture,
      "/api/workspaces",
      { cookie: alice.cookie }
    );
    const workspaceId = workspaces.workspaces[0].id;

    const renamed = await json<{ workspace: { name: string } }>(
      fixture,
      `/api/workspaces/${workspaceId}`,
      {
        method: "PATCH",
        cookie: alice.cookie,
        body: { name: "长期写作" }
      }
    );
    expect(renamed.workspace.name).toBe("长期写作");

    const forbidden = await raw(
      fixture,
      `/api/workspaces/${workspaceId}`,
      {
        method: "PATCH",
        cookie: bob.cookie,
        body: { name: "越权修改" }
      }
    );
    expect(forbidden.status).toBe(404);
  });

  it("manages scratch notes, flat knowledge bases, archive and restore workflows", async () => {
    const fixture = await startServer();
    const alice = await register(fixture, "workflow@example.com", "secret-123");
    const bob = await register(
      fixture,
      "workflow-other@example.com",
      "secret-456"
    );
    const workspaces = await json<{ workspaces: Array<{ id: string }> }>(
      fixture,
      "/api/workspaces",
      { cookie: alice.cookie }
    );
    const workspaceId = workspaces.workspaces[0].id;

    const initialNotes = await json<{
      documents: Array<{ id: string; title: string; revision: number }>;
    }>(fixture, `/api/workspaces/${workspaceId}/notes`, {
      cookie: alice.cookie
    });
    expect(initialNotes.documents).toHaveLength(1);

    const note = await json<{
      document: {
        meta: {
          id: string;
          revision: number;
          lifecycle: string;
          path: string;
        };
      };
    }>(fixture, `/api/workspaces/${workspaceId}/documents`, {
      method: "POST",
      cookie: alice.cookie,
      body: {
        path: "同名.md",
        title: "Alpha 随记",
        markdown: "# Alpha 随记\n\n需要归档的内容。\n",
        tags: ["随记"]
      }
    });
    expect(note.document.meta).toMatchObject({
      lifecycle: "scratch",
      revision: 1
    });
    const sortedNotes = await json<{
      documents: Array<{ title: string }>;
    }>(fixture, `/api/workspaces/${workspaceId}/notes?sort=title`, {
      cookie: alice.cookie
    });
    expect(sortedNotes.documents[0].title).toBe("Alpha 随记");

    const knowledgeBase = await json<{
      knowledgeBase: { id: string; revision: number; name: string };
    }>(fixture, `/api/workspaces/${workspaceId}/knowledge-bases`, {
      method: "POST",
      cookie: alice.cookie,
      body: { name: "产品知识" }
    });
    expect(knowledgeBase.knowledgeBase).toMatchObject({
      name: "产品知识",
      revision: 1
    });

    const archived = await json<{
      document: {
        meta: {
          id: string;
          revision: number;
          lifecycle: string;
          knowledgeBaseId: string;
          archivedAt: string;
        };
      };
    }>(
      fixture,
      `/api/workspaces/${workspaceId}/documents/${note.document.meta.id}/archive`,
      {
        method: "POST",
        cookie: alice.cookie,
        body: {
          knowledgeBaseId: knowledgeBase.knowledgeBase.id,
          baseRevision: 1
        }
      }
    );
    expect(archived.document.meta).toMatchObject({
      lifecycle: "knowledge",
      knowledgeBaseId: knowledgeBase.knowledgeBase.id,
      revision: 2
    });

    const notesAfterArchive = await json<{
      documents: Array<{ id: string }>;
    }>(fixture, `/api/workspaces/${workspaceId}/notes`, {
      cookie: alice.cookie
    });
    expect(notesAfterArchive.documents.map((document) => document.id)).not.toContain(
      note.document.meta.id
    );

    const knowledgeDocuments = await json<{
      documents: Array<{
        id: string;
        lifecycle: string;
        excerpt: string;
      }>;
    }>(
      fixture,
      `/api/workspaces/${workspaceId}/knowledge-bases/${knowledgeBase.knowledgeBase.id}/documents`,
      { cookie: alice.cookie }
    );
    expect(knowledgeDocuments.documents).toEqual([
      expect.objectContaining({
        id: note.document.meta.id,
        lifecycle: "knowledge",
        excerpt: "Alpha 随记 需要归档的内容。"
      })
    ]);

    const opened = await json<{
      document: { meta: { revision: number; lastOpenedAt: string } };
    }>(
      fixture,
      `/api/workspaces/${workspaceId}/documents/${note.document.meta.id}/open`,
      {
        method: "POST",
        cookie: alice.cookie,
        body: { baseRevision: 2 }
      }
    );
    expect(opened.document.meta).toMatchObject({ revision: 3 });
    expect(opened.document.meta.lastOpenedAt).toBeTruthy();

    const recent = await json<{ documents: Array<{ id: string }> }>(
      fixture,
      `/api/workspaces/${workspaceId}/notes/recent`,
      { cookie: alice.cookie }
    );
    expect(recent.documents[0].id).toBe(note.document.meta.id);

    const renamed = await json<{
      knowledgeBase: { name: string; revision: number };
    }>(
      fixture,
      `/api/workspaces/${workspaceId}/knowledge-bases/${knowledgeBase.knowledgeBase.id}`,
      {
        method: "PATCH",
        cookie: alice.cookie,
        body: {
          name: "产品资料",
          sortOrder: 3,
          baseRevision: 1
        }
      }
    );
    expect(renamed.knowledgeBase).toMatchObject({
      name: "产品资料",
      revision: 2
    });

    const staleKnowledgeBase = await raw(
      fixture,
      `/api/workspaces/${workspaceId}/knowledge-bases/${knowledgeBase.knowledgeBase.id}`,
      {
        method: "PATCH",
        cookie: alice.cookie,
        body: { name: "过期修改", baseRevision: 1 }
      }
    );
    expect(staleKnowledgeBase.status).toBe(409);
    expect(await staleKnowledgeBase.json()).toMatchObject({
      error: { code: "KNOWLEDGE_BASE_REVISION_CONFLICT" }
    });

    await json(fixture, `/api/workspaces/${workspaceId}/documents`, {
      method: "POST",
      cookie: alice.cookie,
      body: {
        path: "同名.md",
        title: "随记乙",
        markdown: "# 随记乙\n"
      }
    });
    const restored = await json<{
      document: {
        meta: {
          lifecycle: string;
          path: string;
          knowledgeBaseId?: string;
          revision: number;
        };
      };
    }>(
      fixture,
      `/api/workspaces/${workspaceId}/documents/${note.document.meta.id}/restore-to-notes`,
      {
        method: "POST",
        cookie: alice.cookie,
        body: { baseRevision: 3 }
      }
    );
    expect(restored.document.meta).toMatchObject({
      lifecycle: "scratch",
      path: "同名 (2).md",
      revision: 4
    });
    expect(restored.document.meta.knowledgeBaseId).toBeUndefined();

    const archivedDefault = await json<{
      document: { meta: { id: string; revision: number } };
    }>(
      fixture,
      `/api/workspaces/${workspaceId}/documents/${initialNotes.documents[0].id}/archive`,
      {
        method: "POST",
        cookie: alice.cookie,
        body: {
          knowledgeBaseId: knowledgeBase.knowledgeBase.id,
          baseRevision: initialNotes.documents[0].revision
        }
      }
    );

    const staleDelete = await raw(
      fixture,
      `/api/workspaces/${workspaceId}/knowledge-bases/${knowledgeBase.knowledgeBase.id}`,
      {
        method: "DELETE",
        cookie: alice.cookie,
        body: { baseRevision: 1 }
      }
    );
    expect(staleDelete.status).toBe(409);

    const deleted = await json<{
      documents: Array<{ meta: { lifecycle: string; revision: number } }>;
    }>(
      fixture,
      `/api/workspaces/${workspaceId}/knowledge-bases/${knowledgeBase.knowledgeBase.id}`,
      {
        method: "DELETE",
        cookie: alice.cookie,
        body: { baseRevision: 2 }
      }
    );
    expect(deleted.documents).toEqual([
      expect.objectContaining({
        meta: expect.objectContaining({
          lifecycle: "scratch",
          revision: archivedDefault.document.meta.revision + 1
        })
      })
    ]);

    const knowledgeBases = await json<{ knowledgeBases: unknown[] }>(
      fixture,
      `/api/workspaces/${workspaceId}/knowledge-bases`,
      { cookie: alice.cookie }
    );
    expect(knowledgeBases.knowledgeBases).toEqual([]);

    const forbidden = await raw(
      fixture,
      `/api/workspaces/${workspaceId}/notes`,
      { cookie: bob.cookie }
    );
    expect(forbidden.status).toBe(404);
  });
});

async function startServer(): Promise<TestServer> {
  const assetDirectory = mkdtempSync(join(tmpdir(), "inkloom-assets-"));
  const application = createApiServer({
    databaseOptions: { filename: ":memory:" },
    assetDirectory,
    allowedOrigins: ["http://127.0.0.1:4173"],
    secureCookies: false
  });
  await new Promise<void>((resolve) => {
    application.server.listen(0, "127.0.0.1", resolve);
  });
  const address = application.server.address() as AddressInfo;
  const fixture: TestServer = {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: async () => {
      await application.close();
      rmSync(assetDirectory, { recursive: true, force: true });
    }
  };
  activeServers.push(fixture);
  return fixture;
}

async function register(
  fixture: TestServer,
  email: string,
  password: string
): Promise<{ cookie: string }> {
  const response = await raw(fixture, "/api/auth/register", {
    method: "POST",
    body: { displayName: "测试作者", email, password }
  });
  expect(response.status).toBe(201);
  const setCookie = response.headers.get("set-cookie");
  expect(setCookie).toContain("HttpOnly");
  expect(setCookie).toContain("SameSite=Lax");
  const cookie = setCookie?.split(";")[0];
  if (!cookie) throw new Error("Registration did not set a session cookie.");
  return { cookie };
}

async function json<T>(
  fixture: TestServer,
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const response = await raw(fixture, path, options);
  if (!response.ok) {
    throw new Error(`${response.status}: ${await response.text()}`);
  }
  return (await response.json()) as T;
}

type RequestOptions = {
  method?: string;
  cookie?: string;
  origin?: string;
  body?: unknown;
  contentType?: string;
  headers?: Record<string, string>;
};

async function raw(
  fixture: TestServer,
  path: string,
  options: RequestOptions = {}
): Promise<Response> {
  const headers: Record<string, string> = {};
  if (options.cookie) headers.Cookie = options.cookie;
  if (options.origin) headers.Origin = options.origin;
  Object.assign(headers, options.headers);
  if (options.body !== undefined) {
    headers["Content-Type"] =
      options.contentType ?? "application/json";
  }
  const body =
    options.body === undefined
      ? undefined
      : Buffer.isBuffer(options.body) || options.body instanceof Uint8Array
        ? options.body
        : typeof options.body === "string"
          ? options.body
          : JSON.stringify(options.body);
  return fetch(`${fixture.baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers,
    body
  });
}
