import {
  computePayout,
  entitlementFor,
  type Milestone,
} from "../domain/payout";

const LADDER: Milestone[] = [
  { views: 10_000, payout: 500 },
  { views: 50_000, payout: 2_000 },
  { views: 100_000, payout: 5_000 },
];

const BIG = Number.MAX_SAFE_INTEGER;

describe("entitlementFor", () => {
  it.each([
    ["below the first milestone", 9_999, 0],
    ["exactly on a threshold", 10_000, 500],
    ["between milestones", 49_999, 500],
    ["on the top milestone", 100_000, 5_000],
    ["far above the top", 10_000_000, 5_000],
    ["zero views", 0, 0],
  ])("%s: %i views -> %i", (_label, views, expected) => {
    expect(entitlementFor(views, LADDER)).toBe(expected);
  });

  it("handles an unsorted ladder", () => {
    const shuffled = [LADDER[2], LADDER[0], LADDER[1]];
    expect(entitlementFor(60_000, shuffled)).toBe(2_000);
  });

  it("returns 0 for an empty ladder", () => {
    expect(entitlementFor(999_999, [])).toBe(0);
  });
});

describe("computePayout — budget is unconstrained", () => {
  it("pays the full amount on first crossing", () => {
    const r = computePayout({
      views: 10_000,
      ladder: LADDER,
      alreadyPaid: 0,
      remainingBudget: BIG,
    });
    expect(r).toEqual({
      entitlement: 500,
      owed: 500,
      toPay: 500,
      shortfall: 0,
    });
  });

  it("crossing two milestones at once pays the highest, not the sum", () => {
    const r = computePayout({
      views: 60_000,
      ladder: LADDER,
      alreadyPaid: 0,
      remainingBudget: BIG,
    });
    expect(r.toPay).toBe(2_000);
  });

  it("pays only the delta when a milestone was already paid", () => {
    const r = computePayout({
      views: 50_000,
      ladder: LADDER,
      alreadyPaid: 500,
      remainingBudget: BIG,
    });
    expect(r.toPay).toBe(1_500);
  });
});

describe("computePayout — idempotency", () => {
  it("pays nothing when replayed at the same view count", () => {
    const first = computePayout({
      views: 50_000,
      ladder: LADDER,
      alreadyPaid: 0,
      remainingBudget: BIG,
    });
    const second = computePayout({
      views: 50_000,
      ladder: LADDER,
      alreadyPaid: first.toPay,
      remainingBudget: BIG,
    });
    expect(second.toPay).toBe(0);
  });

  it("pays nothing when views decrease, and never claws back", () => {
    const r = computePayout({
      views: 5_000,
      ladder: LADDER,
      alreadyPaid: 2_000,
      remainingBudget: BIG,
    });
    expect(r.toPay).toBe(0);
    expect(r.owed).toBe(0);
  });
});

describe("computePayout — budget cap", () => {
  it("pays the partial remainder and reports the shortfall", () => {
    const r = computePayout({
      views: 50_000,
      ladder: LADDER,
      alreadyPaid: 0,
      remainingBudget: 300,
    });
    expect(r).toEqual({
      entitlement: 2_000,
      owed: 2_000,
      toPay: 300,
      shortfall: 1_700,
    });
  });

  it("pays nothing when the budget is exhausted", () => {
    const r = computePayout({
      views: 100_000,
      ladder: LADDER,
      alreadyPaid: 0,
      remainingBudget: 0,
    });
    expect(r.toPay).toBe(0);
    expect(r.shortfall).toBe(5_000);
  });

  it("never pays a negative amount on an over-spent campaign", () => {
    const r = computePayout({
      views: 100_000,
      ladder: LADDER,
      alreadyPaid: 0,
      remainingBudget: -50,
    });
    expect(r.toPay).toBe(0);
  });

  it("settles the shortfall after a budget top-up", () => {
    const first = computePayout({
      views: 50_000,
      ladder: LADDER,
      alreadyPaid: 0,
      remainingBudget: 300,
    });
    const after = computePayout({
      views: 50_000,
      ladder: LADDER,
      alreadyPaid: first.toPay,
      remainingBudget: 5_000,
    });
    expect(after.toPay).toBe(1_700);
  });
});
