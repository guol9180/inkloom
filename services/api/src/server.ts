import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import {
  InkLoomError,
  RevisionConflictError,
  workspacePath,
  type DocumentExtensions,
  type JsonValue
} from "@inkloom/core";
import {
  ApiDatabaseError,
  DocumentDatabase,
  normalizeEmail,
  type AssetKind,
  type StoredAssetRecord,
  type ApiUser,
  type DocumentDatabaseOptions
} from "./database";
import { LocalDiskAssetStore } from "./local-disk-assets";
import {
  AssetUploadError,
  type AssetBlobStore
} from "./asset-blob-store";
import {
  createSessionToken,
  hashPassword,
  verifyPassword
} from "./auth";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const DEFAULT_MAX_ASSET_BYTES = 50 * 1024 * 1024;
const COOKIE_NAME = "inkloom_session";
const HOST_COOKIE_NAME = "__Host-inkloom_session";

export type ApiServerOptions = {
  database?: DocumentDatabase;
  databaseOptions?: DocumentDatabaseOptions;
  assetStore?: AssetBlobStore;
  assetDirectory?: string;
  maxAssetBytes?: number;
  allowedOrigins?: readonly string[];
  secureCookies?: boolean;
  now?: () => number;
};

type RequestContext = {
  request: IncomingMessage;
  response: ServerResponse;
  url: URL;
  body: unknown;
  assetUpload: boolean;
};

export function createApiServer(options: ApiServerOptions = {}) {
  const database =
    options.database ??
    new DocumentDatabase(
      options.databaseOptions ?? {
        filename:
          process.env.INKLOOM_DATABASE_PATH ??
          resolve(process.cwd(), "data/inkloom.sqlite")
      }
    );
  const allowedOrigins = new Set(
    options.allowedOrigins ??
      (process.env.INKLOOM_WEB_ORIGINS ??
        "http://127.0.0.1:4173,http://localhost:4173")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean)
  );
  const secureCookies =
    options.secureCookies ??
    (process.env.NODE_ENV === "production" ||
      process.env.INKLOOM_SECURE_COOKIES === "true");
  const now = options.now ?? (() => Date.now());
  const assetStore =
    options.assetStore ??
    new LocalDiskAssetStore(
      options.assetDirectory ??
        process.env.INKLOOM_ASSET_DIR ??
        resolve(process.cwd(), "data/assets")
    );
  const maxAssetBytes =
    options.maxAssetBytes ??
    parsePositiveInteger(process.env.INKLOOM_MAX_ASSET_BYTES) ??
    DEFAULT_MAX_ASSET_BYTES;

  const server = createServer(async (request, response) => {
    try {
      applyBaseHeaders(response);
      const origin = request.headers.origin;
      if (origin && !allowedOrigins.has(origin)) {
        throw new ApiHttpError(403, "ORIGIN_NOT_ALLOWED", "请求来源不在允许列表中。");
      }
      if (origin) {
        response.setHeader("Access-Control-Allow-Origin", origin);
        response.setHeader("Access-Control-Allow-Credentials", "true");
        response.setHeader("Vary", "Origin");
      }

      if (request.method === "OPTIONS") {
        response.statusCode = 204;
        response.setHeader(
          "Access-Control-Allow-Methods",
          "GET, POST, PUT, PATCH, DELETE, OPTIONS"
        );
        response.setHeader(
          "Access-Control-Allow-Headers",
          "Content-Type, Accept, X-InkLoom-Kind, X-InkLoom-Filename"
        );
        response.setHeader("Access-Control-Max-Age", "600");
        response.end();
        return;
      }

      const url = new URL(
        request.url ?? "/",
        `http://${request.headers.host ?? "127.0.0.1"}`
      );
      const assetUpload = isAssetUploadRequest(request, url);
      const body = assetUpload ? {} : await readJsonBody(request);
      await route({
        database,
        assetStore,
        maxAssetBytes,
        secureCookies,
        now,
        context: { request, response, url, body, assetUpload }
      });
    } catch (error) {
      sendError(response, error);
    }
  });

  return {
    server,
    database,
    async close(): Promise<void> {
      await new Promise<void>((resolveClose, reject) => {
        server.close((error) => (error ? reject(error) : resolveClose()));
      });
      database.close();
    }
  };
}

