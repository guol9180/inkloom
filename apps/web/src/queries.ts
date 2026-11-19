import { QueryClient } from "@tanstack/react-query";
import { cloudClient, loadCloudWorkspaces } from "./cloud-workspace";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 20_000,
      gcTime: 10 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false
    },
    mutations: {
      retry: 0
    }
  }
});

export const sessionQuery = {
  queryKey: ["session"] as const,
  queryFn: () => cloudClient.getSession()
};

export const workspacesQuery = {
  queryKey: ["workspaces"] as const,
  queryFn: loadCloudWorkspaces
};
