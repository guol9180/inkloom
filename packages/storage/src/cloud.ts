import {
  RevisionConflictError,
  type CreateDocumentInput,
  type DeleteNodeInput,
  type DocumentExtensions,
  type DocumentId,
  type DocumentMeta,
  type DocumentSnapshot,
  type MoveNodeInput,
  type StorageCapabilities,
  type WorkspaceAdapter,
  type WorkspaceId,
  type WorkspaceNode,
  type WriteDocumentInput
} from "@inkloom/core";

export type CloudUser = {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
};

export type CloudWorkspace = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type CloudDocumentRevision = DocumentSnapshot & {
  revisionId: string;
  recordedAt: string;
};

export type CloudDocumentSummary = DocumentMeta & {
  excerpt: string;
};

export type CloudKnowledgeBase = {
  id: string;
  workspaceId: WorkspaceId;
  name: string;
  sortOrder: number;
  revision: number;
  createdAt: string;
  updatedAt: string;
};

export type CloudDocumentSort = "updated" | "created" | "title";

export type CloudAssetKind = "image" | "attachment" | "excalidraw" | "svg";

export type CloudAsset = {
  id: string;
  workspaceId: WorkspaceId;
  hash: string;
  mime: string;
  size: number;
  kind: CloudAssetKind;
  createdAt: string;
  url: string;
};

export type CloudFetchResponse = {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
  arrayBuffer?(): Promise<ArrayBuffer>;
};

export type CloudFetch = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string | ArrayBuffer;
    credentials?: "include" | "same-origin" | "omit";
    signal?: AbortSignal;
  }
) => Promise<CloudFetchResponse>;

export type CloudClientOptions = {
  baseUrl?: string;
  fetch: CloudFetch;
};

type ApiErrorBody = {
  error?: {
    code?: string;
    message?: string;
    details?: {
      documentId?: string;
      expectedRevision?: number;
      actualRevision?: number;
    };
  };
};

export class CloudRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: ApiErrorBody["error"] extends infer T
      ? T extends { details?: infer D }
        ? D
        : never
      : never
  ) {
    super(message);
    this.name = "CloudRequestError";
  }
}

export class CloudClient {
  private readonly baseUrl: string;
  private readonly fetch: CloudFetch;

  constructor(options: CloudClientOptions) {
    this.baseUrl = options.baseUrl?.replace(/\/$/, "") ?? "";
    this.fetch = options.fetch;
  }

  async getSession(): Promise<CloudUser | undefined> {
    try {
      const response = await this.request<{ user: CloudUser }>("/api/auth/me");
      return response.user;
    } catch (error) {
      if (error instanceof CloudRequestError && error.status === 401) return undefined;
      throw error;
    }
  }

  async register(input: {
    email: string;
    password: string;
    displayName?: string;
  }): Promise<CloudUser> {
    const response = await this.request<{ user: CloudUser }>(
      "/api/auth/register",
      { method: "POST", body: input }
    );
    return response.user;
  }

  async login(input: { email: string; password: string }): Promise<CloudUser> {
    const response = await this.request<{ user: CloudUser }>("/api/auth/login", {
      method: "POST",
      body: input
    });
    return response.user;
  }

  async logout(): Promise<void> {
    await this.request<void>("/api/auth/logout", { method: "POST" });
  }

  async listWorkspaces(): Promise<CloudWorkspace[]> {
    const response = await this.request<{ workspaces: CloudWorkspace[] }>(
      "/api/workspaces"
    );
    return response.workspaces;
  }

  async createWorkspace(name: string): Promise<CloudWorkspace> {
    const response = await this.request<{ workspace: CloudWorkspace }>(
      "/api/workspaces",
      { method: "POST", body: { name } }
    );
    return response.workspace;
  }

  async renameWorkspace(
    workspaceId: WorkspaceId,
    name: string
  ): Promise<CloudWorkspace> {
    const response = await this.request<{ workspace: CloudWorkspace }>(
      `/api/workspaces/${encodeURIComponent(workspaceId)}`,
      { method: "PATCH", body: { name } }
    );
    return response.workspace;
  }