async function route({
  database,
  assetStore,
  maxAssetBytes,
  secureCookies,
  now,
  context
}: {
  database: DocumentDatabase;
  assetStore: AssetBlobStore;
  maxAssetBytes: number;
  secureCookies: boolean;
  now: () => number;
  context: RequestContext;
}): Promise<void> {
  const { request, response, url, body, assetUpload } = context;
  const segments = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
  const method = request.method ?? "GET";

  if (method === "GET" && url.pathname === "/api/health") {
    sendJson(response, 200, {
      ok: true,
      service: "inkloom-api",
      time: new Date(now()).toISOString()
    });
    return;
  }

  if (segments[0] !== "api") {
    throw new ApiHttpError(404, "NOT_FOUND", "接口不存在。");
  }

  if (method === "POST" && url.pathname === "/api/auth/register") {
    const input = parseRecord(body);
    const email = validateEmail(input.email);
    const password = validatePassword(input.password);
    if (database.findUserByEmail(email)) {
      throw new ApiHttpError(409, "EMAIL_IN_USE", "该邮箱已注册。");
    }
    const passwordData = hashPassword(password);
    let user: ApiUser;
    try {
      user = database.createUser({
        email,
        displayName: optionalString(input.displayName, 40),
        passwordHash: passwordData.hash,
        passwordSalt: passwordData.salt
      });
    } catch (error) {
      if (isUniqueConstraint(error)) {
        throw new ApiHttpError(409, "EMAIL_IN_USE", "该邮箱已注册。");
      }
      throw error;
    }
    issueSession(database, response, user, secureCookies, now);
    sendJson(response, 201, { user });
    return;
  }

  if (method === "POST" && url.pathname === "/api/auth/login") {
    const input = parseRecord(body);
    const email = validateEmail(input.email);
    const password = validatePassword(input.password);
    const row = database.findUserByEmail(email);
    if (
      !row ||
      !verifyPassword(password, row.password_hash, row.password_salt)
    ) {
      throw new ApiHttpError(401, "INVALID_CREDENTIALS", "邮箱或密码不正确。");
    }
    const user = database.findUserById(row.id);
    if (!user) throw new ApiHttpError(401, "INVALID_SESSION", "登录失败。");
    issueSession(database, response, user, secureCookies, now);
    sendJson(response, 200, { user });
    return;
  }

  const sessionToken = readSessionToken(request, secureCookies);
  const user = sessionToken ? database.findUserBySession(sessionToken) : undefined;

  if (method === "POST" && url.pathname === "/api/auth/logout") {
    if (sessionToken) database.deleteSession(sessionToken);
    clearSessionCookie(response, secureCookies);
    response.statusCode = 204;
    response.end();
    return;
  }

  if (!user) {
    throw new ApiHttpError(401, "UNAUTHORIZED", "请先登录。");
  }

  if (method === "GET" && url.pathname === "/api/auth/me") {
    sendJson(response, 200, { user });
    return;
  }

  if (method === "GET" && url.pathname === "/api/workspaces") {
    sendJson(response, 200, { workspaces: database.listWorkspaces(user.id) });
    return;
  }

  if (method === "POST" && url.pathname === "/api/workspaces") {
    const input = parseRecord(body);
    const workspace = database.createWorkspace(
      user.id,
      requiredString(input.name, "工作区名称")
    );
    sendJson(response, 201, { workspace });
    return;
  }

  if (segments[0] === "api" && segments[1] === "workspaces" && segments[2]) {
    const workspaceId = segments[2];

    if (segments[3] === "assets") {
      if (!database.getWorkspace(user.id, workspaceId)) {
        throw new ApiHttpError(404, "WORKSPACE_NOT_FOUND", "找不到工作区。");
      }

      if (method === "POST" && segments.length === 4 && assetUpload) {
        const mime = normalizeAssetMime(request.headers["content-type"]);
        const kind = parseAssetKind(request.headers["x-inkloom-kind"]);
        assertMimeKind(mime, kind);
        const declaredLength = Number(request.headers["content-length"]);
        if (Number.isFinite(declaredLength) && declaredLength > maxAssetBytes) {
          throw new AssetUploadError(
            413,
            "ASSET_TOO_LARGE",
            `资产不能超过 ${Math.floor(maxAssetBytes / 1024 / 1024)} MiB。`
          );
        }
        const blob = await assetStore.put(
          workspaceId,
          validateAssetStream(request, mime),
          maxAssetBytes
        );
        const stored = database.upsertAsset(user.id, workspaceId, {
          ...blob,
          mime,
          kind
        });
        sendJson(response, stored.deduplicated ? 200 : 201, {
          asset: publicAsset(stored.asset),
          deduplicated: stored.deduplicated
        });
        return;
      }

      if (
        method === "POST" &&
        segments.length === 5 &&
        segments[4] === "cleanup"
      ) {
        const input = parseRecord(body);
        const unusedForHours =
          input.unusedForHours === undefined
            ? 24
            : requiredNonNegativeNumber(input.unusedForHours, "未引用时长");
        const createdBefore = new Date(
          now() - unusedForHours * 60 * 60 * 1000
        ).toISOString();
        const candidates = database.listUnreferencedAssets(
          user.id,
          workspaceId,
          createdBefore
        );
        const deleted: StoredAssetRecord[] = [];
        for (const asset of candidates) {
          if (database.isAssetReferenced(user.id, workspaceId, asset.id)) {
            continue;
          }
          database.deleteAssetRecord(user.id, workspaceId, asset.id);
          await assetStore.remove(asset.storageKey);
          deleted.push(asset);
        }
        sendJson(response, 200, {
          count: deleted.length,
          deleted: deleted.map(publicAsset)
        });
        return;
      }

      if (
        (method === "GET" || method === "HEAD") &&
        segments.length === 5 &&
        segments[4] !== "cleanup"
      ) {
        const asset = database.getAsset(user.id, workspaceId, segments[4]);
        response.statusCode = 200;
        response.setHeader("Content-Type", asset.mime);
        response.setHeader("Content-Length", String(asset.size));
        response.setHeader(
          "Cache-Control",
          "private, max-age=31536000, immutable"
        );
        response.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
        const embeddedImage =
          request.headers["sec-fetch-dest"] === "image";
        response.setHeader(
          "Content-Disposition",
          asset.mime.startsWith("image/") &&
            (asset.mime !== "image/svg+xml" || embeddedImage)
            ? "inline"
            : "attachment"
        );
        if (asset.mime === "image/svg+xml" && !embeddedImage) {
          response.setHeader(
            "Content-Security-Policy",
            "script-src 'none'; object-src 'none'; base-uri 'none'"
          );
        }
        if (method === "HEAD") {
          response.end();
          return;
        }
        await pipeline(assetStore.open(asset.storageKey), response);
        return;
      }

      if (
        method === "GET" &&
        segments.length === 6 &&
        segments[5] === "info"
      ) {
        const asset = database.getAsset(user.id, workspaceId, segments[4]);
        sendJson(response, 200, { asset: publicAsset(asset) });
        return;
      }
    }

    if (method === "GET" && segments.length === 4 && segments[3] === "notes") {
      sendJson(response, 200, {
        documents: database.listNotes(
          user.id,
          workspaceId,
          parseDocumentSort(url.searchParams.get("sort"))
        )
      });
      return;
    }

    if (
      method === "GET" &&
      segments.length === 5 &&
      segments[3] === "notes" &&
      segments[4] === "recent"
    ) {
      sendJson(response, 200, {
        documents: database.listRecentDocuments(user.id, workspaceId)
      });
      return;
    }

    if (
      method === "GET" &&
      segments.length === 4 &&
      segments[3] === "knowledge-bases"
    ) {
      sendJson(response, 200, {
        knowledgeBases: database.listKnowledgeBases(user.id, workspaceId)
      });
      return;
    }

    if (
      method === "POST" &&
      segments.length === 4 &&
      segments[3] === "knowledge-bases"
    ) {
      const input = parseRecord(body);
      const knowledgeBase = database.createKnowledgeBase(user.id, workspaceId, {
        name: requiredString(input.name, "知识库名称", 80)
      });
      sendJson(response, 201, { knowledgeBase });
      return;
    }

    if (
      segments.length === 5 &&
      segments[3] === "knowledge-bases" &&
      segments[4]
    ) {
      if (method === "PATCH") {
        const input = parseRecord(body);
        const knowledgeBase = database.renameKnowledgeBase(
          user.id,
          workspaceId,
          segments[4],
          {
            name: requiredString(input.name, "知识库名称", 80),
            baseRevision: requiredRevision(input.baseRevision),
            sortOrder:
              input.sortOrder === undefined
                ? undefined
                : requiredSortOrder(input.sortOrder)
          }
        );
        sendJson(response, 200, { knowledgeBase });
        return;
      }
      if (method === "DELETE") {
        const input = parseRecord(body);
        const documents = database.deleteKnowledgeBase(
          user.id,
          workspaceId,
          segments[4],
          requiredRevision(input.baseRevision)
        );
        sendJson(response, 200, {
          knowledgeBaseId: segments[4],
          documents
        });
        return;
      }
    }

    if (
      method === "GET" &&
      segments.length === 6 &&
      segments[3] === "knowledge-bases" &&
      segments[4] &&
      segments[5] === "documents"
    ) {
      sendJson(response, 200, {
        documents: database.listKnowledgeBaseDocuments(
          user.id,
          workspaceId,
          segments[4],
          parseDocumentSort(url.searchParams.get("sort"))
        )
      });
      return;
    }

    if (method === "GET" && segments.length === 4 && segments[3] === "tree") {
      sendJson(response, 200, {
        tree: database.listTree(user.id, workspaceId)
      });
      return;
    }

    if (method === "POST" && segments.length === 4 && segments[3] === "documents") {
      const input = parseRecord(body);
      const document = database.createDocument(user.id, workspaceId, {
        path: requiredString(input.path, "文档路径"),
        title: requiredString(input.title, "文档标题"),
        markdown: optionalString(input.markdown, 1_500_000),
        tags: optionalStringArray(input.tags),
        extensions: optionalExtensions(input.extensions)
      });
      sendJson(response, 201, { document });
      return;
    }

    if (method === "PATCH" && segments.length === 3) {
      const input = parseRecord(body);
      const workspace = database.renameWorkspace(
        user.id,
        workspaceId,
        requiredString(input.name, "工作区名称", 80)
      );
      sendJson(response, 200, { workspace });
      return;
    }

    if (
      segments.length === 6 &&
      segments[3] === "documents" &&
      segments[4] &&
      method === "POST"
    ) {
      const input = parseRecord(body);
      if (segments[5] === "archive") {
        const document = database.archiveDocument(
          user.id,
          workspaceId,
          segments[4],
          {
            knowledgeBaseId: requiredString(
              input.knowledgeBaseId,
              "知识库",
              200
            ),
            baseRevision: requiredRevision(input.baseRevision)
          }
        );
        sendJson(response, 200, { document });
        return;
      }
      if (segments[5] === "restore-to-notes") {
        const document = database.restoreDocumentToNotes(
          user.id,
          workspaceId,
          segments[4],
          requiredRevision(input.baseRevision)
        );
        sendJson(response, 200, { document });
        return;
      }
      if (segments[5] === "open") {
        const document = database.markDocumentOpened(
          user.id,
          workspaceId,
          segments[4],
          requiredRevision(input.baseRevision)
        );
        sendJson(response, 200, { document });
        return;
      }
    }

    if (
      segments.length === 5 &&
      segments[3] === "documents" &&
      segments[4]
    ) {
      const documentId = segments[4];
      if (method === "GET") {
        sendJson(response, 200, {
          document: database.readDocument(user.id, workspaceId, documentId)
        });
        return;
      }
      if (method === "PUT") {
        const input = parseRecord(body);
        const document = database.writeDocument(
          user.id,
          workspaceId,
          documentId,
          {
            markdown: requiredMarkdown(input.markdown),
            baseRevision: requiredRevision(input.baseRevision),
            checkpoint:
              input.checkpoint === undefined
                ? undefined
                : requiredBoolean(input.checkpoint, "checkpoint"),
            title:
              input.title === undefined
                ? undefined
                : requiredString(input.title, "文档标题"),
            tags:
              input.tags === undefined
                ? undefined
                : optionalStringArray(input.tags),
            extensions:
              input.extensions === undefined
                ? undefined
                : optionalExtensions(input.extensions)
          }
        );
        sendJson(response, 200, { document });
        return;
      }
    }

    if (
      segments.length === 6 &&
      segments[3] === "documents" &&
      segments[4] &&
      segments[5] === "revisions" &&
      method === "GET"
    ) {
      sendJson(response, 200, {
        revisions: database.listRevisions(user.id, workspaceId, segments[4])
      });
      return;
    }

    if (
      segments.length === 7 &&
      segments[3] === "documents" &&
      segments[4] &&
      segments[5] === "revisions" &&
      segments[6] &&
      method === "POST"
    ) {
      const input = parseRecord(body);
      const document = database.restoreRevision(
        user.id,
        workspaceId,
        segments[4],
        segments[6],
        requiredRevision(input.baseRevision)
      );
      sendJson(response, 200, { document });
      return;
    }

    if (
      segments.length === 5 &&
      segments[3] === "nodes" &&
      segments[4]
    ) {
      if (method === "PUT") {
        const input = parseRecord(body);
        const node = database.moveDocument(user.id, workspaceId, segments[4], {
          targetPath: requiredString(input.targetPath, "目标路径"),
          baseRevision: requiredRevision(input.baseRevision)
        });
        sendJson(response, 200, { node });
        return;
      }
      if (method === "DELETE") {
        const input = parseRecord(body);
        database.deleteDocument(
          user.id,
          workspaceId,
          segments[4],
          requiredRevision(input.baseRevision)
        );
        response.statusCode = 204;
        response.end();
        return;
      }
    }
  }

  throw new ApiHttpError(404, "NOT_FOUND", "接口不存在。");
}

