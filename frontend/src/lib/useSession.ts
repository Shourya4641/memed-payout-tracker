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
    const check = () => {
      const u = getUser();
      if (!u) {
        window.location.replace("/login");
        return;
      }
      if (requiredRole && u.role !== requiredRole) {
        router.replace(u.role === "brand" ? "/brand" : "/creator");
        return;
      }
      setUser(u);
      setLoading(false);
    };

    check();
    // useEffect does not re-run when a page is restored from the back-forward
    // cache, so without this the guard never fires on a Back navigation.
    window.addEventListener("pageshow", check);
    return () => window.removeEventListener("pageshow", check);
  }, [requiredRole, router]);

  return { user, loading };
}
