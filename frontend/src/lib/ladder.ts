export type Milestone = { views: number; payout: number };

/**
 * Parses "10000:500, 50000:2000" into milestones.
 * Chosen over a dynamic row editor to keep the UI small; the API validates
 * the same rules server-side regardless of what the client sends.
 */
export function parseLadder(input: string): Milestone[] {
  const parts = input
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) throw new Error("Add at least one milestone");

  return parts.map((part) => {
    const [v, p] = part.split(":").map((s) => s.trim());
    const views = Number(v);
    const payout = Number(p);

    if (
      !Number.isInteger(views) ||
      views <= 0 ||
      !Number.isInteger(payout) ||
      payout <= 0
    ) {
      throw new Error(
        `Invalid milestone "${part}" — use views:payout, e.g. 10000:500`,
      );
    }
    return { views, payout };
  });
}

export const formatINR = (n: number) => `₹${n.toLocaleString("en-IN")}`;
