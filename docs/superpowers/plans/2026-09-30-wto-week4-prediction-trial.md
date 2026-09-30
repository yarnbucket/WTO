# WTO Week 4 Prediction Trial Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the market-led Smart Lean with immutable, evidence-first Week 4 insights and an explainable value comparison.

**Architecture:** Store curated prediction revisions in a separate JSON artifact so the odds ledger remains the source of truth for markets and results. Validate projection arithmetic, market comparison, timestamps, and revision immutability with dependency-free Node scripts, then make the static PWA render the stored insight instead of calculating a prediction from the market line in the browser.

**Tech Stack:** Static HTML/CSS/JavaScript, JSON, Node.js built-in `node:test`, GitHub Pages/PWA service worker.

**Spec:** `docs/superpowers/specs/2026-09-30-wto-week4-prediction-trial-design.md`

## Global Constraints

- Week 4 is a trial; do not generalize beyond what the trial needs.
- Prediction inputs must be evaluated before market comparison.
- A backup quarterback may receive positive, neutral, or negative treatment; never apply an automatic downgrade.
- Preserve every Tuesday baseline and later revision; never rewrite a pre-kickoff prediction.
- Never label Last Verified data as Closing.
- Use only verified injuries, weather, and markets; unavailable inputs remain explicit.
- No new dependency, backend, scheduled task, or extra maintenance run.
- Tuesday creates the baseline; Sunday may append only a materially changed Sunday-game revision.
- UI language remains informational and includes the no-guarantee/no-betting-advice note.

## Review Focus

- A game with no stored insight must display Insufficient Evidence instead of falling back to the old market-derived formula.
- Pick'em, tied projected scores, and fractional spreads must produce consistent winner, margin, ATS, and value labels.
- A backup with favorable verified history must be allowed a neutral or positive quarterback effect.
- Early weather must not be presented as verified game-day weather.
- A Sunday revision must not replace or mutate the Tuesday baseline.

---

## File structure

- Create `wto-game-insights-2026.json`: immutable prediction revisions and later grades.
- Create `scripts/wto-insights-lib.mjs`: schema/arithmetic/value/immutability validation functions.
- Create `scripts/validate-wto-insights.mjs`: command-line validator.
- Create `tests/wto-insights.test.mjs`: dependency-free unit and fixture tests.
- Modify `index.html`: load and render stored insights; remove market-led prediction behavior.
- Modify `sw.js`: cache-version bump and offline availability for the insight artifact.
- Modify `docs/superpowers/specs/2026-09-30-wto-week4-prediction-trial-design.md` only if implementation exposes a contradiction; otherwise leave it immutable.

### Task 1: Define and validate the insight contract

**Files:**
- Create: `scripts/wto-insights-lib.mjs`
- Create: `scripts/validate-wto-insights.mjs`
- Create: `tests/wto-insights.test.mjs`
- Create: `wto-game-insights-2026.json`

**Interfaces:**
- Consumes: `ff26-nfl-lines-2026.json` game IDs, kickoffs, and current market fields.
- Produces: `validateInsightFile(file, ledger) -> { errors: string[], warnings: string[] }`, `validateRevision(revision, game) -> string[]`, and the JSON contract consumed by the UI.

- [ ] **Step 1: Write failing contract tests**

Add tests named:

- `accepts_valid_week4_tuesday_baseline`
- `rejects_score_margin_mismatch`
- `rejects_score_total_mismatch`
- `rejects_duplicate_revision_id`
- `rejects_revision_after_kickoff`
- `requires_unavailable_reason_for_missing_core_input`
- `permits_positive_backup_qb_effect`
- `rejects_game_day_weather_label_for_early_forecast`

Assert exact error codes such as `PROJECTED_MARGIN_MISMATCH`, `PROJECTED_TOTAL_MISMATCH`, and `DUPLICATE_REVISION_ID`.

- [ ] **Step 2: Run the tests and verify failure**

Run: `node --test tests/wto-insights.test.mjs`  
Expected: FAIL because the validation module and artifact do not exist.

- [ ] **Step 3: Implement the contract and validator**

Use this top-level JSON shape:

```json
{
  "schema_version": "1.0",
  "season": 2026,
  "model_version": "week4-trial-v1",
  "updated_at": "ISO-8601",
  "weeks": [
    {
      "week": 4,
      "status": "trial",
      "games": [
        {
          "game_id": "2026-W04-PIT-CLE",
          "revisions": []
        }
      ]
    }
  ]
}
```

Each revision must separate `independent_projection`, `market_comparison`, `factor_summary`, `confidence`, `sources`, and `unavailable_fields`. The independent projection contains no opening/current market spread or total. The market comparison contains provider and timestamp.

