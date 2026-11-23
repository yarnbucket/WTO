# WTO Phase 2E — automatic original-prediction handoff

**Status:** End-to-end handoff wiring and producer packaging added; pending first authentic newly published weekly model output on main. This is an automation bridge, **not** an independent prediction generator.

## Producer → receiver → archive

1. An upstream WTO prediction publisher produces and commits a genuine pregame source named wto-ex-weekNN-YYYYMMDD.json at the repository root on main. It must contain original model_version, generated_at, game prediction revision IDs and timestamps, actual win probabilities, and original market evidence. It must be committed **before kickoff**. The producer itself remains external to this repository; no function here invents its predictions.
2. GitHub Actions workflow `.github/workflows/wto-weekly-prediction-publisher.yml` automatically detects the newly changed original file (one per run), validates it, and packages the unchanged bytes into an artifact named `wto-original-predictions-<run_id>`. A manifest includes source filename, producer run ID and SHA-256 digest. The source file is not rewritten.
3. The existing Phase 2B workflow listens for **completed successful runs** of exactly `WTO weekly predictor publisher`. It checks the upstream job is from this repository's default branch, downloads the artifact with GitHub Actions read permission, validates the manifest/run ID/digest/source, and writes an ephemeral `incoming/` file with exclusive-create semantics.
4. The existing Phase 2B processing verifies prospective predictions, assigns explicitly versioned **publication-time** confidence labels, and locks one snapshot per eligible future game; the existing Phase 2C step proposes immutable snapshot records for human review. The existing Phase 2D job later scores verified finals.
5. Only the reviewable archive PR, not the ephemeral `incoming/` file, is permanent. Receipt `reports/prospective/phase2e-handoff.json` is uploaded in run artifacts (90-day retention).

**No manual copy into incoming/ is needed when the original weekly producer has committed its source file.** However, the original prediction producer still needs to generate and commit future files; the current repository does **not** generate an entire next week's predictions on its own. Do not mistake a successful empty scheduled capture for an actual end-to-end original prediction delivery.

## Source validation

- Original source timestamp and per-game projection/market timestamps must be offset-aware, no later than the receiver time and strictly earlier than kickoff.
- The source season/week, filename and unique game IDs must match. Teams, model version, winner, original probability (0.5–1), original revision and original market favorite/spread/total are mandatory.
- Historical games in a mixed source remain historical and are excluded; at least one genuinely future game is required to accept a new handoff.
- The artifact SHA-256 must match the source bytes; duplicate same-byte receives are idempotent; conflicting source files fail closed. The receiver never fabricates original grades or rewrites original predictions.
- The receiver uses no on-device tokens, no client-side secrets, and never reads or writes MY PICKS or localStorage.

## Trigger and deployment

The producer workflow is triggered by a GitHub push that modifies exactly one root wto-ex-week*.json file. A manual workflow_dispatch is provided for recovery **only for a source already present in the repository**; no manual export is required in normal operation. If several weekly files change in one commit, the packager fails rather than silently ignoring any.

Workflow_run delivery begins after these workflow files are merged to the default branch. The first real future publisher run should be reviewed for successful 2E receipt, successful 2B lock, and a Phase 2C archive PR. Keep GitHub Actions permission to create PRs enabled in repository Settings → Actions → General, or archive PR creation will still need manual intervention.

For a producer-side integration from another automated job, reuse `node scripts/wto-phase2e-package.mjs <original-prediction-file> <github-run-id> <empty-output-dir>`, then upload the exact output directory as an artifact named `wto-original-predictions-<github-run-id>` in the trusted producer workflow. Do not create a new prediction merely to exercise this bridge.

## Validation

`node --test tests/wto-phase2e-handoff.test.mjs` tests metadata, source preservation, duplicate conflicts, invalid market/projection timestamps, source digest, safe filenames, and packager/receiver interoperation. The Phase 2B workflow runs it alongside all prior capture tests.

**Unverified until the next authentic source:** actual GitHub workflow_run artifact delivery, production PR creation for a newly generated weekly archive, and the future model's complete game coverage. Successful branch tests cannot substitute for this proof.
