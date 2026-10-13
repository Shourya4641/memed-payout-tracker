export type Milestone = { views: number; payout: number };

export type Campaign = {
  id: string;
  name: string;
  platform: string;
  budget: number;
  spent: number;
  remaining: number;
  ladder: Milestone[];
  status: string;
};

export type Submission = {
  id: string;
  url: string;
  views: number;
  paidAmount: number;
  flagged: boolean;
  campaign: {
    id: string;
    name: string;
    platform: string;
    status: string;
  } | null;
};