  workspace(workspaceId: WorkspaceId): CloudWorkspaceAdapter {
    return new CloudWorkspaceAdapter(this, workspaceId);
  }

  async listRevisions(
    workspaceId: WorkspaceId,
    documentId: DocumentId
  ): Promise<CloudDocumentRevision[]> {
    const response = await this.request<{ revisions: CloudDocumentRevision[] }>(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/documents/${encodeURIComponent(
        documentId
      )}/revisions`
    );
    return response.revisions;
  }

  async listNotes(
    workspaceId: WorkspaceId,
    sort: CloudDocumentSort = "updated"
  ): Promise<CloudDocumentSummary[]> {
    const response = await this.request<{ documents: CloudDocumentSummary[] }>(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/notes?sort=${sort}`
    );
    return response.documents;
  }

  async listRecentDocuments(
    workspaceId: WorkspaceId
  ): Promise<CloudDocumentSummary[]> {
    const response = await this.request<{ documents: CloudDocumentSummary[] }>(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/notes/recent`
    );
    return response.documents;
  }

  async listKnowledgeBases(
    workspaceId: WorkspaceId
  ): Promise<CloudKnowledgeBase[]> {
    const response = await this.request<{
      knowledgeBases: CloudKnowledgeBase[];
    }>(`/api/workspaces/${encodeURIComponent(workspaceId)}/knowledge-bases`);
    return response.knowledgeBases;
  }

  async createKnowledgeBase(
    workspaceId: WorkspaceId,
    name: string
  ): Promise<CloudKnowledgeBase> {
    const response = await this.request<{ knowledgeBase: CloudKnowledgeBase }>(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/knowledge-bases`,
      { method: "POST", body: { name } }
    );
    return response.knowledgeBase;
  }

  async renameKnowledgeBase(
    workspaceId: WorkspaceId,
    knowledgeBaseId: string,
    input: { name: string; baseRevision: number; sortOrder?: number }
  ): Promise<CloudKnowledgeBase> {
    const response = await this.request<{ knowledgeBase: CloudKnowledgeBase }>(
      `/api/workspaces/${encodeURIComponent(
        workspaceId
      )}/knowledge-bases/${encodeURIComponent(knowledgeBaseId)}`,
      { method: "PATCH", body: input }
    );
    return response.knowledgeBase;
  }

  async deleteKnowledgeBase(
    workspaceId: WorkspaceId,
    knowledgeBaseId: string,
    baseRevision: number
  ): Promise<DocumentSnapshot[]> {
    const response = await this.request<{
      knowledgeBaseId: string;
      documents: DocumentSnapshot[];
    }>(
      `/api/workspaces/${encodeURIComponent(
        workspaceId
      )}/knowledge-bases/${encodeURIComponent(knowledgeBaseId)}`,
      { method: "DELETE", body: { baseRevision } }
    );
    return response.documents;
  }

  async listKnowledgeBaseDocuments(
    workspaceId: WorkspaceId,
    knowledgeBaseId: string,
    sort: CloudDocumentSort = "updated"
  ): Promise<CloudDocumentSummary[]> {
    const response = await this.request<{ documents: CloudDocumentSummary[] }>(
      `/api/workspaces/${encodeURIComponent(
        workspaceId
      )}/knowledge-bases/${encodeURIComponent(
        knowledgeBaseId
      )}/documents?sort=${sort}`
    );
    return response.documents;
  }

  async archiveDocument(
    workspaceId: WorkspaceId,
    documentId: DocumentId,
    input: { knowledgeBaseId: string; baseRevision: number }
  ): Promise<DocumentSnapshot> {
    const response = await this.request<{ document: DocumentSnapshot }>(
      `/api/workspaces/${encodeURIComponent(
        workspaceId
      )}/documents/${encodeURIComponent(documentId)}/archive`,
      { method: "POST", body: input }
    );
    return response.document;
  }

  async restoreDocumentToNotes(
    workspaceId: WorkspaceId,
    documentId: DocumentId,
    baseRevision: number
  ): Promise<DocumentSnapshot> {
    const response = await this.request<{ document: DocumentSnapshot }>(
      `/api/workspaces/${encodeURIComponent(
        workspaceId
      )}/documents/${encodeURIComponent(documentId)}/restore-to-notes`,
      { method: "POST", body: { baseRevision } }
    );
    return response.document;
  }

