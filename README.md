# Agentic Travel Recommendations Service

A working proof-of-concept: a recommendation API with an MCP server surface an AI
agent can discover and invoke, enforcing partner-specific business rules
(recommendation caps, category exclusions) server-side. Member data and
partner configuration are mocked — no real upstream integrations.

## Stack

TypeScript + Node.js, Express (REST API), `@modelcontextprotocol/sdk` (MCP server).

## Run it

```bash
npm install
npm run build      # type-check + compile to dist/
npm run demo       # CLI walkthrough: 4 members, partner-rule enforcement, a live config change
npm run dev         # start the HTTP server (REST + MCP) on :3000
```

### REST API

- `GET /api/members/:memberId` → member profile
- `GET /api/recommendations/:memberId` → rule-enforced recommendations + the rules that were applied
- `GET /health`

### MCP server

`POST /mcp` — a standard MCP endpoint (JSON-RPC over HTTP, stateless). Exposes two tools:

- `get_member_profile({ memberId })`
- `get_recommendations({ memberId })` — same enforcement path as the REST endpoint

Example (`tools/call`):

```bash
curl -s http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_recommendations","arguments":{"memberId":"m-1001"}}}'
```

### Mock data

`src/data/members.json`, `src/data/partners.json`, `src/data/catalog.json` — four
members across three partners, one of which (Aurora Rewards) excludes `cruise`
and another (Harborview Alliance) excludes both `cruise` and `adventure`, so the
enforcement is actually exercised by the demo, not just theoretical.

---

## Section A — Architecture & Trade-offs

### Architecture Overview

The service is a single Node/TypeScript app with one shared service layer and
two entry points into it. `recommendationService.getRecommendations(memberId)`
is the core: it calls the mocked member-data service (`memberService`) for the
member's profile, the mocked partner-config service (`partnerConfigService`)
for that member's partner's cap and category exclusions, generates a scored
candidate list from the mocked offer catalog (`recommendationEngine`, which
knows nothing about partner rules), and runs the result through
`partnerRules.enforcePartnerRules` — a single function that filters excluded
categories and truncates to the cap. Both the REST API
(`GET /api/recommendations/:memberId`) and the MCP server's
`get_recommendations` tool call this exact function; there is no second code
path where enforcement could be skipped. `get_member_profile` (REST and MCP)
reads member data the same way. Partner config is fetched fresh on every
request rather than cached at startup, so a partner's config change is
visible on the very next call (demonstrated live in the CLI demo).

### Design Trade-offs

1. **No cache in front of partner config, by design, for this POC.** Caching
   config trades correctness for latency: a stale cached config is exactly
   the incident in Section B (a member sees a category their partner just
   excluded). At this scale, reading config on every call costs nothing
   meaningful, so I chose freshness over an optimization that isn't needed
   yet. In production, with a real config store and higher volume, I'd cache
   with a short TTL and invalidate on the partner's config-change event
   rather than trust the TTL alone.
2. **Score first, then enforce rules, as two separate functions.** I could
   have baked exclusions into the scoring loop. I kept them separate so
   `enforcePartnerRules` is the one auditable place partner rules apply —
   anyone debugging the Section B incident looks at exactly one function —
   and the scorer stays reusable if partner rules ever move to a rules
   engine, without touching recommendation logic at all.
3. **Stateless MCP transport** (a fresh `StreamableHTTPServerTransport` per
   request, no session tracking) over a persistent session. Simpler for a
   stateless lookup, but it means the MCP surface doesn't currently support
   multi-turn tool state — worth revisiting if a future agent flow needs it.

### Handling Partner Configuration Changes

Because `getRecommendations` re-fetches partner config on every call, a
partner raising/lowering its cap or adding/removing an excluded category
takes effect immediately — no code change, no redeploy, only the data
changes. What *would* need to change for this to be production-grade: (1)
invalidate any config cache on the change event rather than waiting on a TTL;
(2) nothing in `enforcePartnerRules` itself, since caps and exclusions are
data it reads, not logic it hardcodes; (3) add the monitoring described in
the Section B runbook so a bad config value — or a caching bug — is caught
before a member sees it.

---

## Section B — Production Readiness & Incident Response

### Incident Runbook Entry

**Incident: AI Concierge showing excluded category (cruise) recommendations**

**Trigger:** Member reports seeing cruise recommendations; their partner's
configuration excludes the "cruise" category.

