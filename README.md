# Meme'd Campaign Payout Tracker

Brands run campaigns with a milestone payout ladder. Creators submit posts. As view
counts arrive, creators are paid the highest milestone they have crossed — never twice
for the same milestone, and never beyond the campaign's budget.

## Live

|          |                                                       |
| -------- | ----------------------------------------------------- |
| **App**  | https://memed-payout-tracker-one.vercel.app           |
| **API**  | https://memed-payout-tracker-h4xk.onrender.com/health |
| **Repo** | https://github.com/Shourya4641/memed-payout-tracker   |

> **First request may take ~60 seconds.** The API runs on Render's free tier, which
> spins the instance down after 15 minutes of inactivity. The app shows a "waking up"
> message while this happens. Subsequent requests are fast.

### Demo accounts

| Role    | Email                | Password    |
| ------- | -------------------- | ----------- |
| Brand   | `brand@memed.demo`   | `demo12345` |
| Creator | `creator@memed.demo` | `demo12345` |

Seeded with three campaigns in different states: one barely started, one part-spent,
and one deliberately exhausted so the partial-payment path is visible without any setup.

As a creator, each submission has a **Simulate views** box. Entering a view count calls
the same `PATCH /api/submissions/:id/views` endpoint a platform poller would, so the
whole payout mechanic is demonstrable in the browser.

---

## Stack

**Backend** — Node.js, TypeScript, Express, MongoDB (Mongoose), Zod, JWT, Jest.
**Frontend** — Next.js 16 (App Router), TypeScript, Tailwind v4.
**Hosting** — Vercel (frontend), Render (API), MongoDB Atlas M0.

## Project structure

```
backend/src/
  domain/        pure business logic — no I/O, no clock, no database
  services/      orchestration: transactions, multi-document consistency
  routes/        HTTP shape only — parse, authorise, delegate, respond
  middleware/    auth, role, body and id validation, errors, request logging
  schemas/       Zod request schemas
  http/          response serialisers: the one place that decides what leaves the API
  models/        Mongoose schemas and indexes
  config/        environment validation (enforced at boot) and shared enums
  errors/        AppError — no dependencies, so the import graph stays acyclic
  types/         shared type aliases
  scripts/       seed script

frontend/src/
  app/           three client-rendered pages: login, brand, creator
  lib/           api client, session storage, shared types, ladder parsing
  components/    shared UI
```

Three deliberate choices in that layout. `domain/` imports nothing else in the codebase,
which is what makes the payout logic testable without a database or a running server.
`AppError` lives in its own module rather than in `app.ts` — routes need it and `app.ts`
imports the routes, so putting it there would create an import cycle that works only by
accident of module caching. And `ladderSchema` stays in `domain/` rather than moving to
`schemas/` with the rest: "payouts must increase with view thresholds" is a business
rule, not a request shape.

Status, platform, role and HTTP status values are enums in `config/constants.ts`. The
motivation is typo safety rather than ease of renaming — `Campaign.find({ status: "liv" })`
returns an empty array with no error anywhere in the stack, while
`CampaignStatus.Liv` does not compile.

## Running locally

```bash
git clone https://github.com/Shourya4641/memed-payout-tracker
cd memed-payout-tracker

# API
cd backend
npm install
cp .env.example .env        # fill in MONGODB_URI and JWT_SECRET
npm run seed -- --yes       # optional: demo data
npm run dev                 # :4000

# App
cd ../frontend
npm install
echo 'NEXT_PUBLIC_API_URL=http://localhost:4000' > .env.local
npm run dev                 # :3000
```

```bash
cd backend && npm test        # payout unit tests
cd backend && npm run typecheck
cd frontend && npm run build  # type check + lint
```

MongoDB **transactions require a replica set**, so a standalone local `mongod` will not
work. Atlas M0 is a three-node replica set; point `MONGODB_URI` at a separate database
on the same cluster (`.../memed_dev`) for development.

### Environment

**`backend/.env`**

