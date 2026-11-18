import type { AddressInfo } from "node:net";
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
});

async function startServer(): Promise<TestServer> {
  const application = createApiServer({
    databaseOptions: { filename: ":memory:" },
    allowedOrigins: ["http://127.0.0.1:4173"],
    secureCookies: false
  });
  await new Promise<void>((resolve) => {
    application.server.listen(0, "127.0.0.1", resolve);
  });
  const address = application.server.address() as AddressInfo;
  const fixture: TestServer = {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: application.close
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
};

async function raw(
  fixture: TestServer,
  path: string,
  options: RequestOptions = {}
): Promise<Response> {
  const headers: Record<string, string> = {};
  if (options.cookie) headers.Cookie = options.cookie;
  if (options.origin) headers.Origin = options.origin;
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  return fetch(`${fixture.baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers,
    body:
      options.body === undefined ? undefined : JSON.stringify(options.body)
  });
}
