import { useQuery } from "@tanstack/react-query";
import { Navigate } from "react-router";
import { BrandMark } from "../components/brand-mark";
import { Button, WorkspaceSkeleton } from "@inkloom/ui";
import { workspacesQuery } from "../queries";

export function HomeRedirect() {
  const query = useQuery(workspacesQuery);

  if (query.isPending) return <WorkspaceSkeleton />;

  if (query.isError || !query.data) {
    return (
      <main className="grid min-h-dvh place-items-center bg-[#fafbf9] px-5 text-center">
        <div className="max-w-md rounded-[1.5rem] border border-line-soft bg-white p-8 shadow-sm">
          <BrandMark className="mx-auto size-12" />
          <h1 className="mt-5 font-display text-2xl font-semibold">
            工作区暂时无法打开
          </h1>
          <p className="mt-2 text-sm leading-6 text-ink-500">
            {query.error instanceof Error
              ? query.error.message
              : "请检查网络后重试。"}
          </p>
          <Button
            variant="primary"
            className="mt-5"
            onClick={() => void query.refetch()}
          >
            重新连接
          </Button>
        </div>
      </main>
    );
  }

  return (
    <Navigate
      to={`/workspaces/${encodeURIComponent(
        query.data.activeWorkspace.id
      )}/notes`}
      replace
    />
  );
}