| Variable         | Notes                                                                                |
| ---------------- | ------------------------------------------------------------------------------------ |
| `MONGODB_URI`    | Include the database name in the path (`.../memed?...`), or Mongo defaults to `test` |
| `JWT_SECRET`     | 16+ characters; validated at boot                                                    |
| `JWT_EXPIRES_IN` | Default `1h`                                                                         |
| `FRONTEND_URL`   | Exact origin, no trailing slash — used for CORS                                      |
| `PORT`           | Default `4000`. Not set in production; Render injects it                             |

**`frontend/.env.local`**

| Variable              | Notes                                              |
| --------------------- | -------------------------------------------------- |
| `NEXT_PUBLIC_API_URL` | Inlined at build time — redeploy after changing it |

Environment variables are parsed with Zod at boot. A missing or malformed value exits
the process with a readable message rather than surfacing as a 500 later.

Development uses a separate `memed_dev` database on the same Atlas cluster; the deployed
service uses `memed`. `GET /health` reports which one it is connected to.

---

## API

| Method  | Path                             | Auth     | Purpose                            |
| ------- | -------------------------------- | -------- | ---------------------------------- |
| `GET`   | `/health`                        | —        | Liveness, DB state, DB name        |
| `POST`  | `/api/auth/signup`               | —        | Create account, returns JWT        |
| `POST`  | `/api/auth/login`                | —        | Returns JWT                        |
| `POST`  | `/api/campaigns`                 | brand    | Create a campaign                  |
| `GET`   | `/api/campaigns/mine`            | brand    | Own campaigns with spent/remaining |
| `GET`   | `/api/campaigns`                 | creator  | Live campaigns                     |
| `POST`  | `/api/campaigns/:id/submissions` | creator  | Submit a post link                 |
| `GET`   | `/api/submissions/mine`          | creator  | Own submissions + total earnings   |
| `PATCH` | `/api/submissions/:id/views`     | **none** | Update views, trigger payout       |

Responses are built by explicit serialisers rather than returning Mongoose documents, so
internal fields (`__v`, timestamps, `lastViewsAt`) never leak and every resource exposes
`id` rather than `_id`. The property that matters: adding a field to a schema does not
silently add it to the public API. `remaining` is derived on read — storing a second
copy of a budget is how two numbers drift apart.

Errors use one envelope throughout:

```json
{
  "error": {
    "code": "LADDER_EXCEEDS_BUDGET",
    "message": "Top milestone (5000) exceeds the campaign budget (1000)"
  }
}
```

`400` validation · `401` unauthenticated · `403` wrong role · `404` not found · `409` conflict.

Internal failures log the real error server-side and return a generic message; no stack
trace reaches the client.

```bash
curl -X PATCH https://memed-payout-tracker-h4xk.onrender.com/api/submissions/<id>/views \
  -H "Content-Type: application/json" -d '{"views":62000}'
```

---

## Assumptions and decisions

The brief leaves several things open. These are the calls I made.

**Ladder amounts are cumulative totals, not increments.** Crossing 10K and 50K in a
single update pays ₹2,000, not ₹2,500. The brief says the payout is "the amount of the
highest milestone", which only reads this way.

**Budget exhausted mid-payout: pay the partial remainder.** If ₹2,000 is owed and ₹300
remains, the creator receives ₹300 and the response reports `shortfall: 1700`. The
alternative — all-or-nothing — strands budget that the brand has already committed.
Because payouts are computed against what has already been paid, topping up the budget
later settles the remainder automatically, with no reconciliation step. There is a unit
test for exactly that.

**View counts are monotonic; falling views never claw back.** A stale or corrected
reading lower than the stored one is ignored. Paying creators and then reversing it on
a platform's bad data is worse than slightly over-counting.

**PATCH on an exhausted campaign returns 200, not an error.** Views still update; the
payout is zero and `shortfall` says what is owed. The caller is a data feed, not a user —
it should not have to know about campaign lifecycle.

**Money is integer rupees.** No floats anywhere.

**A ladder whose top milestone exceeds the budget is rejected at creation.** It would
promise a payout that can never be honoured.