- [ ] **Step 4: Add the command-line entry point**

`scripts/validate-wto-insights.mjs` loads the insight artifact and ledger, prints one line per error, and exits 0 only when errors are empty.

- [ ] **Step 5: Run tests and validator**

Run:

```bash
node --test tests/wto-insights.test.mjs
node scripts/validate-wto-insights.mjs
```

Expected: all tests PASS; validator prints `0 errors`.

- [ ] **Step 6: Commit**

```bash
git add scripts/wto-insights-lib.mjs scripts/validate-wto-insights.mjs tests/wto-insights.test.mjs wto-game-insights-2026.json
git commit -m "feat: add WTO insight data contract"
```

### Task 2: Populate immutable Week 4 baseline insights

**Files:**
- Modify: `wto-game-insights-2026.json`
- Modify: `tests/wto-insights.test.mjs`

**Interfaces:**
- Consumes: validated Week 1-3 results, Week 4 Tuesday market, verified quarterback/injury/travel/weather context, and the contract from Task 1.
- Produces: one immutable `tuesday_baseline` revision or explicit `insufficient_evidence` revision for all 16 Week 4 games.

- [ ] **Step 1: Add failing completeness tests**

Add tests:

- `week4_contains_exactly_16_games`
- `every_game_has_tuesday_baseline_or_insufficient_evidence`
- `every_revision_has_source_timestamp`
- `market_fields_match_week4_ledger_snapshot`
- `independent_projection_does_not_copy_market_as_input`

- [ ] **Step 2: Run tests and verify failure**

Run: `node --test tests/wto-insights.test.mjs`  
Expected: FAIL because Week 4 revisions are empty.

- [ ] **Step 3: Research and populate Week 4 records**

For each game, store:

- previous-three-game opponent-adjusted evidence
- quarterback and verified injury effect
- matchup fit
- home-field effect
- travel/time-zone/rest effect
- forecast status and weather effect
- coaching/relevant-history effect
- special-teams/regression context
- projected scores, margin, total, winner, and probability
- current market comparison, ATS/total lean, hype label, confidence, primary risk, sources, and unavailable fields

Do not turn early weather into a game-day assertion. Do not infer an injury, scheme tendency, or coaching edge without a source.

- [ ] **Step 4: Run completeness and arithmetic checks**

Run:

```bash
node --test tests/wto-insights.test.mjs
node scripts/validate-wto-insights.mjs
```

Expected: all tests PASS; 16 games, 16 valid baseline/status revisions, 0 errors.

- [ ] **Step 5: Manually audit four edge cases**

Audit:

- one large favorite
- one short spread
- one east/west travel mismatch
- one quarterback/injury uncertainty

Expected: explanations match stored inputs and do not merely repeat market movement.

- [ ] **Step 6: Commit**

```bash
git add wto-game-insights-2026.json tests/wto-insights.test.mjs
git commit -m "data: add Week 4 WTO prediction baselines"
```

### Task 3: Replace browser market-led prediction with stored insight

**Files:**
- Modify: `index.html` at `loadJson()`, `predictionProfile()`, `wtoLean()`, `predictionHtml()`, and the WTO Smart Lean CSS block.
- Modify: `tests/wto-insights.test.mjs`

**Interfaces:**
- Consumes: `wto-game-insights-2026.json`.
- Produces: `latestPregameInsight(gameId, now) -> Revision | null` and `predictionHtml(game) -> string`.

- [ ] **Step 1: Add failing UI-source tests**

Add source-level fixture tests:

- `index_fetches_insight_artifact`
- `scheduled_game_uses_latest_pregame_revision`
- `missing_insight_renders_insufficient_evidence`
- `old_market_led_reason_copy_is_absent`
- `last_verified_is_not_rendered_as_closing`

- [ ] **Step 2: Run tests and verify failure**

Run: `node --test tests/wto-insights.test.mjs`  
Expected: FAIL because `index.html` does not fetch or render the artifact.

- [ ] **Step 3: Extend `loadJson()`**

Fetch the insight artifact alongside the season and player-leader artifacts with `cache: 'no-store'`. A failed insight fetch must not break schedules, odds, team views, or completed-game recaps.

- [ ] **Step 4: Replace `wtoLean()`**

Remove the calculation that starts with the market favorite/margin and line-movement edge. Resolve the latest stored pre-kickoff revision by game ID. Do not generate a prediction in the browser when the record is missing.

- [ ] **Step 5: Expand `predictionHtml()`**

Render:

- win lean/probability and projected score
- WTO projected line versus market spread
- ATS and total leans
- Hype Check
- quarterback/injury, home-field, and travel/weather effects
- Evidence Balance
- primary risk
- confidence, data timestamp, and unavailable evidence
- informational disclaimer

