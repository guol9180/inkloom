import {
  workspacePath,
  type CreateDocumentInput,
  type DeleteNodeInput,
  type DocumentId,
  type DocumentSnapshot,
  type MoveNodeInput,
  type StorageCapabilities,
  type WorkspaceAdapter,
  type WorkspaceNode,
  type WriteDocumentInput
} from "@inkloom/core";

export type TauriInvoke = <TResult>(
  command: string,
  args?: Record<string, unknown>
) => Promise<TResult>;

export type TauriListen = (
  event: string,
  listener: (event: { payload: unknown }) => void
) => Promise<() => void>;

export type TauriFolderAdapterOptions = {
  invoke: TauriInvoke;
  listen: TauriListen;
};

export type TauriWorkspaceInfo = {
  root: string;
  name: string;
};

export type TauriFolderAdapter = WorkspaceAdapter & {
  openWorkspace(path: string): Promise<TauriWorkspaceInfo>;
  currentWorkspace(): Promise<TauriWorkspaceInfo | null>;
  subscribeWorkspaceChanges(listener: () => void): Promise<() => void>;
};

export function createTauriFolderAdapter(
  options: TauriFolderAdapterOptions
): TauriFolderAdapter {
  const { invoke, listen } = options;

  return {
    kind: "tauri-folder",

    async getCapabilities(): Promise<StorageCapabilities> {
      return {
        localFileAccess: "user-selected",
        fileWatch: true,
        sqlite: false,
        opfs: false,
        offline: true,
        backgroundSync: false,
        versionHistory: false
      };
    },

    openWorkspace: (path: string) =>
      invoke<TauriWorkspaceInfo>("open_workspace", { path }),
    currentWorkspace: () => invoke<TauriWorkspaceInfo | null>("current_workspace"),

    async subscribeWorkspaceChanges(listener: () => void): Promise<() => void> {
      return listen("workspace-changed", listener);
    },

    listTree: () => invoke<WorkspaceNode>("list_tree"),

    readDocument: (documentId: DocumentId) =>
      invoke<DocumentSnapshot>("read_document", {
        request: { documentId }
      }),

    createDocument: (input: CreateDocumentInput) =>
      invoke<DocumentSnapshot>("create_document", {
        request: input
      }),

    writeDocument: (input: WriteDocumentInput) =>
      invoke<DocumentSnapshot>("write_document", {
        request: input
      }),

    moveNode: (input: MoveNodeInput) =>
      invoke<WorkspaceNode>("move_node", {
        request: {
          ...input,
          targetPath: workspacePath(input.targetPath)
        }
      }),

    deleteNode: (input: DeleteNodeInput) =>
      invoke<void>("delete_node", {
        request: input
      })
  };
}