**Severity:** Medium — one partner's exclusion policy is being violated,
which is a contractual/business-rule breach, not a full outage. Escalate to
high if confirmed to affect more than one partner.

**Diagnose** (cheapest checks first):

1. Pull the affected member's `partnerId` and confirm their partner's
   *current* config — does `excludedCategories` actually contain `"cruise"`?
   Confirm against the source of truth before assuming the report is right.
2. Check whether the recommendation service is reading the partner's *live*
   config or a stale cached copy — compare the config's `lastUpdated`
   timestamp against when the exclusion was set.
3. Reproduce directly: call `get_recommendations` for that member and
   inspect the response *before* and *after* the rule-enforcement step, to
   see whether cruise offers are generated (expected) and then fail to be
   filtered (the bug), or aren't filtered at all (enforcement not invoked).
4. Check category-matching logic for a data mismatch — e.g. offer category
   stored as `"Cruise"` vs. config exclusion stored as `"cruise"`, a bad
   enum, or a partner-level exclusion not propagating to a specific tier.

**Confirm root cause:** isolate which of the above it is — stale cache,
skipped enforcement call, or a string/category mismatch — with the specific
evidence from steps 3–4.

**Resolve:**

- Stale cache → invalidate/refresh the partner config cache for that partner
  immediately.
- Enforcement not invoked/bypassed → hotfix the code path so rule
  enforcement is non-optional between generation and response.
- Category mismatch → normalize category strings at write-time and add
  validation so this can't drift again.

**Prevent recurrence:** add an automated test asserting no excluded category
ever appears in a response for a partner with that exclusion set; add
monitoring that flags any recommendation response containing a category
present in that member's partner's exclusion list, so this is caught before
a member reports it.

**Communicate:** notify the partner once root cause is confirmed (not
before), with the window of exposure and the fix.

### Part B2 — Required Reasoning Question

> _Answered without AI assistance, per the assessment instructions._

<!-- TODO: write this section yourself. -->

---

## Section C — AI Usage Log

_Draft below reflects the actual Claude session used to build this — reviewed
and to be finalized in your own words before submitting._

**1. Mapping the assessment itself.**

Asked Claude to lay out the full set of requirements (code artifact, README
sections A/B/C, video walkthrough) visually so nothing got lost across a long
back-and-forth. It produced a one-page visual map showing the three
deliverables in build order and flagging the "no AI" constraint on B2
separately. Kept as-is — used it for the rest of the session to track what
was still outstanding.

**2. Choosing how to expose the MCP server.**

Asked how to make `get_recommendations`/`get_member_profile` discoverable and
callable by an agent. Claude proposed `@modelcontextprotocol/sdk` with a
stateless `StreamableHTTPServerTransport` (a fresh transport per request, no
session tracking). Kept the SDK choice — official, well-supported, correctly
handles tool schema discovery. Flagged the statelessness as a limitation
worth revisiting rather than accepting it silently: fine for this POC's
single-call lookups, but would need reconsidering if a future agent flow
needed multi-turn context on the MCP connection itself.

**3. GitHub repo creation.**

Asked Claude to create the new GitHub repository directly. It hit a 403 —
the GitHub App connected to the session only had access to an unrelated
repo, not account-wide repo-creation rights. Rather than widening Claude's
GitHub access to push past that, I created the empty repo manually myself
and handed off just the name — kept Claude's access scoped to only what the
task actually needed, rather than solving a permissions error by granting
more permission than the task required.

**4. Code review before calling it done.**

Asked Claude to run a code-review pass against the finished service rather
than take "it works in my demo" as good enough. It surfaced two real issues
I hadn't caught: (1) the MCP endpoint reused one shared server object across
requests, and the SDK throws if that object is connected to a second
transport while still attached to a first — a race that could crash the
whole process under concurrent load, not just fail one request; (2)
`enforcePartnerRules` passed an unvalidated `recommendationCap` straight into
`Array.prototype.slice`, so a negative cap would silently keep every item
but the last instead of returning none — the opposite of what an invalid
cap should mean, in the one function this codebase designates as the sole
place partner rules are enforced. I didn't take either claim on faith: I
grepped the SDK's source to confirm the throw actually exists, then fired
10 truly concurrent requests at the running server to check the fix, before
committing anything. Kept both fixes as proposed — they were correct and
the reasoning checked out — but the verification step was mine, not the
AI's; a code-review tool's findings are still claims to check, not
conclusions to trust.
