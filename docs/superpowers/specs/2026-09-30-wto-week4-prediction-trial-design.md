# WTO Week 4 Prediction Trial — Design Specification

**Date:** September 30, 2026  
**Status:** Approved design; implementation pending  
**Scope:** Week 4, 2026 NFL regular season

## Purpose

WTO will estimate each game's winner, score, spread, and total from team evidence before comparing that independent projection with the betting market. Line movement and hype affect only the value assessment, never the underlying prediction. Week 4 predictions will be preserved before kickoff and graded during the following wrap-up.

## Principles

1. Prediction first; market comparison second.
2. Current evidence outweighs old history.
3. Backup quarterbacks are evaluated individually, never automatically downgraded.
4. Verified facts are separated from interpretation.
5. Missing evidence remains unavailable and is never invented.
6. Predictions and revisions are timestamped and immutable after kickoff.
7. Use only the existing Tuesday and Sunday workflows; create no additional scheduled run.
8. Predictions are informational, not guarantees or betting advice.

## Data artifact

Create `wto-game-insights-2026.json`, separate from the odds ledger. Each revision stores:

- season, week, game ID, kickoff, and teams
- generated_at, data_as_of, model_version, and sources
- projected winner, win probability, score, spread, and total
- current market favorite/spread/total, provider, and timestamp
- ATS lean, total lean, and hype/value classification
- confidence
- evidence supporting each team
- quarterback/injury, matchup, home-field, travel/weather, and coaching summaries
- primary prediction risk and unavailable fields

Tuesday is the immutable baseline. Sunday may append a revision for Sunday games only when a material input changes. Earlier revisions remain untouched.

## Analytical inputs

### Recent opponent-adjusted performance

Use the previous three completed games, weighting the newest most heavily:

- scoring and margin
- straight-up, ATS, and total performance
- offensive/defensive consistency and home/road splits
- opponent quality, quality of wins/losses, and common opponents
- repeatable performance versus unusual scoring events

Raw record and point differential are not used without opponent context.

### Quarterback and personnel

Evaluate the expected starter's efficiency, sacks, turnovers, mobility, pressure/blitz response, relevant system history, and supporting line/run game/receivers.

For a backup, also evaluate whether the start is planned or emergency, preparation time, offense familiarity, relevant career/recent starts, performance against comparable coverage and pressure profiles, opponent/coaching history, recency, and sample size. A backup may receive a positive, neutral, or negative adjustment. Store `insufficient_backup_qb_sample` when evidence is inadequate.

Use only verified injuries. Consider positional value, replacement quality, clustered injuries, offensive-line continuity, secondary/run-defense losses, returning players, snap restrictions, and whether the absence is already reflected in prior games or the market.

### Matchup fit

Evaluate pass offense/defense, rush offense/defense, protection/pressure, blitz response, man/zone fit when reliable, explosive plays, third downs, red zone, pace, expected possessions, and ability to play from ahead or behind.

### Sustainability and regression

Check turnover margin, fumble recovery, defensive/special-teams touchdowns, interception extremes, red-zone extremes, wins despite repeated efficiency deficits, and one-game blowouts unlikely to repeat.

### Home field, travel, and rest

Calculate contextual home advantage from crowd, venue familiarity, surface, dome/outdoor status, altitude, and visitor travel rather than assigning an automatic three points.

Evaluate east/west body-clock mismatch, early Eastern kickoffs for western teams, distance, consecutive road games, international travel, short weeks, overtime fatigue, byes, extended rest, and return from an international game. Travel is a modifier, not an automatic fade.

### Weather

Use verified wind/gusts, rain, snow, temperature, humidity, field/roof status, kicking conditions, and team-style fit. Early forecasts receive limited weight; game-day weather receives full weight. Wind is the strongest weather input for totals.

### Coaching, history, and special teams

Use coach-versus-coach, coach-versus-team, coordinator/system familiarity, divisional familiarity, and recent rivalry meetings as small modifiers only when samples remain relevant to current personnel.

Consider kicker reliability/range, returns, coverage, field position, and special-teams injuries. Lifetime rivalry history, revenge, trap-game, and must-win narratives remain context unless supported by current evidence.

## Influence hierarchy

- **Primary:** opponent-adjusted recent form, quarterback/personnel, matchup fit
- **Moderate:** verified injuries, rest, travel, home field, weather
- **Small:** regression, special teams, coaching history, divisional familiarity
- **Context only:** lifetime rivalry and public hype

Initial trial balance:

- 35% recent opponent-adjusted performance
- 20% quarterback and personnel
- 20% matchup fit
- 15% home/travel/rest/weather
- 5% regression and special teams
- 5% coaching and relevant recent history

These are calibration settings, not claims of universal accuracy.

## Market and hype check

After the independent projection, compare it with opening/current spread and total, movement, key numbers 3 and 7, verified injury explanations, post-blowout/national-TV reaction, and projection-to-market difference.

Initial labels:

- under 1 point: Fairly Valued
- 1 to under 2: Slight Value
- 2 to under 3: Meaningful Value
- 3 or more: Potentially Overvalued/Undervalued, requiring an evidence explanation
- incomplete evidence: Insufficient Evidence

Crossing 3 or 7 increases importance. Market movement never changes the independent projected score.

## Confidence

- **High:** stable quarterback, complete current inputs, verified injuries/weather, aligned evidence.
- **Medium:** core evidence exists but meaningful factors conflict.
- **Low:** limited sample, quarterback/injury uncertainty, early weather, missing inputs, or large disagreement.

Confidence represents evidence quality, not certainty.

## UI

Expand **WTO SMART LEAN** to show:

- win lean/probability and projected score
- WTO projected line versus current market spread
- ATS lean
- WTO projected total versus market total
- total lean
- Hype Check
- travel/weather, quarterback/injury, and home-field effects
- Evidence Balance for both teams
- primary risk, confidence, timestamp, and unavailable evidence

Use plain labels and never call Last Verified data Closing.

## Workflow

**Tuesday:** finalize prior week, capture new-week market, generate one baseline insight per game, preserve missing fields, and focus the app on the current week.

**Sunday:** refresh current markets, verified injuries, expected quarterbacks, travel effects, and game-day weather; append a revision only for material changes.

**Following Tuesday:** grade straight-up, ATS, total, projected-score error, and value classification. Preserve original predictions and use accumulated results only to calibrate future model versions.

## Validation

Before publishing:

- validate game, kickoff, and team identifiers
- validate favorite-perspective spread signs
- ensure predicted scores agree with projected margin and total
- derive ATS/total leans from projection-to-market differences
- prevent market inputs from entering the independent team rating
- reject unverified injury/weather claims
- enforce immutable revisions
- list unavailable inputs
- require source timestamps

## Week 4 success criteria

- All games receive a complete insight or explicit insufficient-evidence status.
- Every insight is explainable and timestamped.
- No market line is mislabeled.
- Backup quarterbacks are treated individually.
- Opponents, injuries, matchup fit, home field, travel/time zones, weather, rest, coaching, history, special teams, regression, and hype follow this specification.
- Tuesday baselines remain immutable.
- Week 4 outcomes can be graded without rewriting predictions.
- No new scheduled task is created.
