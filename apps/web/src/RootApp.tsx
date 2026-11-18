import { useEffect, useState } from "react";
import type { CloudUser } from "@inkloom/storage";
import WorkspaceApp from "./App";
import { AuthScreen } from "./AuthScreen";
import { cloudClient } from "./cloud-workspace";

type SessionState =
  | { status: "checking" }
  | { status: "anonymous"; error?: string }
  | { status: "authenticated"; user: CloudUser };

export default function RootApp() {
  const [session, setSession] = useState<SessionState>({ status: "checking" });

  useEffect(() => {
    let cancelled = false;
    void cloudClient
      .getSession()
      .then((user) => {
        if (cancelled) return;
        setSession(
          user
            ? { status: "authenticated", user }
            : { status: "anonymous" }
        );
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setSession({
          status: "anonymous",
          error:
            error instanceof Error
              ? `无法连接云端：${error.message}`
              : "无法连接云端服务。"
        });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (session.status === "checking") {
    return (
      <main className="session-loading">
        <span className="brand-mark" aria-hidden="true">
          <span>墨</span>
        </span>
        <p>正在打开你的工作区…</p>
      </main>
    );
  }

  if (session.status === "anonymous") {
    return (
      <>
        {session.error && (
          <div className="auth-connection-warning" role="status">
            {session.error}
          </div>
        )}
        <AuthScreen
          onLogin={(email, password) =>
            cloudClient.login({ email, password }).then((user) => {
              setSession({ status: "authenticated", user });
              return user;
            })
          }
          onRegister={(displayName, email, password) =>
            cloudClient
              .register({ displayName, email, password })
              .then((user) => {
                setSession({ status: "authenticated", user });
                return user;
              })
          }
        />
      </>
    );
  }

  return (
    <WorkspaceApp
      user={session.user}
      onLogout={async () => {
        await cloudClient.logout();
        setSession({ status: "anonymous" });
      }}
    />
  );
}
