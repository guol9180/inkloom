import type { WorkspaceId } from "@inkloom/core";
import {
  CloudClient,
  type CloudFetch,
  type CloudWorkspace
} from "@inkloom/storage";

const ACTIVE_WORKSPACE_KEY = "inkloom.active-workspace";

export const cloudClient = new CloudClient({
  baseUrl:
    import.meta.env.VITE_API_ORIGIN?.replace(/\/$/, "") ??
    (["127.0.0.1", "localhost"].includes(window.location.hostname)
      ? `${window.location.protocol}//${window.location.hostname}:3001`
      : window.location.origin),
  fetch: ((input, init) => window.fetch(input, init)) satisfies CloudFetch
});

export async function loadCloudWorkspaces(): Promise<{
  workspaces: CloudWorkspace[];
  activeWorkspace: CloudWorkspace;
}> {
  let workspaces = await cloudClient.listWorkspaces();
  if (workspaces.length === 0) {
    workspaces = [await cloudClient.createWorkspace("我的工作区")];
  }
  const storedId = localStorage.getItem(ACTIVE_WORKSPACE_KEY);
  const firstWorkspace = workspaces[0];
  if (!firstWorkspace) {
    throw new Error("Unable to initialize a workspace.");
  }
  const activeWorkspace =
    workspaces.find((workspace) => workspace.id === storedId) ?? firstWorkspace;
  persistActiveCloudWorkspace(activeWorkspace.id as WorkspaceId);
  return { workspaces, activeWorkspace };
}

export function persistActiveCloudWorkspace(workspaceId: WorkspaceId): void {
  localStorage.setItem(ACTIVE_WORKSPACE_KEY, workspaceId);
}
