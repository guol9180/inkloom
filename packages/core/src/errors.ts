export type InkLoomErrorCode =
  | "INVALID_WORKSPACE_PATH"
  | "REVISION_CONFLICT"
  | "DOCUMENT_NOT_FOUND"
  | "PERMISSION_DENIED"
  | "BRIDGE_UNSUPPORTED"
  | "BRIDGE_PROTOCOL_ERROR";

export class InkLoomError extends Error {
  constructor(
    readonly code: InkLoomErrorCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "InkLoomError";
  }
}

export class RevisionConflictError extends InkLoomError {
  constructor(
    readonly documentId: string,
    readonly expectedRevision: number,
    readonly actualRevision: number
  ) {
    super(
      "REVISION_CONFLICT",
      `Document ${documentId} changed from revision ${expectedRevision} to ${actualRevision}.`
    );
    this.name = "RevisionConflictError";
  }
}
