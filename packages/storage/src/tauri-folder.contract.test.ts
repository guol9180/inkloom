import {
  InkLoomError,
  RevisionConflictError,
  contentHash,
  workspacePath,
  type DocumentSnapshot,
  type WorkspaceNode
} from "@inkloom/core";
import { createTauriFolderAdapter, type TauriInvoke } from "./tauri-folder";
import { defineWorkspaceAdapterContract } from "./workspace-adapter-contract";

class FakeTauriBackend {
  private readonly documents = new Map<
    string,
    { path: ReturnType<typeof workspacePath>; snapshot: DocumentSnapshot }
  >();
  private nextId = 1;

  readonly invoke: TauriInvoke = async <TResult>(
    command: string,
    args?: Record<string, unknown>
  ): Promise<TResult> => {
    const request = (args?.request ?? {}) as Record<string, unknown>;

    switch (command) {
      case "list_tree":
        return this.tree() as TResult;
      case "read_document":
        return this.require(String(request.documentId)).snapshot as TResult;
      case "create_document":
        return this.create(request) as TResult;
      case "write_document":
        return this.write(request) as TResult;
      case "move_node":
        return this.move(request) as TResult;
      case "delete_node":
        this.delete(String(request.nodeId));
        return undefined as TResult;
      case "current_workspace":
        return { root: "D:\\workspace", name: "workspace" } as TResult;
      case "open_workspace":
        return { root: "D:\\workspace", name: "workspace" } as TResult;
      default:
        throw new Error(`Unexpected Tauri command: ${command}`);
    }
  };

  private create(request: Record<string, unknown>): DocumentSnapshot {
    const id = `tauri-document-${this.nextId++}`;
    const markdown = String(request.markdown ?? `# ${String(request.title)}\n`);
    const path = workspacePath(String(request.path));
    const snapshot: DocumentSnapshot = {
      meta: {
        id,
        workspaceId: String(request.workspaceId ?? "workspace"),
        lifecycle: "scratch",
        path,
        title: String(request.title ?? "Untitled"),
        tags: [],
        revision: 1,
        contentHash: contentHash(markdown),
        createdAt: "2026-11-18T00:00:00.000Z",
        updatedAt: "2026-11-18T00:00:00.000Z"
      },
      markdown
    };
    this.documents.set(id, { path, snapshot });
    return clone(snapshot);
  }

  private write(request: Record<string, unknown>): DocumentSnapshot {
    const id = String(request.documentId);
    const current = this.require(id).snapshot;
    const baseRevision = Number(request.baseRevision);
    if (current.meta.revision !== baseRevision) {
      throw new RevisionConflictError(id, baseRevision, current.meta.revision);
    }
    const markdown = String(request.markdown);
    const next: DocumentSnapshot = {
      meta: {
        ...current.meta,
        title:
          typeof request.title === "string"
            ? request.title
            : (markdown.match(/^#\s+(.+)$/m)?.[1] ?? current.meta.title),
        tags: Array.isArray(request.tags)
          ? request.tags.map(String)
          : current.meta.tags,
        revision: current.meta.revision + 1,
        updatedAt: "2026-11-18T00:01:00.000Z"
      },
      markdown
    };
    this.documents.set(id, { ...this.documents.get(id)!, snapshot: next });
    return clone(next);
  }

  private move(request: Record<string, unknown>): WorkspaceNode {
    const id = String(request.nodeId);
    const current = this.require(id);
    const baseRevision = Number(request.baseRevision);
    if (current.snapshot.meta.revision !== baseRevision) {
      throw new RevisionConflictError(
        id,
        baseRevision,
        current.snapshot.meta.revision
      );
    }
    const path = workspacePath(String(request.targetPath));
    const snapshot: DocumentSnapshot = {
      ...current.snapshot,
      meta: {
        ...current.snapshot.meta,
        path,
        revision: current.snapshot.meta.revision + 1
      }
    };
    this.documents.set(id, { path, snapshot });
    return {
      kind: "document",
      id,
      name: path.split("/").at(-1) ?? "document.md",
      path,
      meta: snapshot.meta
    };
  }

  private delete(id: string): void {
    this.require(id);
    this.documents.delete(id);
  }

  private require(id: string): {
    path: ReturnType<typeof workspacePath>;
    snapshot: DocumentSnapshot;
  } {
    const document = this.documents.get(id);
    if (!document) {
      throw new InkLoomError("DOCUMENT_NOT_FOUND", `Document not found: ${id}`);
    }
    return document;
  }

  private tree(): WorkspaceNode {
    const children = [...this.documents.values()].map(({ path, snapshot }) => ({
      kind: "document" as const,
      id: snapshot.meta.id,
      name: path.split("/").at(-1) ?? "document.md",
      path,
      meta: snapshot.meta
    }));
    return {
      kind: "folder",
      id: "workspace-root",
      name: "workspace",
      path: workspacePath("workspace"),
      children
    };
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

defineWorkspaceAdapterContract("TauriFolderAdapter", () => {
  const backend = new FakeTauriBackend();
  return {
    adapter: createTauriFolderAdapter({
      invoke: backend.invoke,
      listen: async () => () => undefined
    }),
    workspaceId: "tauri-contract-workspace"
  };
});