function issueSession(
  database: DocumentDatabase,
  response: ServerResponse,
  user: ApiUser,
  secureCookies: boolean,
  now: () => number
): void {
  const token = createSessionToken();
  const expiresAt = new Date(now() + SESSION_TTL_MS).toISOString();
  database.createSession(user.id, token, expiresAt);
  response.setHeader(
    "Set-Cookie",
    serializeCookie(sessionCookieName(secureCookies), token, {
      maxAge: SESSION_TTL_MS / 1000,
      secure: secureCookies
    })
  );
}

function clearSessionCookie(
  response: ServerResponse,
  secureCookies: boolean
): void {
  response.setHeader(
    "Set-Cookie",
    serializeCookie(sessionCookieName(secureCookies), "", {
      maxAge: 0,
      secure: secureCookies
    })
  );
}

function sessionCookieName(secure: boolean): string {
  return secure ? HOST_COOKIE_NAME : COOKIE_NAME;
}

function serializeCookie(
  name: string,
  value: string,
  options: { maxAge: number; secure: boolean }
): string {
  const parts = [
    `${name}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.floor(options.maxAge)}`
  ];
  if (options.secure) parts.push("Secure");
  return parts.join("; ");
}

function readSessionToken(
  request: IncomingMessage,
  secureCookies: boolean
): string | undefined {
  const cookie = request.headers.cookie;
  if (!cookie) return undefined;
  const name = sessionCookieName(secureCookies);
  for (const part of cookie.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return undefined;
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  if (request.method === "GET" || request.method === "HEAD") return {};
  let bytes = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > MAX_BODY_BYTES) {
      throw new ApiHttpError(413, "PAYLOAD_TOO_LARGE", "请求正文超过 2 MiB。");
    }
    chunks.push(buffer);
  }
  if (chunks.length === 0) return {};
  const contentType = request.headers["content-type"] ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new ApiHttpError(415, "UNSUPPORTED_MEDIA_TYPE", "请求正文必须是 JSON。");
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    throw new ApiHttpError(400, "INVALID_JSON", "请求正文不是有效 JSON。");
  }
}