  async markDocumentOpened(
    workspaceId: WorkspaceId,
    documentId: DocumentId,
    baseRevision: number
  ): Promise<DocumentSnapshot> {
    const response = await this.request<{ document: DocumentSnapshot }>(
      `/api/workspaces/${encodeURIComponent(
        workspaceId
      )}/documents/${encodeURIComponent(documentId)}/open`,
      { method: "POST", body: { baseRevision } }
    );
    return response.document;
  }

  async uploadAsset(
    workspaceId: WorkspaceId,
    input: {
      data: ArrayBuffer;
      mime: string;
      kind: CloudAssetKind;
      filename?: string;
      signal?: AbortSignal;
    }
  ): Promise<{ asset: CloudAsset; deduplicated: boolean }> {
    const response = await this.fetch(
      `${this.baseUrl}${this.workspaceAssetPath(workspaceId)}`,
      {
        method: "POST",
        credentials: "include",
        signal: input.signal,
        headers: {
          Accept: "application/json",
          "Content-Type": input.mime,
          "X-InkLoom-Kind": input.kind,
          ...(input.filename
            ? { "X-InkLoom-Filename": encodeURIComponent(input.filename) }
            : {})
        },
        body: input.data
      }
    );
    const payload = (await response.json()) as {
      asset?: CloudAsset;
      deduplicated?: boolean;
      error?: { message?: string };
    };
    if (!response.ok || !payload.asset) {
      throw new CloudRequestError(
        response.status,
        "ASSET_UPLOAD_FAILED",
        payload.error?.message ?? "资产上传失败。"
      );
    }
    return {
      asset: payload.asset,
      deduplicated: Boolean(payload.deduplicated)
    };
  }

  async getAssetInfo(
    workspaceId: WorkspaceId,
    hash: string
  ): Promise<CloudAsset> {
    const response = await this.request<{ asset: CloudAsset }>(
      `${this.workspaceAssetPath(workspaceId)}/${encodeURIComponent(hash)}/info`
    );
    return response.asset;
  }

  async downloadAsset(
    workspaceId: WorkspaceId,
    hash: string
  ): Promise<Uint8Array> {
    const response = await this.fetch(
      `${this.baseUrl}${this.workspaceAssetPath(
        workspaceId
      )}/${encodeURIComponent(hash)}?download=1`,
      { credentials: "include" }
    );
    if (!response.ok || !response.arrayBuffer) {
      throw new CloudRequestError(
        response.status,
        "ASSET_DOWNLOAD_FAILED",
        "资产读取失败。"
      );
    }
    return new Uint8Array(await response.arrayBuffer());
  }

  assetUrl(workspaceId: WorkspaceId, hash: string) {
    return `${this.baseUrl}${this.workspaceAssetPath(
      workspaceId
    )}/${encodeURIComponent(hash)}`;
  }

  assetEndpoint(workspaceId: WorkspaceId) {
    return `${this.baseUrl}${this.workspaceAssetPath(workspaceId)}`;
  }