**One submission per URL per campaign**, enforced by a unique index. Blocks the same
link being farmed across multiple submissions. The route translates the storage-level
duplicate-key error into a domain `409` rather than letting a driver error escape — the
one place a route keeps an explicit `catch` instead of relying on `asyncHandler`, since
error translation is domain logic and belongs next to the write that can produce it.

**The views endpoint is unauthenticated**, as the brief specifies. In production it
would be service-to-service authenticated and rate limited.

**The milestone ladder is entered as text** (`10000:500, 50000:2000`) rather than a
dynamic row editor. A deliberate scope choice: the server validates the same rules
regardless of what the client sends, so the richer UI adds no correctness.

**Validation runs in two independent layers.** The client parses the ladder before any
network call, so malformed input never leaves the browser; the server validates the same
rules plus everything that depends on state it alone knows, such as the budget. The
client layer is for responsiveness, never for correctness.

---

## Payouts: correctness

The payout calculation is a pure function with no I/O, no clock, and no database:

```ts
entitlement = highest milestone payout the view count has crossed
owed        = max(0, entitlement − alreadyPaid)
toPay       = min(owed, remainingBudget)
```

Because `toPay` is derived from **stored state** rather than from the request, replaying
the same update computes zero the second time. Idempotency falls out of the data model;
there are no idempotency keys.

17 unit tests cover the ladder (boundaries, unsorted input, empty ladder), idempotent
replay, falling views, partial payment, zero budget, and settlement after a top-up.

```bash
cd backend && npm test
```

## Concurrency

Two guarantees, by two mechanisms:

- **No double-pay** — the amount comes from the submission's stored `paidAmount`.
- **No overspend** — the campaign's `spent` is raised by a conditional `$inc` that only
  matches while `spent + toPay <= budget`, inside a MongoDB transaction so the
  submission and the campaign move together or not at all.

The `$expr` filter is what enforces the invariant: a non-matching `updateOne` writes
nothing rather than throwing. The `modifiedCount` check is what makes that failure loud —
without it the code would fall through and credit the creator's `paidAmount` while the
campaign's `spent` stayed put. Aborting the transaction keeps the two documents
consistent.

**Verified against the deployed API.** A campaign with a ₹1,000 budget and five
submissions each owed ₹500 — ₹2,500 of demand against ₹1,000 of budget — with all five
view updates fired simultaneously:

```
{"submissionId":"...baa","paidNow":500,"totalPaid":500,"shortfall":0,"campaignStatus":"live"}
{"submissionId":"...bad","paidNow":500,"totalPaid":500,"shortfall":0,"campaignStatus":"exhausted"}
{"submissionId":"...bab","paidNow":0,"totalPaid":0,"shortfall":500,"campaignStatus":"exhausted"}
{"submissionId":"...bac","paidNow":0,"totalPaid":0,"shortfall":500,"campaignStatus":"exhausted"}
{"submissionId":"...bae","paidNow":0,"totalPaid":0,"shortfall":500,"campaignStatus":"exhausted"}

{ "budget": 1000, "spent": 1000, "status": "exhausted" }
```

Two paid, three correctly refused, not a rupee over budget. Note that the three losing
requests did **not** fail — `withTransaction` retried each write conflict, the retry
re-read the updated `spent`, and the payout recomputed to zero with an honest
`shortfall`. Serialising on conflict rather than erroring is the reason for choosing a
transaction over compensating writes.

---

## Security notes

**The JWT is stored in `localStorage`** and sent as a Bearer header. The frontend on
Vercel and the API on Render are separate sites, so an `httpOnly` cookie would need
`SameSite=None; Secure` and is vulnerable to third-party-cookie restrictions. The
trade-off is XSS exposure: any injected script could read the token. Mitigated by a
1-hour expiry, React's default output escaping, no `dangerouslySetInnerHTML`, and no
third-party scripts. The production path would be a Next.js rewrite making the API
same-origin, then an `httpOnly` cookie.

