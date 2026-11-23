# WTO Phase 2D — verified postgame scoring

Phase 2C locked predictions are scored only after an external NFL final is confirmed. This phase is read-only: no predictor tuning, no MY PICKS changes, and no reconstructed picks.

## Verification gates
- Read the immutable pregame archive in archive/prospective/ and verify original SHA-256, fingerprint and exact path.
- Match a completed ESPN NFL scoreboard result by week, season and away/home teams; require the provider event ID.
- Mark unplayed games as pending_kickoff and games lacking confirmed finals as pending_verified_final.
- Reject duplicate matchup identities and provider fetch failures rather than inventing a result.

## Scored outputs
- Locked WTO winner versus final score (win/loss/push)
- Winner Brier score from the original pregame probability
- Archived pregame market favorite's winner result, for comparison
- Original confidence grades, separated by model version and confidence-policy ID; minimum 20-game descriptive sample gate.

**Unavailable:** model ATS and O/U scoring, because the locked prospective schema records pregame market lines but not a separate model-side spread/total pick. This phase never infers a model pick from a line.

## How it runs
Run node --test tests/wto-prospective-score.test.mjs and node scripts/wto-prospective-score.mjs. The scheduled workflow uploads outcomes.json and outcomes.md from reports/prospective-scoring/ as a 90-day artifact; it does not commit final scores into the immutable pregame archive.

The genuine weekly publisher export remains a separate outstanding upstream integration. Do not reuse a Week 11 prediction as a Week 12 prediction.

## Review gates
Verify event IDs and completed scores, missing-data behavior, duplicate protection, model-cohort separation and preservation of MY PICKS, the live engine, and historical archive values.
