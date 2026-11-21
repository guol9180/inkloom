import { useEffect, useState } from "react";

export type SearchShortcut = "ctrl-j" | "ctrl-shift-f";
export type ReadingScale = "compact" | "comfortable" | "large";

export type WorkspacePreferences = {
  searchShortcut: SearchShortcut;
  openDocumentInfoByDefault: boolean;
  readingScale: ReadingScale;
};

export const DEFAULT_WORKSPACE_PREFERENCES: WorkspacePreferences = {
  searchShortcut: "ctrl-j",
  openDocumentInfoByDefault: false,
  readingScale: "comfortable"
};

const PREFERENCE_PREFIX = "inkloom.workspace-preferences:";

export function loadWorkspacePreferences(
  workspaceId: string
): WorkspacePreferences {
  try {
    const raw = localStorage.getItem(`${PREFERENCE_PREFIX}${workspaceId}`);
    if (!raw) return DEFAULT_WORKSPACE_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<WorkspacePreferences>;
    return {
      searchShortcut:
        parsed.searchShortcut === "ctrl-shift-f"
          ? "ctrl-shift-f"
          : DEFAULT_WORKSPACE_PREFERENCES.searchShortcut,
      openDocumentInfoByDefault:
        typeof parsed.openDocumentInfoByDefault === "boolean"
          ? parsed.openDocumentInfoByDefault
          : DEFAULT_WORKSPACE_PREFERENCES.openDocumentInfoByDefault,
      readingScale:
        parsed.readingScale === "compact" || parsed.readingScale === "large"
          ? parsed.readingScale
          : DEFAULT_WORKSPACE_PREFERENCES.readingScale
    };
  } catch {
    return DEFAULT_WORKSPACE_PREFERENCES;
  }
}

export function saveWorkspacePreferences(
  workspaceId: string,
  preferences: WorkspacePreferences
): void {
  localStorage.setItem(
    `${PREFERENCE_PREFIX}${workspaceId}`,
    JSON.stringify(preferences)
  );
}

export function useWorkspacePreferences(workspaceId: string) {
  const [preferences, setPreferences] = useState(() =>
    loadWorkspacePreferences(workspaceId)
  );

  useEffect(() => {
    setPreferences(loadWorkspacePreferences(workspaceId));
  }, [workspaceId]);

  return [preferences, setPreferences] as const;
}

export function matchesSearchShortcut(
  event: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "shiftKey">,
  shortcut: SearchShortcut
): boolean {
  const modifier = event.ctrlKey || event.metaKey;
  if (!modifier) return false;
  if (shortcut === "ctrl-shift-f") {
    return event.shiftKey && event.key.toLowerCase() === "f";
  }
  return !event.shiftKey && event.key.toLowerCase() === "j";
}
