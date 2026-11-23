# WTO Phase 2B — prospective confidence tracking

Status: **capture validator implemented; future game capture not yet wired to a production scheduler.**

## Purpose
Preserve the original pre-kickoff winner, win probability, confidence grade, model version, revision ID, kickoff, projection timestamp, market timestamp, favorite, spread and total. Do not derive confidence grades from final scores.

## Source contract
Supply a JSON object with `schema_version: 1`, `season`, `week`, `captured_at`, `model_version` and a nonempty `games` array. Each game must include `game_id`, `away`, `home`, `kickoff`, `projection_generated_at`, `projection_revision_id`, `market_as_of`, `projection: {winner, win_probability, confidence_grade}`, and `market: {favorite, spread, total}`. All timestamps must include a UTC offset and precede kickoff. Use original model-generated grades; never infer them from probabilities unless the live engine actually generated and locked those grades pregame.

## Capture procedure
1. Export the actual pregame source, with its original grades, to a JSON file before kickoff.
2. Run `node scripts/wto-prospective-snapshot.mjs source.json reports/wto-prospective-week12-2026.json`.
3. Preserve the output as a versioned GitHub artifact or committed snapshot. The script uses exclusive-create (`wx`) and refuses to overwrite an existing snapshot. Record its SHA-256.
4. After verified final scores are available, build a **separate** results/calibration report. Never mutate the locked source.

## Limitations and gates
- This validator does **not** automatically collect forecasts or grades, modify `wto-ex.js`, or update MY PICKS.
- Missing or late grades fail validation. Missing data should remain unavailable.
- A locked file in an ephemeral runner is not durable until published as an artifact or committed to an append-only history.
- A source file edited before running the validator is not independently proven authentic; publication timestamps and source revision history provide additional evidence.
- Before calibration by A++/A+/A, verify the live predictor really emits those grades and document their definition. Keep model versions separate.
