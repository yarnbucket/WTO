# WTO Phase 2B — connected source handoff

The GitHub workflow `.github/workflows/wto-prospective-capture.yml` now runs on incoming source changes, scheduled checks, or manual dispatch.

## Required upstream handoff
The weekly predictor/publisher must place an **original, timestamped, future** prediction archive at `incoming/wto-ex-weekNN-YYYYMMDD.json` **before kickoff**. This is an integration boundary: no automatic live predictor export currently exists in this repository, so the capture workflow cannot generate a prediction archive on its own.

The incoming archive uses the established WTO EX archive schema. It must contain `week`, `model_version`, and `games` with each game's `game_id`, `away`, `home`, `kickoff`, `projection_generated_at`, `projection_revision_id`, `market_as_of`, `projection.winner`, `projection.win_probability`, and `market.favorite`, `market.spread`, `market.total`.

The bridge grades original win probabilities **at publication time**, using `wto-prospective-probability-bands-v1`: A++ >=85%, A+ >=75%, A >=65%, otherwise UNRATED. These grades are prospective policy labels, not evidence of previously issued letter grades.

Run `node scripts/wto-publish-and-lock.mjs` or allow the workflow to run. Inspect the run artifact:
- `publisher-status.json`: incoming source count, published/locked count and rejected sources
- `published-*.json`: original source with the prospective policy grade
- `locked-*.json`: validated pregame snapshot and SHA-256
- `capture-status.json` and `source-readiness.json`: legacy archive diagnostics, which may still show zero eligible entries and are **not** the status of the new incoming bridge

Snapshots are preserved as run artifacts for 90 days; they are **not** committed as durable repository history. Long-term append-only retention needs a separate implementation. Scheduled GitHub Actions are best-effort and may run late, so the validator always checks actual time against kickoff.

Do not backfill prior games, invent original probabilities, or rewrite `index.html`, `wto-ex.js`, or MY PICKS.
