"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUser, type Role, type SessionUser } from "./auth";

/**
 * Reads the session after mount (never during render — localStorage does not
 * exist during the server prerender). Optionally redirects if the role is wrong.
 */
export function useSession(requiredRole?: Role) {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const u = getUser();
    if (!u) {
      router.replace("/login");
      return;
    }
    if (requiredRole && u.role !== requiredRole) {
      router.replace(u.role === "brand" ? "/brand" : "/creator");
      return;
    }
    setUser(u);
    setLoading(false);
  }, [requiredRole, router]);

  return { user, loading };
}
