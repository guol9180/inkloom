import { QueryClientProvider } from "@tanstack/react-query";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation
} from "react-router";
import { lazy, Suspense, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { BrandMark } from "./components/brand-mark";
import { AuthPage } from "./pages/auth-page";
import { HomeRedirect } from "./pages/home-redirect";
import { queryClient, sessionQuery } from "./queries";

const WorkspacePage = lazy(() =>
  import("./pages/workspace-page").then((module) => ({
    default: module.WorkspacePage
  }))
);

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/register" element={<AuthPage mode="register" />} />
          <Route
            path="/"
            element={
              <RequireAuth>
                <HomeRedirect />
              </RequireAuth>
            }
          />
          <Route
            path="/workspaces/:workspaceId"
            element={
              <RequireAuth>
                <Suspense fallback={<PageLoading />}>
                  <WorkspacePage />
                </Suspense>
              </RequireAuth>
            }
          />
          <Route
            path="/workspaces/:workspaceId/documents/:documentId"
            element={
              <RequireAuth>
                <Suspense fallback={<PageLoading />}>
                  <WorkspacePage />
                </Suspense>
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

function PageLoading() {
  return (
    <main className="grid min-h-dvh place-items-center bg-canvas">
      <div className="grid justify-items-center gap-4">
        <BrandMark className="size-12 rounded-2xl" />
        <p className="text-sm font-medium text-ink-500">正在准备编辑器…</p>
      </div>
    </main>
  );
}

function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation();
  const query = useQuery(sessionQuery);

  if (query.isPending) {
    return (
      <main className="grid min-h-dvh place-items-center bg-canvas text-center">
        <div className="grid justify-items-center gap-4">
          <BrandMark className="size-12 rounded-2xl" />
          <p className="text-sm font-medium text-ink-500">正在打开你的工作区…</p>
        </div>
      </main>
    );
  }

  if (!query.data) {
    const target =
      location.pathname === "/"
        ? "/login"
        : `/login?next=${encodeURIComponent(location.pathname)}`;
    return <Navigate to={target} replace />;
  }

  return children;
}
