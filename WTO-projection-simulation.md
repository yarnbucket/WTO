# WTO projection simulation · Weeks 1–4

This retrospective simulation applies the current scoring model to earlier weeks. It is separate from forecasts actually saved before kickoff.

| Week | Simulated games | Winner hits / graded | Spread hits / graded | Total hits / graded | Avg. team scoring error |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 0 | — | — | — | — |
| 2 | 16 | 6 / 15 | 6 / 15 | 6 / 16 | 10.1 points |
| 3 | 16 | 7 / 13 | 7 / 16 | 5 / 16 | 9.2 points |
| 4 | 16 | 11 / 15 | 10 / 16 | 8 / 16 | 6.3 points |

The model came closer to team scores as more games became available. It projected too many points in Week 2: actual team scores averaged 4.4 points below projections. By Weeks 3 and 4, actual scores averaged about one point above projections. Winner and spread calls improved in Week 4, while total calls remained uneven. Three weeks are too few to show a reliable betting advantage.

Week 1 has no prior 2026 results and no verified preseason point baseline, so its 16 projections remain unavailable. All 32 teams have three simulated weekly scores in the accompanying JSON.

## How it was calculated

Each week uses final results from earlier weeks only; games from the target week are excluded. The existing opponent-adjusted-points-v2 model uses two pseudo-games of league-average scoring, a 0.5 opponent adjustment, and a 0.75-point home effect per team (zero at verified neutral venues). Scores round to whole points. Market lines do not generate projected scores. Directional spread and total comparisons use stored opening markets, with provider identity retained per game. Pushes and exactly neutral comparisons are not hits; projected ties do not count as successful winner calls.

Historical injuries, weather and player matchups were not reconstructed. This is a scoring-model study, not a claim that these picks were made before kickoff. The model settings were selected after these games, so this is not an untouched out-of-sample test. No win or betting probabilities were generated.

## Next step

Continue the existing weekly forecasts and record their misses. Treat the apparent scoring improvement as a pattern to watch. Make future adjustments only with supported evidence, then judge those changes against later games. This run makes no live-model adjustment and changes no official prediction or result.

Data: [WTO 2026 ledger](https://github.com/yarnbucket/WTO/blob/cbcc3415fa72bdcf90c8f3607e3f523d55f9fe70/ff26-nfl-lines-2026.json). Full calculations, input game IDs, market sources and team histories are stored in wto-projection-simulation-2026.json.
