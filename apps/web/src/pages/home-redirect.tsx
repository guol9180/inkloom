import { useQuery } from "@tanstack/react-query";
import { Navigate } from "react-router";
import { BrandMark } from "../components/brand-mark";
import { workspacesQuery } from "../queries";

export function HomeRedirect() {
  const query = useQuery(workspacesQuery);

  if (query.isPending) {
    return (
      <main className="grid min-h-dvh place-items-center bg-canvas">
        <div className="grid justify-items-center gap-4">
          <BrandMark className="size-12 rounded-2xl" />
          <p className="text-sm text-ink-500">正在整理工作区…</p>
        </div>
      </main>
    );
  }

  if (query.isError || !query.data) {
    return (
      <main className="grid min-h-dvh place-items-center bg-canvas px-5 text-center">
        <div className="max-w-md rounded-3xl border border-line bg-paper p-8 shadow-sm">
          <BrandMark className="mx-auto size-12" />
          <h1 className="mt-5 font-display text-2xl font-semibold">工作区暂时无法打开</h1>
          <p className="mt-2 text-sm leading-6 text-ink-500">
            {query.error instanceof Error ? query.error.message : "请检查网络后重试。"}
          </p>
          <button
            className="mt-5 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white"
            type="button"
            onClick={() => void query.refetch()}
          >
            重新连接
          </button>
        </div>
      </main>
    );
  }

  return (
    <Navigate
      to={`/workspaces/${encodeURIComponent(query.data.activeWorkspace.id)}`}
      replace
    />
  );
}