function sendJson(response: ServerResponse, status: number, value: unknown): void {
  const body = JSON.stringify(value);
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Content-Length", Buffer.byteLength(body));
  response.end(body);
}

function sendError(response: ServerResponse, error: unknown): void {
  if (response.headersSent) {
    response.destroy();
    return;
  }
  if (error instanceof RevisionConflictError) {
    sendJson(response, 409, {
      error: {
        code: error.code,
        message: "文档已被其他会话修改，请刷新后处理。",
        details: {
          documentId: error.documentId,
          expectedRevision: error.expectedRevision,
          actualRevision: error.actualRevision
        }
      }
    });
    return;
  }
  if (error instanceof ApiDatabaseError || error instanceof ApiHttpError) {
    sendJson(response, error.status, {
      error: { code: error.code, message: error.message }
    });
    return;
  }
  if (error instanceof AssetUploadError) {
    sendJson(response, error.status, {
      error: { code: error.code, message: error.message }
    });
    return;
  }
  if (error instanceof InkLoomError) {
    const status =
      error.code === "INVALID_WORKSPACE_PATH" ? 400 : 409;
    sendJson(response, status, {
      error: { code: error.code, message: error.message }
    });
    return;
  }
  console.error(error);
  sendJson(response, 500, {
    error: { code: "INTERNAL_ERROR", message: "服务暂时不可用。" }
  });
}

