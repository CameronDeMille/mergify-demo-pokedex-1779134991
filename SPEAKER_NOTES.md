# Speaker notes — Pokedex Pull-Stack (28 min + 10 Q&A)

One-screen cheat sheet. Keep open in a side tab during the talk.

## Pre-talk (Act 0)

- `bootstrap.sh` already run; new bootstrapped repo exists in your account.
- Mergify GitHub App installed and scoped to it.
- **Mergify Merge Queue product activated on the dashboard for this repo** (https://dashboard.mergify.com/queues/status). Per-repo manual step, not automatable.
- "Automatically delete head branches" verified ON in repo Settings → General. (Bootstrap sets this, but verify.)
- Pre-recorded Claude clip queued in a hidden browser tab.
- `demo-final` branch pushed.
- Three browser tabs ready: repo home / Actions / Mergify dashboard.
- Terminal at repo root, font size cranked.

## Act timings

| Act | Time | Cue |
|-----|------|-----|
| 1 — Frame the problem | **3 min** | repo home + open `.mergify.yml` (two-step) and `ci.yml` (job filter) |
| 2 — Claude makes the stack | **8 min** | paste Appendix A prompt; watch 3 PRs appear with `Depends-On:` and stack-map comments |
| 3 — The queue takes over | **13 min** | `@mergifyio queue` on PR3 (top) → PR1+PR2 batch → bisection → PR1 merges alone → fix PR2 → re-queue → PR2 merges → PR3 fix → merges |
| 4 — Close | **5 min** | recap + "also available" one-liners + README pointer + Q&A |

## Act 3 beat-by-beat (with batching + two-step + bisection)

1. **Stacks tour + queue (~1.5 min):**
   - Open PR3 → point at the auto-posted **stack map comment**.
   - Show `Depends-On:` lines in PR2 and PR3 bodies.
   - Terminal: `mergify stack list` (3 rows).
   - On PR3, comment: `@mergifyio queue`. *"One command. Watch."*

2. **Batch forms + bisection beat (~6 min)** — Mergify enqueues PR1 + PR2 (PR3 gated by typecheck plant), forms a single batched draft branch (`mergify/merge-queue/main/...`), runs Step 2 CI once.
   - **If the flake fires on `test_api`** (~30%): Mergify retries up to 2 times (`max_checks_retries: 2`). Usually clears.
   - **The lint plant fires deterministically** on the combined draft → batch fails → Mergify **bisects**. Creates smaller drafts to isolate the offender. Eventually merges PR1 alone, dequeues PR2.
   - In the terminal: `mergify queue status` shows the batched state, then `bisecting`. *"Watch this — Mergify isn't just dequeuing both. It's bisecting to find which PR is actually broken."*

3. **Fix-and-restack with persistence beat (~4 min)** — this is the showstopper.
   - **Before fixing**, post a review comment on `apps/api/src/routes/list.ts` line 1: *"unused import — remove."*
   - In editor: open `list.ts`, remove `type FavoriteRecord` from the import.
   - Terminal (on the original `feat/...` branch, not the generated `stack/...` branch):
     ```bash
     git commit -a --fixup=<PR2-sha>
     GIT_SEQUENCE_EDITOR=true git rebase -i --autosquash main
     mergify stack push
     ```
   - Switch back to GitHub PR2: **review comment still anchored to new SHA on line 1.** Pause, say it.
   - Re-queue: `@mergifyio queue` on PR3 (top). PR2 enters solo (PR1 already merged). Step 2 passes. PR2 squash-merges.

4. **PR3 lands (~2 min)** — *Usually* PR3 auto-retargets to `main` when PR2's stack branch is deleted. **If it doesn't (dry-run 4 saw this fail) you'll see PR3 still pointing at PR2's old branch:** run `gh pr edit 3 --base main` to fix. Then PR3's typecheck still fails (`ownerId` required, PR1's test fixtures missing it). *"git couldn't see it, the rebase did."* One-line fix in `packages/types/src/index.ts`: `ownerId?: string`. `git commit -a --amend --no-edit && mergify stack push && @mergifyio queue`. Step 2 passes. Merges.
   - End with `mergify stack list` → empty.

### "Is it a plant or a real bug?" (optional ~1 min beat)

