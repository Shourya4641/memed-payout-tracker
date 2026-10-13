export interface Milestone {
  /** View threshold at which this payout unlocks. */
  views: number;
  /** Cumulative total payable once this milestone is crossed (not an increment). */
  payout: number;
}

export interface PayoutInput {
  views: number;
  ladder: Milestone[];
  alreadyPaid: number;
  remainingBudget: number;
}

export interface PayoutResult {
  /** Total the creator has earned at this view count. */
  entitlement: number;
  /** Earned but not yet received. */
  owed: number;
  /** What we can actually pay now, capped by remaining budget. */
  toPay: number;
  /** Owed but unpayable because the budget is exhausted. */
  shortfall: number;
}

/**
 * The highest milestone payout the view count has unlocked.
 * Ladder order is not assumed; we take the max over all crossed milestones.
 */
export function entitlementFor(views: number, ladder: Milestone[]): number {
  let best = 0;
  for (const m of ladder) {
    if (views >= m.views && m.payout > best) best = m.payout;
  }
  return best;
}

/**
 * Payout is a function of STATE, not of the request. Replaying the same
 * update pays zero the second time, so the caller is idempotent for free.
 */
export function computePayout(input: PayoutInput): PayoutResult {
  const entitlement = entitlementFor(input.views, input.ladder);
  const owed = Math.max(0, entitlement - input.alreadyPaid);
  const toPay = Math.min(owed, Math.max(0, input.remainingBudget));
  return { entitlement, owed, toPay, shortfall: owed - toPay };
}