  async restoreRevision(
    workspaceId: WorkspaceId,
    documentId: DocumentId,
    revisionId: string,
    baseRevision: number
  ): Promise<DocumentSnapshot> {
    const response = await this.request<{ document: DocumentSnapshot }>(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/documents/${encodeURIComponent(
        documentId
      )}/revisions/${encodeURIComponent(revisionId)}`,
      { method: "POST", body: { baseRevision } }
    );
    return response.document;
  }

  async request<T>(
    path: string,
    options: {
      method?: string;
      body?: unknown;
    } = {}
  ): Promise<T> {
    const method = options.method ?? "GET";
    const response = await this.fetch(`${this.baseUrl}${path}`, {
      method,
      credentials: "include",
      headers:
        options.body === undefined
          ? { Accept: "application/json" }
          : {
              Accept: "application/json",
              "Content-Type": "application/json"
            },
      body: options.body === undefined ? undefined : JSON.stringify(options.body)
    });
    let payload: unknown;
    try {
      payload =
        response.status === 204 ? undefined : ((await response.json()) as unknown);
    } catch {
      throw new CloudRequestError(
        response.status,
        "INVALID_RESPONSE",
        "服务返回了无法识别的响应。"
      );
    }

    if (!response.ok) {
      const errorBody = payload as ApiErrorBody | undefined;
      const details = errorBody?.error?.details;
      if (
        errorBody?.error?.code === "REVISION_CONFLICT" &&
        details?.documentId &&
        typeof details.expectedRevision === "number" &&
        typeof details.actualRevision === "number"
      ) {
        throw new RevisionConflictError(
          details.documentId,
          details.expectedRevision,
          details.actualRevision
        );
      }
      throw new CloudRequestError(
        response.status,
        errorBody?.error?.code ?? "REQUEST_FAILED",
        errorBody?.error?.message ?? "请求失败，请稍后重试。",
        details
      );
    }

    return payload as T;
  }

  private workspaceAssetPath(workspaceId: WorkspaceId) {
    return `/api/workspaces/${encodeURIComponent(workspaceId)}/assets`;
  }
}

export class CloudWorkspaceAdapter implements WorkspaceAdapter {
  readonly kind = "cloud" as const;

  constructor(
    private readonly client: CloudClient,
    readonly workspaceId: WorkspaceId
  ) {}

  async getCapabilities(): Promise<StorageCapabilities> {
    return {
      localFileAccess: "none",
      fileWatch: false,
      sqlite: false,
      opfs: false,
      offline: false,
      backgroundSync: true,
      versionHistory: true
    };
  }

  async listTree(): Promise<WorkspaceNode> {
    const response = await this.client.request<{ tree: WorkspaceNode }>(
      this.workspacePath("tree")
    );
    return response.tree;
  }

  async readDocument(documentId: DocumentId): Promise<DocumentSnapshot> {
    const response = await this.client.request<{ document: DocumentSnapshot }>(
      this.documentPath(documentId)
    );
    return response.document;
  }

  async createDocument(input: CreateDocumentInput): Promise<DocumentSnapshot> {
    const response = await this.client.request<{ document: DocumentSnapshot }>(
      `${this.workspacePath("documents")}`,
      {
        method: "POST",
        body: {
          path: input.path,
          title: input.title,
          markdown: input.markdown,
          tags: input.tags,
          extensions: input.extensions
        }
      }
    );
    return response.document;
  }

  async writeDocument(input: WriteDocumentInput): Promise<DocumentSnapshot> {
    const response = await this.client.request<{ document: DocumentSnapshot }>(
      this.documentPath(input.documentId),
      {
        method: "PUT",
        body: {
          markdown: input.markdown,
          baseRevision: input.baseRevision,
          checkpoint: input.checkpoint,
          title: input.title,
          tags: input.tags,
          extensions: input.extensions
        }
      }
    );
    return response.document;
  }

  async moveNode(input: MoveNodeInput): Promise<WorkspaceNode> {
    const response = await this.client.request<{ node: WorkspaceNode }>(
      `${this.workspacePath("nodes")}/${encodeURIComponent(input.nodeId)}`,
      {
        method: "PUT",
        body: {
          targetPath: input.targetPath,
          baseRevision: input.baseRevision
        }
      }
    );
    return response.node;
  }

  async deleteNode(input: DeleteNodeInput): Promise<void> {
    await this.client.request<void>(
      `${this.workspacePath("nodes")}/${encodeURIComponent(input.nodeId)}`,
      {
        method: "DELETE",
        body: { baseRevision: input.baseRevision }
      }
    );
  }

  private workspacePath(resource: string): string {
    return `/api/workspaces/${encodeURIComponent(this.workspaceId)}/${resource}`;
  }

  private documentPath(documentId: DocumentId): string {
    return `${this.workspacePath("documents")}/${encodeURIComponent(documentId)}`;
  }
}

export function documentExtensions(
  canvas: unknown
): DocumentExtensions | undefined {
  return canvas === undefined ? undefined : { canvas: canvas as never };
}
