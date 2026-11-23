import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useParams
} from "react-router";
import { lazy, Suspense, type ReactNode } from "react";
import type { WorkspaceId } from "@inkloom/core";
import { WorkspaceSkeleton } from "@inkloom/ui";
import { cloudClient } from "./cloud-workspace";
import { AuthPage } from "./pages/auth-page";
import { HomeRedirect } from "./pages/home-redirect";
import { queryClient, sessionQuery } from "./queries";

const ProductWorkspacePage = lazy(() =>
  import("./pages/product-workspace-page").then((module) => ({
    default: module.ProductWorkspacePage
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
                <WorkspaceHomeRedirect />
              </RequireAuth>
            }
          />
          <Route
            path="/workspaces/:workspaceId/notes"
            element={
              <RequireAuth>
                <Suspense fallback={<WorkspaceSkeleton />}>
                  <ProductWorkspacePage mode="notes" />
                </Suspense>
              </RequireAuth>
            }
          />
          <Route
            path="/workspaces/:workspaceId/notes/:documentId"
            element={
              <RequireAuth>
                <Suspense fallback={<WorkspaceSkeleton />}>
                  <ProductWorkspacePage mode="notes" />
                </Suspense>
              </RequireAuth>
            }
          />
          <Route
            path="/workspaces/:workspaceId/knowledge"
            element={
              <RequireAuth>
                <Suspense fallback={<WorkspaceSkeleton />}>
                  <ProductWorkspacePage mode="knowledge" />
                </Suspense>
              </RequireAuth>
            }
          />
          <Route
            path="/workspaces/:workspaceId/knowledge/:knowledgeBaseId"
            element={
              <RequireAuth>
                <Suspense fallback={<WorkspaceSkeleton />}>
                  <ProductWorkspacePage mode="knowledge" />
                </Suspense>
              </RequireAuth>
            }
          />
          <Route
            path="/workspaces/:workspaceId/knowledge/:knowledgeBaseId/:documentId"
            element={
              <RequireAuth>
                <Suspense fallback={<WorkspaceSkeleton />}>
                  <ProductWorkspacePage mode="knowledge" />
                </Suspense>
              </RequireAuth>
            }
          />
          <Route
            path="/workspaces/:workspaceId/documents/:documentId"
            element={
              <RequireAuth>
                <LegacyDocumentRedirect />
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

function WorkspaceHomeRedirect() {
  const { workspaceId = "" } = useParams();
  return (
    <Navigate
      to={`/workspaces/${encodeURIComponent(workspaceId)}/notes`}
      replace
    />
  );
}

function LegacyDocumentRedirect() {
  const { workspaceId = "", documentId = "" } = useParams();
  const document = useQuery({
    queryKey: ["document", workspaceId, documentId],
    queryFn: () =>
      cloudClient.workspace(workspaceId as WorkspaceId).readDocument(documentId)
  });

  if (document.isPending) return <WorkspaceSkeleton />;
  if (document.isError || !document.data) return <Navigate to="/" replace />;
  if (
    document.data.meta.lifecycle === "knowledge" &&
    document.data.meta.knowledgeBaseId
  ) {
    return (
      <Navigate
        to={`/workspaces/${encodeURIComponent(
          workspaceId
        )}/knowledge/${encodeURIComponent(
          document.data.meta.knowledgeBaseId
        )}/${encodeURIComponent(documentId)}`}
        replace
      />
    );
  }
  return (
    <Navigate
      to={`/workspaces/${encodeURIComponent(
        workspaceId
      )}/notes/${encodeURIComponent(documentId)}`}
      replace
    />
  );
}

function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation();
  const query = useQuery(sessionQuery);

  if (query.isPending) return <WorkspaceSkeleton />;

  if (!query.data) {
    const target =
      location.pathname === "/"
        ? "/login"
        : `/login?next=${encodeURIComponent(location.pathname)}`;
    return <Navigate to={target} replace />;
  }

  return children;
}