**Role-based routing in the client is convenience only.** Authorisation is enforced
server-side by `requireRole` middleware on every protected route.

**Login returns an identical error** for an unknown email and a wrong password, so the
endpoint cannot be used to enumerate accounts. The response _timing_ still differs,
since bcrypt only runs when the user exists; a production fix would compare against a
dummy hash.

**Request bodies are capped at 10 kB.** No endpoint here accepts anything close to that,
and an unbounded `express.json()` is a trivial denial-of-service surface.

**Malformed object ids are rejected with a 400** before they reach Mongoose, which would
otherwise raise a `CastError` and surface as a 500 for what is a client mistake. This
matters most on the unauthenticated views endpoint.

**Tokens expire after 1 hour.** Any 401 clears the session and redirects to login.

**Logging is `console` only** — an access log plus server-side error logging. Request
bodies are deliberately never logged, since signup and login payloads contain plaintext
passwords. Writing to stdout is the correct transport regardless of library; a
structured logger would add levels, JSON formatting and redaction, none of which pays
for itself against a single instance with no log aggregation.

---

## Known limitations and next steps

- **Not implemented:** Redis caching of the campaign list, spike-anomaly flagging, and
  Docker. Scoped out in favour of test coverage, the concurrency guarantee, and this
  document. The `flagged` field exists on the submission model for the first of these.
- No pagination; fine at demo scale, not at 10,000 creators.
- No refresh tokens — sessions simply expire.
- No rate limiting on the unauthenticated views endpoint.
- No integration tests against a live database; correctness is covered by unit tests on
  the pure logic plus the manual concurrency run above.
- **Serialisers are hand-maintained.** A new schema field stays private until it is
  added to the serialiser — safer than the reverse, but it is a quiet failure mode. The
  production answer is a shared contract: generated types from an OpenAPI spec, or Zod
  schemas shared between request validation and response shaping.
- **Frontend string literals are not shared with the backend enums.** The two are
  separate packages, and duplicating the constants would create two sources of truth
  that can silently diverge. A shared package or generated types is the real fix.
- **`CampaignStatus.Ended` is reserved and currently unreachable** — nothing sets it. It
  exists for a brand-initiated stop, which is out of scope here.
- **Back-forward cache:** React's `useEffect` does not re-run when a page is restored
  from the browser's bfcache, so a logged-out dashboard initially remained visible on
  Back. Logout now replaces the history entry, and a `pageshow` listener in `useSession`
  re-checks the session. Client-side guards remain UX only — authorisation is enforced
  server-side on every request.

### Scaling to 10,000 creators

10,000 creators is small for MongoDB. The load is **view ingestion** — tens of thousands
of submissions polled from the Instagram and YouTube APIs, not human traffic.

- Move ingestion to a queue (BullMQ) with workers **partitioned by campaign**, so updates
  to one campaign are serialised. The single `spent` counter is the contention hotspot;
  partitioning removes transaction retries rather than just absorbing them.
- Add an append-only `Payout` ledger (`{submission, amount, entitlementAfter, at}`) and
  reconcile it against `spent`. Today `spent` is the only record that money moved.
- Single-field indexes already exist on `campaigns.brand`, `submissions.campaign` and
  `submissions.creator`, plus a unique compound index on `(campaign, url)`. The next
  additions are compound indexes matching the actual query shapes —
  `(brand, createdAt)` and `(status, createdAt)` on campaigns, `(creator, createdAt)` on
  submissions — so the sort is served by the index rather than in memory.
- Cache the live-campaign list in Redis with a short TTL. Payout decisions must always
  read Mongo — a cached `spent` could authorise an overspend.
- Rate-limit and service-authenticate the views endpoint.
- Run spike detection asynchronously off the ledger rather than in the request path.
- M0's 100 ops/sec and 500-connection ceiling is the first real wall; a paid tier with
  connection pooling at the worker layer comes before any sharding conversation.

An LLM would be a reasonable fit for spike classification — distinguishing a genuinely
viral clip from purchased views needs context a fixed threshold cannot capture.
