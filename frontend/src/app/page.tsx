"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";

type Health = { ok: boolean; db: string; env: string; uptime: number };

export default function Home() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    // Render's free tier sleeps after 15 min; the first call can take ~60s.
    const timer = setTimeout(() => setSlow(true), 3000);

    api<Health>("/health")
      .then(setHealth)
      .catch((e: ApiError) => setError(e.message))
      .finally(() => {
        clearTimeout(timer);
        setSlow(false);
      });

    return () => clearTimeout(timer);
  }, []);

  return (
    <main className="mx-auto max-w-md p-8 font-sans">
      <h1 className="text-xl font-semibold">Meme&apos;d Payout Tracker</h1>

      {!health && !error && (
        <p className="mt-4 text-sm">
          {slow ? "Waking up the API (free tier, up to 60s)…" : "Checking API…"}
        </p>
      )}

      {health && (
        <p className="mt-4 text-sm">
          API: ok · DB: {health.db} · env: {health.env}
        </p>
      )}

      {error && <p className="mt-4 text-sm text-red-600">API error: {error}</p>}
    </main>
  );
}