function applyBaseHeaders(response: ServerResponse): void {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("Cross-Origin-Resource-Policy", "same-site");
}

function parseRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiHttpError(400, "INVALID_BODY", "请求正文必须是 JSON 对象。");
  }
  return value as Record<string, unknown>;
}

function validateEmail(value: unknown): string {
  const email = requiredString(value, "邮箱", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ApiHttpError(400, "INVALID_EMAIL", "请输入有效邮箱。");
  }
  return normalizeEmail(email);
}

function validatePassword(value: unknown): string {
  const password = requiredString(value, "密码", 128);
  if (password.length < 8) {
    throw new ApiHttpError(400, "WEAK_PASSWORD", "密码至少需要 8 个字符。");
  }
  return password;
}

function requiredString(
  value: unknown,
  name: string,
  maxLength = 200
): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new ApiHttpError(400, "INVALID_INPUT", `${name}不能为空。`);
  }
  if (value.length > maxLength) {
    throw new ApiHttpError(413, "INPUT_TOO_LARGE", `${name}超过长度限制。`);
  }
  return value;
}

function requiredMarkdown(value: unknown): string {
  if (typeof value !== "string") {
    throw new ApiHttpError(400, "INVALID_INPUT", "Markdown 正文必须是字符串。");
  }
  if (value.length > 1_500_000) {
    throw new ApiHttpError(413, "INPUT_TOO_LARGE", "Markdown 正文超过长度限制。");
  }
  return value;
}

