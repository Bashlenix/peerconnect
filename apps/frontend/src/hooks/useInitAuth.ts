import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getMe } from "../api/auth";
import { useAuthStore } from "../store/auth";

export function useInitAuth() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const query = useQuery({
    queryKey: ["auth", "me"],
    queryFn: getMe,
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (query.isSuccess) {
      setAuth(query.data.user);
    }
    if (query.isError) {
      clearAuth();
    }
  }, [query.isSuccess, query.isError, query.data, setAuth, clearAuth]);
}
