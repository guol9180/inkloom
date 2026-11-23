import {
  contentHash,
  workspacePath,
  type DocumentSnapshot,
  type WorkspaceNode
} from "@inkloom/core";
import { CloudClient, type CloudFetch } from "./cloud";
import { defineWorkspaceAdapterContract } from "./workspace-adapter-contract";

class FakeCloudBackend {
  private readonly documents = new Map<string, DocumentSnapshot>();
  private sequence = 0;

  readonly fetch: CloudFetch = async (input, init = {}) => {
    const url = new URL(input, "http://inkloom.test");
    const parts = url.pathname.split("/").filter(Boolean);
    const method = init.method ?? "GET";
    const workspaceId = parts[2] ?? "workspace";

    if (method === "GET" && parts[3] === "tree") {
      return json(200, { tree: this.tree(workspaceId) });
    }
    if (method === "POST" && parts[3] === "documents") {
      const body = requestBody(init.body);
      const timestamp = this.timestamp();
      const markdown = typeof body.markdown === "string" ? body.markdown : "";
      const document: DocumentSnapshot = {
        meta: {
          id: `cloud-document-${++this.sequence}`,
          workspaceId,
          lifecycle: "scratch",
          path: workspacePath(String(body.path)),
          title: String(body.title),
          tags: Array.isArray(body.tags) ? body.tags.map(String) : [],
          revision: 1,
          contentHash: contentHash(markdown),
          createdAt: timestamp,
          updatedAt: timestamp
        },
        markdown,
        extensions:
          body.extensions && typeof body.extensions === "object"
            ? (body.extensions as DocumentSnapshot["extensions"])
            : undefined
      };
      this.documents.set(document.meta.id, document);
      return json(201, { document });
    }
    if (parts[3] === "documents" && parts[4]) {
      const document = this.documents.get(parts[4]);
      if (!document) return json(404, error("DOCUMENT_NOT_FOUND"));
      if (method === "GET") return json(200, { document });
      if (method === "PUT") {
        const body = requestBody(init.body);
        const expectedRevision = Number(body.baseRevision);
        if (document.meta.revision !== expectedRevision) {
          return json(409, {
            error: {
              code: "REVISION_CONFLICT",
              message: "revision conflict",
              details: {
                documentId: document.meta.id,
                expectedRevision,
                actualRevision: document.meta.revision
              }
            }
          });
        }
        const markdown = String(body.markdown);
        const next: DocumentSnapshot = {
          meta: {
            ...document.meta,
            title:
              body.title === undefined
                ? document.meta.title
                : String(body.title),
            tags: Array.isArray(body.tags)
              ? body.tags.map(String)
              : document.meta.tags,
            revision: document.meta.revision + 1,
            contentHash: contentHash(markdown),
            updatedAt: this.timestamp()
          },
          markdown,
          extensions:
            body.extensions === undefined
              ? document.extensions
              : (body.extensions as DocumentSnapshot["extensions"])
        };
        this.documents.set(next.meta.id, next);
        return json(200, { document: next });
      }
    }
    if (parts[3] === "nodes" && parts[4]) {
      const document = this.documents.get(parts[4]);
      if (!document) return json(404, error("DOCUMENT_NOT_FOUND"));
      if (method === "PUT") {
        const body = requestBody(init.body);
        if (Number(body.baseRevision) !== document.meta.revision) {
          return json(409, {
            error: {
              code: "REVISION_CONFLICT",
              message: "revision conflict",
              details: {
                documentId: document.meta.id,
                expectedRevision: Number(body.baseRevision),
                actualRevision: document.meta.revision
              }
            }
          });
        }
        const path = workspacePath(String(body.targetPath));
        const moved: DocumentSnapshot = {
          ...document,
          meta: {
            ...document.meta,
            path,
            revision: document.meta.revision + 1,
            updatedAt: this.timestamp()
          }
        };
        this.documents.set(moved.meta.id, moved);
        return json(200, {
          node: documentNode(moved)
        });
      }
      if (method === "DELETE") {
        const body = requestBody(init.body);
        if (Number(body.baseRevision) !== document.meta.revision) {
          return json(409, {
            error: {
              code: "REVISION_CONFLICT",
              message: "revision conflict",
              details: {
                documentId: document.meta.id,
                expectedRevision: Number(body.baseRevision),
                actualRevision: document.meta.revision
              }
            }
          });
        }
        this.documents.delete(document.meta.id);
        return json(204, undefined);
      }
    }
    return json(404, error("NOT_FOUND"));
  };

  private tree(workspaceId: string): WorkspaceNode {
    return {
      kind: "folder",
      id: workspaceId,
      name: "Cloud workspace",
      path: workspacePath("workspace"),
      children: [...this.documents.values()].map(documentNode)
    };
  }

  private timestamp() {
    return new Date(Date.UTC(2026, 0, 1, 0, 0, this.sequence)).toISOString();
  }
}

function documentNode(document: DocumentSnapshot): WorkspaceNode {
  return {
    kind: "document",
    id: document.meta.id,
    name: document.meta.path.split("/").at(-1) ?? document.meta.path,
    path: document.meta.path,
    meta: document.meta
  };
}

function requestBody(value: string | ArrayBuffer | undefined) {
  return typeof value === "string"
    ? (JSON.parse(value) as Record<string, unknown>)
    : {};
}

function error(code: string) {
  return { error: { code, message: code } };
}

function json(status: number, value: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return value;
    }
  };
}

defineWorkspaceAdapterContract("CloudWorkspaceAdapter", () => {
  const backend = new FakeCloudBackend();
  const client = new CloudClient({
    baseUrl: "http://inkloom.test",
    fetch: backend.fetch
  });
  return {
    adapter: client.workspace("cloud-contract-workspace"),
    workspaceId: "cloud-contract-workspace"
  };
});
