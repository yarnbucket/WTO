# Week 12 prospective handoff checklist

The Phase 2B workflow is ready to receive a **new** original weekly predictor export, but cannot create predictions or betting lines on its own. Do not populate this handoff from postgame results.

Place the next genuine export at `incoming/wto-ex-week12-YYYYMMDD.json` (or the existing repository-root naming convention), before the first included game's kickoff.

Required archive fields: `season:2026`, `week:12`, `model_version`, `games`.

Each game must contain:
- `game_id`, `away`, `home`, `kickoff` (offset-aware ISO timestamp)
- `projection_generated_at` and `projection_revision_id` from the original predictor
- `projection.winner` and `projection.win_probability` (0.5–1.0) from the original predictor
- `market_as_of`, `market.favorite`, `market.spread`, `market.total` from an archived pregame market observation

Never invent missing values or copy post-kickoff observations into pregame fields. Do not use an existing Week 11 archive as a Week 12 prediction.

When a new file is committed, the GitHub Actions capture workflow is triggered. It will:
1. Distinguish archives whose games have all kicked off (`historical`) from invalid future sources (`rejected`).
2. Grade genuine future source probabilities with the explicitly versioned prospective grade policy.
3. Validate and fingerprint eligible future snapshots.
4. Upload `publisher-status.json`, `published-*.json`, and `locked-*.json` as run artifacts (90-day retention).

This is not yet a live data provider integration. Actual upstream prediction export and durable append-only storage remain outstanding. Existing MY PICKS and live engine code must not be changed without separate approval.