Use safe text escaping for all JSON-provided strings.

- [ ] **Step 6: Update styles without changing matchup layout**

Keep the existing green/black/gold visual language, mobile card width, and current score/line sections. Add compact rows and collapsible evidence only inside WTO Smart Lean.

- [ ] **Step 7: Run tests and mobile smoke check**

Run: `node --test tests/wto-insights.test.mjs`  
Then serve locally and inspect a narrow viewport for PIT-CLE and a game with insufficient evidence.

Expected: tests PASS; no horizontal overflow; the matchup card remains usable; absence of insight does not break the screen.

- [ ] **Step 8: Commit**

```bash
git add index.html tests/wto-insights.test.mjs
git commit -m "feat: render evidence-first WTO game insights"
```

### Task 4: Add Sunday revisions and immutability safeguards

**Files:**
- Modify: `scripts/wto-insights-lib.mjs`
- Modify: `tests/wto-insights.test.mjs`
- Modify: `wto-game-insights-2026.json` during Sunday maintenance only when inputs materially change.

**Interfaces:**
- Consumes: Tuesday baseline and proposed Sunday revision.
- Produces: `appendRevision(file, gameId, revision) -> InsightFile` that refuses mutation, duplicate IDs, non-material revisions, and post-kickoff predictions.

- [ ] **Step 1: Add failing revision tests**

Add tests:

- `preserves_tuesday_baseline_byte_for_byte`
- `rejects_non_material_sunday_revision`
- `accepts_verified_qb_status_change`
- `accepts_game_day_weather_change`
- `rejects_post_kickoff_revision`

- [ ] **Step 2: Run tests and verify failure**

Run: `node --test tests/wto-insights.test.mjs`  
Expected: FAIL because `appendRevision` does not exist.

- [ ] **Step 3: Implement immutable append**

A revision is material only if at least one of these changes: expected quarterback, key injury effect, game-day weather effect, projected margin by at least 1 point, projected total by at least 1 point, winner, ATS lean, total lean, hype label, or confidence.

- [ ] **Step 4: Run tests and validator**

Run:

```bash
node --test tests/wto-insights.test.mjs
node scripts/validate-wto-insights.mjs
```

Expected: all tests PASS; 0 errors.

- [ ] **Step 5: Commit**

```bash
git add scripts/wto-insights-lib.mjs tests/wto-insights.test.mjs
git commit -m "feat: preserve immutable WTO insight revisions"
```

### Task 5: PWA integration and trial grading

**Files:**
- Modify: `sw.js`
- Modify: `scripts/wto-insights-lib.mjs`
- Modify: `scripts/validate-wto-insights.mjs`
- Modify: `tests/wto-insights.test.mjs`
- Modify: `wto-game-insights-2026.json` after Week 4 finals.

**Interfaces:**
- Consumes: final scores and verified grading lines from `ff26-nfl-lines-2026.json`.
- Produces: `gradeRevision(revision, finalGame) -> Grade` with straight-up, ATS, total, score-error, and value-classification results.

- [ ] **Step 1: Add failing grading/PWA tests**

Add tests:

- `grades_straight_up_prediction`
- `grades_ats_with_verified_or_last_verified_line`
- `grades_total_push`
- `calculates_score_and_margin_error`
- `service_worker_caches_insight_artifact`
- `service_worker_cache_version_is_incremented`

- [ ] **Step 2: Run tests and verify failure**

Run: `node --test tests/wto-insights.test.mjs`  
Expected: FAIL because grading and cache changes do not exist.

- [ ] **Step 3: Implement grading**

Grade against a verified closing line when available; otherwise use the ledger's explicitly separated Last Verified grading fields. Preserve the original market comparison and store the grading line type used.

- [ ] **Step 4: Update service worker**

Increment `wto-shell-v9` to `wto-shell-v10`, add `./wto-game-insights-2026.json` to `SHELL`, and update the corresponding registration/reload version in `index.html`.

- [ ] **Step 5: Run the complete verification suite**

Run:

```bash
node --test tests/wto-insights.test.mjs
node scripts/validate-wto-insights.mjs
```

Expected: all tests PASS; validator prints 0 errors.

Perform a manual PWA smoke test:

- online load
- offline reload after one successful load
- insight JSON refresh after a changed revision
- no stale v9 service-worker shell

- [ ] **Step 6: Commit**

```bash
git add sw.js index.html scripts/wto-insights-lib.mjs scripts/validate-wto-insights.mjs tests/wto-insights.test.mjs wto-game-insights-2026.json
git commit -m "feat: complete Week 4 WTO insight trial"
```