function optionalString(value: unknown, maxLength: number): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    throw new ApiHttpError(400, "INVALID_INPUT", "字段类型不正确。");
  }
  if (value.length > maxLength) {
    throw new ApiHttpError(413, "INPUT_TOO_LARGE", "字段超过长度限制。");
  }
  return value;
}

function optionalStringArray(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new ApiHttpError(400, "INVALID_INPUT", "标签必须是字符串数组。");
  }
  return value.slice(0, 30);
}

function optionalExtensions(value: unknown): DocumentExtensions | undefined {
  if (value === undefined) return undefined;
  if (!isJsonObject(value)) {
    throw new ApiHttpError(400, "INVALID_EXTENSIONS", "扩展数据必须是 JSON 对象。");
  }
  return value as DocumentExtensions;
}

function requiredRevision(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    throw new ApiHttpError(400, "INVALID_REVISION", "revision 必须是正整数。");
  }
  return value as number;
}

function requiredBoolean(value: unknown, name: string): boolean {
  if (typeof value !== "boolean") {
    throw new ApiHttpError(400, "INVALID_INPUT", `${name} 必须是布尔值。`);
  }
  return value;
}

function requiredSortOrder(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new ApiHttpError(400, "INVALID_SORT_ORDER", "排序值必须是非负整数。");
  }
  return value as number;
}

function requiredNonNegativeNumber(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new ApiHttpError(400, "INVALID_INPUT", `${name}必须是非负数。`);
  }
  return value;
}

function parsePositiveInteger(value: string | undefined) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function isAssetUploadRequest(request: IncomingMessage, url: URL) {
  return (
    request.method === "POST" &&
    /^\/api\/workspaces\/[^/]+\/assets\/?$/.test(url.pathname)
  );
}

function normalizeAssetMime(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const mime = raw?.split(";", 1)[0]?.trim().toLowerCase();
  if (!mime || mime.length > 120 || !/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/.test(mime)) {
    throw new AssetUploadError(
      415,
      "ASSET_MIME_REQUIRED",
      "资产请求必须提供有效的 Content-Type。"
    );
  }
  return mime;
}

function parseAssetKind(value: string | string[] | undefined): AssetKind {
  const raw = Array.isArray(value) ? value[0] : value;
  if (
    raw === "image" ||
    raw === "attachment" ||
    raw === "excalidraw" ||
    raw === "svg"
  ) {
    return raw;
  }
  throw new AssetUploadError(
    400,
    "INVALID_ASSET_KIND",
    "X-InkLoom-Kind 必须是 image、attachment、excalidraw 或 svg。"
  );
}