If Claude generated a test that fails for a real reason (e.g. pagination assertion that doesn't match `data/pokemon.json` size), don't pretend it's the planted flake. Show the test output, read the actual assertion error, fix it inline, push. *"That's what the queue protects you from — if I had just hit merge, this would be on main."* This came up in dry-run 4 and recovered well.

## Two-step CI cheat sheet

- **Step 1** (every PR): `typecheck`, `build`. Gates **queue entry**.
- **Step 2** (merge-queue draft only): `lint`, `test_api`, `test_web`. Gates **final merge**.
- Step 2 jobs have `if: github.event_name == 'push' || startsWith(github.head_ref, 'mergify/merge-queue/')`. They skip on regular PR pushes (zero cost) and run on the batched draft (one cost for the whole batch).
- Plants fire where they're checked:
  - **PR1 flake** lives in `test_api` (Step 2) → fires inside batched run → triggers `max_checks_retries: 1`.
  - **PR2 lint plant** lives in `lint` (Step 2) → fires inside batched run → dequeues whole batch.
  - **PR3 typecheck plant** lives in `typecheck` (Step 1) → fires on PR3's source CI → gates PR3 out of the queue entirely.

## Bot commands

- `@mergifyio queue` — enqueue the whole stack from the top PR. **The Act 3 opener.** Bot reads `Depends-On:` chain and adds every eligible PR.
- `@mergifyio refresh` — nudge a stuck queue. **Free on all tiers.**
- `@mergifyio update` — **PAID FEATURE.** Don't use it.

Auto-queue via `pull_request_rules` was tried in dry-run 4 — schema-validates but doesn't fire on the free tier. Stick with the manual command. It's also a better demo beat.

## Recovery hotkeys (in priority order)

| Symptom | First try | If still stuck |
|---------|-----------|----------------|
| Claude refuses or stalls > 30s in Act 2 | hotkey to pre-recorded clip; narrate over it | resume Act 3 live from `demo-final` |
| Auto-queue doesn't pick up a PR | `@mergifyio refresh` on the PR | manual `@mergifyio queue` on top of stack |
| Mergify queue hangs after PR enters | `@mergifyio refresh` | switch to `demo-final` |
| PRs not recognised as stack | Claude pushed via `git push` instead of `mergify stack push` — run `mergify stack push` yourself | switch to `demo-final` |
| Top PR stalls at "🔜 Merge" after upstream merge | check repo's "Automatically delete head branches" is ON; if not, fix and rerun. Otherwise: `gh pr edit <N> --base main` → local rebase → `git push --force --no-verify` | switch to `demo-final` |
| `@mergifyio queue` rejected with "Merge Queue needs to be activated" | walk off-mic to https://dashboard.mergify.com/queues/status and flip the toggle | switch to `demo-final` |
| PR2 lint won't re-run after restack | `gh run rerun --failed <run-id>` | empty commit + push to retrigger |
| Flake on PR1 didn't fire and you wanted the retry beat | push an empty commit (`git commit --allow-empty -m "demo: nudge" && git push`) to retrigger Step 2 on the batch | skip the retry narration, move on |
| CI provider down / wifi dies | switch to `demo-final` immediately | no live demo path |

## `mergify stack push` recovery dance

`mergify stack push` only works from the **original** feature branch (e.g. `feat/pokedex-features`), not from the generated `stack/...` branches. If after a `git rebase --autosquash` you end up on a stack branch:

```bash
git checkout feat/pokedex-features   # your original branch
git reset --hard <amended-SHA>       # the HEAD from the rebase
mergify stack push                    # now it works
```

## Terminal commands worth typing live

```bash
mergify queue status   # show what's queued / batched
mergify stack list     # show open stack PRs
```

Both fit the terminal-first presentation. Type them out loud during Act 3 transitions.

## What NOT to do on stage

- Don't type `@mergifyio update` — paid feature, looks broken.
- Don't `git push --force` from a `stack/` branch without `--no-verify` — Mergify's pre-push hook blocks it.
- Don't open the Mergify dashboard more than once. One flip max (for the batched retry visual).
- Don't blame the planted flake for every test failure — if a deterministic test is failing, read the log. Dry-run 4 wasted ~7 minutes blaming the flake for a real bug in a pagination assertion.
