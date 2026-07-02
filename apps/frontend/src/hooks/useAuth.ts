import { useQuery } from "@tanstack/react-query";
import { getMe } from "../api/auth";
import type { AuthUser } from "../api/auth";

export interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export function useAuth(): AuthState {
  const query = useQuery({
    queryKey: ["auth", "me"],
    queryFn: getMe,
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  return {
    user: query.data?.user ?? null,
    isAuthenticated: query.isSuccess,
    isLoading: query.isPending,
  };
}