function assertMimeKind(mime: string, kind: AssetKind) {
  const valid =
    (kind === "image" && mime.startsWith("image/") && mime !== "image/svg+xml") ||
    (kind === "svg" && mime === "image/svg+xml") ||
    (kind === "excalidraw" &&
      (mime === "application/json" ||
        mime === "application/vnd.excalidraw+json")) ||
    kind === "attachment";
  if (!valid) {
    throw new AssetUploadError(
      415,
      "ASSET_MIME_MISMATCH",
      "资产类型与 MIME 不匹配。"
    );
  }
}

async function* validateAssetStream(
  request: IncomingMessage,
  mime: string
): AsyncGenerator<Uint8Array> {
  let signature = Buffer.alloc(0);
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    if (signature.length < 1024) {
      signature = Buffer.concat([
        signature,
        buffer.subarray(0, 1024 - signature.length)
      ]);
    }
    yield buffer;
  }
  assertAssetSignature(mime, signature);
}

function assertAssetSignature(mime: string, bytes: Buffer) {
  const matches =
    (mime === "image/png" &&
      bytes.subarray(0, 8).equals(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      )) ||
    (mime === "image/jpeg" &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff) ||
    ((mime === "image/gif" || mime === "image/webp" || mime === "image/avif") &&
      ((mime === "image/gif" &&
        ["GIF87a", "GIF89a"].includes(bytes.subarray(0, 6).toString("ascii"))) ||
        (mime === "image/webp" &&
          bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
          bytes.subarray(8, 12).toString("ascii") === "WEBP") ||
        (mime === "image/avif" &&
          bytes.subarray(4, 12).toString("ascii").includes("ftyp")))) ||
    (mime === "application/pdf" && bytes.subarray(0, 5).toString() === "%PDF-") ||
    (mime === "image/svg+xml" && /<svg[\s>]/i.test(bytes.toString("utf8"))) ||
    ((mime === "application/json" ||
      mime === "application/vnd.excalidraw+json") &&
      /^[\s[{]/.test(bytes.toString("utf8")));
  const constrained =
    mime.startsWith("image/") ||
    mime === "application/pdf" ||
    mime === "application/json" ||
    mime === "application/vnd.excalidraw+json";
  if (constrained && !matches) {
    throw new AssetUploadError(
      415,
      "ASSET_CONTENT_MISMATCH",
      "文件内容与声明的 MIME 不匹配。"
    );
  }
  if (mime === "text/plain" && bytes.includes(0)) {
    throw new AssetUploadError(
      415,
      "ASSET_CONTENT_MISMATCH",
      "文本附件包含二进制内容。"
    );
  }
}

function publicAsset(asset: StoredAssetRecord) {
  return {
    id: asset.id,
    workspaceId: asset.workspaceId,
    hash: asset.hash,
    mime: asset.mime,
    size: asset.size,
    kind: asset.kind,
    createdAt: asset.createdAt,
    url: `/api/workspaces/${encodeURIComponent(
      asset.workspaceId
    )}/assets/${asset.hash}`
  };
}

function parseDocumentSort(value: string | null): "updated" | "created" | "title" {
  if (value === null || value === "updated") return "updated";
  if (value === "created" || value === "title") return value;
  throw new ApiHttpError(
    400,
    "INVALID_SORT",
    "排序仅支持 updated、created 或 title。"
  );
}

function isJsonObject(value: unknown): value is Record<string, JsonValue> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.getPrototypeOf(value) === Object.prototype;
}

function isUniqueConstraint(error: unknown): boolean {
  return (
    error instanceof Error &&
    /UNIQUE constraint failed/i.test(error.message)
  );
}

class ApiHttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "ApiHttpError";
  }
}

const invokedPath = process.argv[1];
if (invokedPath && fileURLToPath(import.meta.url) === resolve(invokedPath)) {
  const port = Number(process.env.PORT ?? process.env.INKLOOM_API_PORT ?? 3001);
  const host = process.env.HOST ?? "127.0.0.1";
  const application = createApiServer();
  application.server.listen(port, host, () => {
    console.log(`InkLoom API: http://${host}:${port}`);
  });
}
