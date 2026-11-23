import { useEffect, useRef, useState } from "react";

export type EditorOwnershipState =
  "acquiring" | "owned" | "blocked" | "unavailable";

type WebLock = {
  name: string;
};

type WebLockManager = {
  request<T>(
    name: string,
    options: { ifAvailable: true },
    callback: (lock: WebLock | null) => Promise<T>
  ): Promise<T>;
};

export function useEditorOwnership(scopeKey: string) {
  const [state, setState] = useState<EditorOwnershipState>("acquiring");
  const [retryVersion, setRetryVersion] = useState(0);
  const ownedRef = useRef(false);
  const tabIdRef = useRef(
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `tab-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );

  useEffect(() => {
    if (!scopeKey) {
      setState("unavailable");
      return;
    }
    let active = true;
    let releaseLock: (() => void) | undefined;
    let blockedRetryTimer: number | undefined;
    ownedRef.current = false;
    setState("acquiring");

    const channel =
      typeof BroadcastChannel === "undefined"
        ? undefined
        : new BroadcastChannel(`inkloom-editor-owner:${scopeKey}`);
    channel?.addEventListener("message", (event: MessageEvent<unknown>) => {
      const message = event.data;
      if (
        !ownedRef.current &&
        message &&
        typeof message === "object" &&
        "type" in message &&
        message.type === "released"
      ) {
        setRetryVersion((version) => version + 1);
      }
    });

    const lockManager = (navigator as Navigator & { locks?: WebLockManager })
      .locks;
    if (!lockManager) {
      ownedRef.current = true;
      setState("owned");
      channel?.postMessage({ type: "acquired", tabId: tabIdRef.current });
      return () => {
        active = false;
        const wasOwned = ownedRef.current;
        ownedRef.current = false;
        if (wasOwned) {
          channel?.postMessage({ type: "released", tabId: tabIdRef.current });
        }
        channel?.close();
      };
    }

    void lockManager
      .request(
        `inkloom-editor:${scopeKey}`,
        { ifAvailable: true },
        async (lock) => {
          if (!active) return;
          if (!lock) {
            setState("blocked");
            blockedRetryTimer = window.setTimeout(() => {
              if (active && !ownedRef.current) {
                setRetryVersion((version) => version + 1);
              }
            }, 800);
            return;
          }
          ownedRef.current = true;
          setState("owned");
          channel?.postMessage({ type: "acquired", tabId: tabIdRef.current });
          await new Promise<void>((resolve) => {
            releaseLock = resolve;
          });
        }
      )
      .catch(() => {
        if (!active) return;
        ownedRef.current = true;
        setState("unavailable");
      });

    return () => {
      active = false;
      if (blockedRetryTimer !== undefined) {
        window.clearTimeout(blockedRetryTimer);
      }
      const wasOwned = ownedRef.current;
      ownedRef.current = false;
      releaseLock?.();
      if (wasOwned) {
        channel?.postMessage({ type: "released", tabId: tabIdRef.current });
      }
      channel?.close();
    };
  }, [retryVersion, scopeKey]);

  return state;
}
