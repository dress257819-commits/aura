import { useQuery } from "@tanstack/react-query";
import { apiGet, ApiError } from "@/lib/api";
import { getLocalMe } from "@/lib/auth";
import type { MeProfile } from "@/lib/types";

// Signed-in user or null when the session cookie is absent/expired.
export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const localMe = getLocalMe();
      if (localMe) return localMe;

      try {
        return await apiGet<MeProfile>("/auth/me");
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
    staleTime: 60_000,
  });
}
