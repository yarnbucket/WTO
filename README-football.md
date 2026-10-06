# WTO football features

## Expected vs. Actual

Conference and division INFO show the fixed ESPN Mike Clay September 9, 2026 preseason projected leader(s), current record leaders, games ahead of the next team, and a brief WTO interpretation. Tied records remain tied; official NFL tiebreaks are not applied. Results come only from final games in the 2026 ledger through the selected week. No later-week results are included.

The baseline is preserved in `wto-division-read.js`, separate from futures odds. Tuesday result repairs automatically refresh the comparison without another fetch or scheduled job. Sunday does not add a separate comparison collection.

Interpretation compares actual win percentage with projected season wins divided by 17: above/below by more than 15 percentage points is exceeding/falling behind; otherwise on track. Fewer than four completed games are labeled an early read. Scoring margin and opponents’ win percentage outside games against the featured team provide context; repeated opponents count once per matchup. These are descriptive indicators, not betting value or prediction adjustments.

Source: https://g.espncdn.com/s/ffldraftkit/26/NFLDK2026_CS_ClayProjections2026.pdf (September 9 baseline).
