"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { clearSession, getToken, getUser } from "@/lib/auth";
import { useSession } from "@/lib/useSession";
import { formatINR, type Milestone } from "@/lib/ladder";

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

type Submission = {
  _id: string;
  url: string;
  views: number;
  paidAmount: number;
  campaign: {
    _id: string;
    name: string;
    platform: string;
    status: string;
  } | null;
};

export default function CreatorPage() {
  const { user, loading } = useSession("creator");

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [earnings, setEarnings] = useState(0);
  const [fetching, setFetching] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [campaignId, setCampaignId] = useState("");
  const [url, setUrl] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Per-row draft view counts, keyed by submission id.
  const [viewDrafts, setViewDrafts] = useState<Record<string, string>>({});
  const [patching, setPatching] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setFetching(true);
    try {
      // Both lists move together after any payout, so fetch them together.
      const [c, s] = await Promise.all([
        api<{ campaigns: Campaign[] }>("/api/campaigns", { token: getToken() }),
        api<{ submissions: Submission[]; totalEarnings: number }>(
          "/api/submissions/mine",
          { token: getToken() },
        ),
      ]);
      setCampaigns(c.campaigns);
      setSubmissions(s.submissions);
      setEarnings(s.totalEarnings);
      setLoadError(null);
    } catch (err) {
      setLoadError(
        err instanceof ApiError ? err.message : "Could not load data",
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!campaignId) {
      setFormError("Pick a campaign");
      return;
    }

    setBusy(true);
    try {
      await api(`/api/campaigns/${campaignId}/submissions`, {
        method: "POST",
        token: getToken(),
        body: { url },
      });
      setUrl("");
      await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Could not submit");
    } finally {
      setBusy(false);
    }
  }

  /**
   * Stands in for the platform webhook. Unauthenticated by design per the brief,
   * so no token is sent — this is the same call an Instagram/YouTube poller
   * would make.
   */
  async function simulateViews(id: string) {
    const raw = viewDrafts[id];
    const views = Number(raw);
    if (!Number.isInteger(views) || views < 0) {
      setNotice("Views must be a whole number");
      return;
    }

    setPatching(id);
    setNotice(null);
    try {
      const r = await api<{ paidNow: number; shortfall: number }>(
        `/api/submissions/${id}/views`,
        { method: "PATCH", body: { views } },
      );
      setNotice(
        r.paidNow > 0
          ? `Paid ${formatINR(r.paidNow)}` +
              (r.shortfall > 0
                ? ` · ${formatINR(r.shortfall)} unpaid (budget exhausted)`
                : "")
          : r.shortfall > 0
            ? `Nothing paid · ${formatINR(r.shortfall)} owed but budget is exhausted`
            : "No new milestone crossed",
      );
      await load();
    } catch (err) {
      setNotice(err instanceof ApiError ? err.message : "Update failed");
    } finally {
      setPatching(null);
    }
  }

  if (loading || !user) return <main className="p-8 text-sm">Loading…</main>;

  return (
    <main className="mx-auto max-w-3xl p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Creator · {user.name}</h1>
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

      <p className="mt-4 text-sm">
        Total earnings:{" "}
        <span className="font-semibold">{formatINR(earnings)}</span>
      </p>

      {loadError && <p className="mt-3 text-sm text-red-500">{loadError}</p>}

      <section className="mt-8">
        <h2 className="font-medium">Submit a post</h2>
        <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-3">
          <select
            className="border p-2"
            value={campaignId}
            onChange={(e) => setCampaignId(e.target.value)}
          >
            <option value="">Select a live campaign…</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {formatINR(c.remaining)} left
              </option>
            ))}
          </select>

          <input
            className="border p-2"
            type="url"
            placeholder="https://instagram.com/p/…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
          />

          <button
            type="submit"
            disabled={busy || campaigns.length === 0}
            className="border bg-emerald-600 p-2 text-white disabled:opacity-50"
          >
            {busy ? "Submitting…" : "Submit post"}
          </button>
        </form>

        {campaigns.length === 0 && !fetching && (
          <p className="mt-3 text-sm text-gray-500">
            No live campaigns right now.
          </p>
        )}
        {formError && <p className="mt-3 text-sm text-red-500">{formError}</p>}
      </section>

      <section className="mt-10">
        <h2 className="font-medium">Your submissions</h2>
        {notice && <p className="mt-2 text-sm text-emerald-500">{notice}</p>}

        {fetching && <p className="mt-3 text-sm">Loading…</p>}
        {!fetching && submissions.length === 0 && (
          <p className="mt-3 text-sm text-gray-500">Nothing submitted yet.</p>
        )}

        <div className="mt-3 flex flex-col gap-4">
          {submissions.map((s) => (
            <div key={s._id} className="border p-4">
              <div className="flex items-baseline justify-between gap-4">
                <span className="truncate text-sm">{s.url}</span>
                <span className="shrink-0 text-xs uppercase text-gray-500">
                  {s.campaign?.name ?? "—"} · {s.campaign?.status ?? "—"}
                </span>
              </div>

              <p className="mt-2 text-sm">
                {s.views.toLocaleString("en-IN")} views · earned{" "}
                <span className="font-semibold">{formatINR(s.paidAmount)}</span>
              </p>

              <div className="mt-3 flex gap-2">
                <input
                  className="w-40 border p-1 text-sm"
                  type="number"
                  min={0}
                  placeholder="Simulate views"
                  value={viewDrafts[s._id] ?? ""}
                  onChange={(e) =>
                    setViewDrafts((d) => ({ ...d, [s._id]: e.target.value }))
                  }
                />
                <button
                  onClick={() => void simulateViews(s._id)}
                  disabled={patching === s._id || !viewDrafts[s._id]}
                  className="border px-3 text-sm disabled:opacity-40"
                >
                  {patching === s._id ? "Updating…" : "Update views"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
