# WTO football features

## Expected vs. Actual

Conference and division INFO show the fixed ESPN Mike Clay September 9, 2026 preseason projected leader(s), current record leaders, games ahead of the next team, and a brief WTO interpretation. Tied records remain tied; official NFL tiebreaks are not applied. Results come only from final games in the 2026 ledger through the selected week. No later-week results are included.

The baseline is preserved in `wto-division-read.js`, separate from futures odds. Tuesday result repairs automatically refresh the comparison without another fetch or scheduled job. Sunday does not add a separate comparison collection.

Interpretation compares actual win percentage with projected season wins divided by 17: above/below by more than 15 percentage points is exceeding/falling behind; otherwise on track. Fewer than four completed games are labeled an early read. Scoring margin and opponents’ win percentage outside games against the featured team provide context; repeated opponents count once per matchup. These are descriptive indicators, not betting value or prediction adjustments.

Source: https://g.espncdn.com/s/ffldraftkit/26/NFLDK2026_CS_ClayProjections2026.pdf (September 9 baseline).

## Shared matchup and picks

Week 5 onward uses one scheduled matchup card for projected score, confidence, winner probabilities, editable spread/total picks and Add to My Slip. WTO recommendations remain distinct from user selections. More Insight lazily opens matchup history, current-season form and verification sources. Missing archive meetings and unavailable betting lines are labeled explicitly. Completed-game recap and prediction-versus-outcome reviews remain separate. Tuesday/Sunday updates reuse the same saved evidence; this layout adds no collection task.

## My Pick Slip: personal tracker

MY PICK SLIP preserves each saved selection and its captured spread or total. Scheduled market updates must never replace those saved values. A user may explicitly edit and save a pick before kickoff; prior saved values remain in that pick's history. Picks lock at kickoff. Personal results are graded against the saved line, rather than the latest market line.

Saved picks are currently stored on the user's device in local storage. They are separate from the repository's shared odds ledger. Refreshing shared odds must not rewrite personal picks.

## Pick-slip comparison graphs (approved; implementation pending)

The approved comparison belongs inside MY PICK SLIP, with separate spread and total graphs. Each graph has four series:

| Series | Meaning |
| --- | --- |
| Your picks | The spread or total captured in the personal pick slip. |
| WTO projections | The recorded pregame projection used in the matchup graphs. |
| Market lines | The historical market reference recorded for that game, with its provider and timestamp. |
| Actual results | The final score margin for spread comparisons, or combined final points for total comparisons. |

Spread comparisons must use the same team perspective across all four series. Total comparisons use combined points. Missing picks, projections, market references, or final results remain blank; they must not be invented or replaced with later estimates.

Add completed prior-week games to these comparison graphs on Tuesday only, using the recorded matchup projection evidence and final results. Preserve the original picks, projections, and historical market references. Thursday and Sunday odds refreshes must not revise this personal comparison history. After several Tuesday reviews, the accumulated history provides the four comparison lines.

This graph design is an approved requirement, not a claim that the graphs have already been implemented. Reuse the Tuesday review workflow; no additional scheduled collection is required.

## Shared odds updates and immutable history

| Day | Work |
| --- | --- |
| Tuesday, 6 AM ET | Review completed games, prepare the new week's lines, and add completed prior-week evidence to the personal comparison when implemented. |
| Thursday, noon ET | Capture a new current-market odds snapshot for games that have not kicked off. |
| Sunday morning | Refresh remaining pregame odds and append a new snapshot. |

Keep these as three weekly checkpoints and reuse their existing evidence rather than adding separate comparison jobs.

In `ff26-nfl-lines-2026.json`, append each checkpoint to `market_snapshots`. Preserve Tuesday snapshots and all earlier opening, current, and closing records. A current-market snapshot must not be relabeled opening or closing unless the source explicitly identifies it that way.

Synchronize the game-level current odds and price fields with the latest verified snapshot so matchup cards display the updated market. Preserve the snapshot history independently. Record the provider, source URL, exact capture timestamp, favorite, favorite-perspective negative spread, total, and available side prices. Use null for unavailable prices; do not pair a price with a different point spread or total.

Repository commits and GitHub Pages deployment are separate steps. Verify the published data after deployment before reporting that updated matchup odds are live.
