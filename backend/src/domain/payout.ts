export interface Milestone {
  views: number;
  payout: number;
}

export interface PayoutInput {
  views: number;
  ladder: Milestone[];
  alreadyPaid: number;
  remainingBudget: number;
}

export interface PayoutResult {
  entitlement: number;
  owed: number;
  toPay: number;
  shortfall: number;
}

export function entitlementFor(views: number, ladder: Milestone[]): number {
  let best = 0;
  for (const m of ladder) {
    if (views >= m.views && m.payout > best) best = m.payout;
  }
  return best;
}

export function computePayout(input: PayoutInput): PayoutResult {
  const entitlement = entitlementFor(input.views, input.ladder);
  const owed = Math.max(0, entitlement - input.alreadyPaid);
  const toPay = Math.min(owed, Math.max(0, input.remainingBudget));
  return { entitlement, owed, toPay, shortfall: owed - toPay };
}
