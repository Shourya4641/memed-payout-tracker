"use client";

import { useSession } from "@/lib/useSession";
import { clearSession } from "@/lib/auth";

export default function BrandPage() {
  const { user, loading } = useSession("creator");
  if (loading || !user) return <main className="p-8 text-sm">Loading…</main>;

  return (
    <main className="mx-auto max-w-3xl p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Brand · {user.name}</h1>
        <button
          onClick={() => {
            clearSession();
            window.location.href = "/login";
          }}
          className="text-sm underline"
        >
          Log out
        </button>
      </div>
      <p className="mt-6 text-sm text-gray-600">Campaigns coming next.</p>
    </main>
  );
}
