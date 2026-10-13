"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { clearSession, getToken, getUser } from "@/lib/auth";
import { useSession } from "@/lib/useSession";
import { parseLadder, formatINR, type Milestone } from "@/lib/ladder";

type Campaign = {
  id: string;
  name: string;
  platform: string;
  budget: number;
  spent: number;
  remaining: number;
  ladder: Milestone[];
  status: string;
};

export default function BrandPage() {
  const { user, loading } = useSession("brand");

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);

  const [name, setName] = useState("");
  const [platform, setPlatform] = useState("instagram");
  const [budget, setBudget] = useState("");
  const [ladderText, setLadderText] = useState("10000:500, 50000:2000");
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // useCallback keeps this function identity stable so the effect below
  // doesn't re-run on every render.
  const load = useCallback(async () => {
    setFetching(true);
    try {
      const data = await api<{ campaigns: Campaign[] }>("/api/campaigns/mine", {
        token: getToken(),
      });
      setCampaigns(data.campaigns);
      setListError(null);
    } catch (err) {
      setListError(
        err instanceof ApiError ? err.message : "Could not load campaigns",
      );
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  useEffect(() => {
    // useEffect does not re-run when a page is restored from the back-forward
    // cache, so the session guard would never fire on a Back navigation.
    const recheck = () => {
      if (!getUser()) window.location.replace("/login");
    };
    window.addEventListener("pageshow", recheck);
    return () => window.removeEventListener("pageshow", recheck);
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    let ladder: Milestone[];
    try {
      ladder = parseLadder(ladderText);
    } catch (err) {
      setFormError((err as Error).message);
      return;
    }

    setBusy(true);
    try {
      await api("/api/campaigns", {
        method: "POST",
        token: getToken(),
        body: { name, platform, budget: Number(budget), ladder },
      });
      setName("");
      setBudget("");
      await load();
    } catch (err) {
      setFormError(
        err instanceof ApiError ? err.message : "Could not create campaign",
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user) return <main className="p-8 text-sm">Loading…</main>;

  return (
    <main className="mx-auto max-w-3xl p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Brand · {user.name}</h1>
        <button
          onClick={() => {
            clearSession();
            window.location.replace("/login");
          }}
          className="text-sm underline"
        >
          Log out
        </button>
      </div>

      <section className="mt-8">
        <h2 className="font-medium">New campaign</h2>
        <form onSubmit={handleCreate} className="mt-3 flex flex-col gap-3">
          <input
            className="border p-2"
            placeholder="Campaign name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <select
            className="border p-2"
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
          >
            <option value="instagram">Instagram</option>
            <option value="youtube">YouTube</option>
          </select>

          <input
            className="border p-2"
            type="number"
            min={1}
            placeholder="Total budget (₹)"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            required
          />

          <label className="text-sm">
            Milestone ladder
            <textarea
              className="mt-1 w-full border p-2 font-mono text-sm"
              rows={2}
              value={ladderText}
              onChange={(e) => setLadderText(e.target.value)}
            />
            <span className="text-xs text-gray-500">
              views:payout pairs, comma separated — e.g. 10000:500, 50000:2000
            </span>
          </label>

          <button
            type="submit"
            disabled={busy}
            className="border bg-black p-2 text-white disabled:opacity-50"
          >
            {busy ? "Creating…" : "Create campaign"}
          </button>
        </form>

        {formError && <p className="mt-3 text-sm text-red-600">{formError}</p>}
      </section>

      <section className="mt-10">
        <h2 className="font-medium">Your campaigns</h2>

        {fetching && <p className="mt-3 text-sm">Loading…</p>}
        {listError && <p className="mt-3 text-sm text-red-600">{listError}</p>}
        {!fetching && !listError && campaigns.length === 0 && (
          <p className="mt-3 text-sm text-gray-600">No campaigns yet.</p>
        )}

        <div className="mt-3 flex flex-col gap-4">
          {campaigns.map((c) => {
            const pct =
              c.budget === 0 ? 0 : Math.round((c.spent / c.budget) * 100);
            return (
              <div key={c.id} className="border p-4">
                <div className="flex items-baseline justify-between">
                  <span className="font-medium">{c.name}</span>
                  <span className="text-xs uppercase text-gray-500">
                    {c.platform} · {c.status}
                  </span>
                </div>

                <div className="mt-2 h-2 w-full bg-gray-200">
                  <div className="h-2 bg-black" style={{ width: `${pct}%` }} />
                </div>

                <p className="mt-2 text-sm">
                  Spent {formatINR(c.spent)} of {formatINR(c.budget)} ·{" "}
                  {formatINR(c.remaining)} remaining
                </p>

                <p className="mt-1 text-xs text-gray-500">
                  {c.ladder
                    .map(
                      (m) =>
                        `${m.views.toLocaleString("en-IN")} → ${formatINR(m.payout)}`,
                    )
                    .join("  ·  ")}
                </p>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
