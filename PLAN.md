# Mergify Demo Plan — Pokedex Pull-Stack

A repeatable, shareable demo that walks engineers through Mergify's **merge queue** and **Stacks** features in a single 25–30 minute talk, using Claude Code to author a stacked PR set live.

---

## 1. Goals

- **Audience:** engineers (an adoption pitch — convince devs to use Mergify daily).
- **Outcome we want:** after the talk, a viewer can answer "what does Mergify give me that branch protection + auto-merge don't?" and can run the demo themselves.
- **Time:** 25–30 min talk + ~10 min Q&A.
- **Surface:** terminal + browser only. No slides.
- **Repeatability:** anyone can clone the template and run `bootstrap.sh` to spin up an identical demo in their own GitHub account.

## 2. Scope (what's in, what's out)

**In:**
- Merge queue with required CI checks (the flagship).
- Mergify Stacks (the CLI workflow shown in the docs page that triggered this demo).
- The Claude Code + Stacks skill integration (so the stack is produced live by an AI coding agent — this is the "novel beat" of the talk).
- One bot command moment (`@mergify rebase`).

**Out (mentioned only as "also available" in the close):**
- Backports / Copy.
- CI Insights / flaky test analytics dashboards.
- Priority queues, batched merging, advanced rule trees.
- Private-repo features.

## 3. The Demo Application

A **Pokedex viewer** with a favorites feature.

### 3.1 Repo layout (pnpm monorepo)

```
mergify-demo-pokedex/
  apps/
    api/         # Hono or Express, Vitest
    web/         # Next.js (app router), minimal styling
  packages/
    types/       # shared Pokemon + User types — the seat of the semantic conflict
  data/
    pokemon.json # bundled first-gen 151
  .github/
    workflows/ci.yml
  .mergify.yml
  bootstrap.sh
  README.md      # self-runner walkthrough
  package.json   # pnpm workspace root
  pnpm-workspace.yaml
```

### 3.2 Why these choices
- **Bundled JSON, not PokeAPI:** deterministic. Test failures are ones we plant, not network noise.
- **Backend + frontend:** richer surface for CI to gate; visually compelling. The semantic conflict between `apps/web` and `apps/api` via `packages/types` is the kind of bug stacked PRs make legible.
- **First-gen 151:** legible and small; no licensing concerns for a demo.

## 4. The Stack — three PRs

Each PR is a vertical slice. The stack is `PR1 ← PR2 ← PR3` (PR3 depends on PR2 depends on PR1).

| PR | Title | Touches | Planted Failure | Step |
|----|-------|---------|-----------------|------|
| **PR1** | Add Pokemon data model and API data layer | `packages/types`, `apps/api/src/data/*`, `apps/api/test/*` | **Flaky test** — a `Date.now()`-dependent test in `apps/api/test/sort.spec.ts` that fails ~30% of runs. Lives in `test_api`. Shows the batched-CI retry behaviour via `max_checks_retries: 1`. | Step 2 |
| **PR2** | Add paginated list endpoint and web list page | `apps/api/src/routes/list.ts`, `apps/web/app/page.tsx`, tests | **Lint error** — an unused `FavoriteRecord` import in `list.ts` that ESLint flags as `error`. With two-step CI, this does NOT fire on PR2's source CI (lint is gated to merge-queue branches) — it fires when PR2 is *inside a batched draft branch*, dequeuing the whole batch. Shows fix-and-restack + batching as the unit of validation. | Step 2 |
| **PR3** | Add favorites endpoint, auth middleware, and favorite button | `packages/types` (adds `ownerId` to `Pokemon`), `apps/api/src/middleware/auth.ts`, `apps/api/src/routes/favorites.ts`, `apps/web/components/FavoriteButton.tsx` | **Typecheck error from required field** — PR3 makes `ownerId: string` required. PR1's test fixtures construct `Pokemon` literals without it, so typecheck fails on PR3's *source* CI (it's stacked on top of PR1's content). Because typecheck is a Step 1 check, this **gates PR3 out of the queue** until you fix it — meaning PR3 is NOT batched with PR1/PR2 on the first pass. One-line fix: `ownerId?: string` in `packages/types`. Demonstrates that the same plant behaves differently depending on whether the failing check is in Step 1 or Step 2. | Step 1 |

### 4.1 Planted-failure details

**Flaky test (PR1):**
```ts
// apps/api/test/data.spec.ts — DEMO PLANT, do not "fix" it
it("sorts by id deterministically", () => {
  const seed = Date.now() % 10;
  expect(sortPokemon(samples, seed > 6 ? "asc" : "id")).toEqual(expected); // ~30% fail rate
});
```
Mergify queue retries on transient CI failure; we let it retry once on stage.

**Lint error (PR2):**
```ts
// apps/api/src/routes/list.ts
import { Pokemon, type FavoriteRecord } from "@pokedex/types"; // unused — eslint(no-unused-vars): error
```
Live fix: remove the import, `mergify stack push`, then `@mergify rebase` PR2 in the GitHub UI.

**Semantic conflict (PR3 after PR2 merges):**
- PR2 ships `apps/web/app/page.tsx` with `<li key={p.id}>{p.name}</li>`.
- PR3 adds `ownerId: string` as a *required* field on `Pokemon` in `packages/types`.
- Once PR2 merges and PR3 rebases, `packages/types/index.ts` now demands `ownerId` everywhere; `apps/web/app/page.tsx` builds a `Pokemon[]` array from the API response without that field → typecheck fails on PR3.
- Fix: make `ownerId` optional, or filter it server-side. One-line change, but the audience sees that **the conflict wasn't visible until the stack rebased**.

## 5. CI workflow — two-step

`.github/workflows/ci.yml` runs in **two steps**:

**Step 1** — every PR push. Fast, cheap. Gates queue entry.

| Job | What it runs | What it gates |
|-----|--------------|---------------|
| `typecheck` | `pnpm typecheck` | Catches the semantic conflict on PR3 (source CI) before it can enter the queue. |
| `build` | `pnpm -r build` | Production build of both apps. Fast on warm cache. |

**Step 2** — only on `mergify/merge-queue/*` draft branches (gated by `if: startsWith(github.head_ref, 'mergify/merge-queue/')`) and `push` to `main`. Slow / strict. Gates the final merge.

| Job | What it runs | What it gates |
|-----|--------------|---------------|
| `lint` | `pnpm lint` | Catches the planted unused-import on PR2. Now fires on the batched draft, not on PR2's source CI. |
| `test_api` | `pnpm --filter api test` | Where the planted flaky test lives. Fires inside the batched run; `max_checks_retries: 2` self-heals. |
| `test_web` | `pnpm --filter web test` | Smoke test for the page. |

Step 2's branch filter is what enables real two-step behaviour. Regular PR pushes pay only Step 1's cost; Mergify pays Step 2 once per batch on the draft branch it creates.

## 6. Mergify config (`.mergify.yml`)

Minimum viable interesting config. Walks in ~90 seconds.

```yaml
queue_rules:
  - name: default
    max_checks_retries: 2
    batch_size: 5
    batch_max_wait_time: 30 s
    queue_conditions:
      - check-success=typecheck
      - check-success=build
    merge_conditions:
      - check-success=lint
      - check-success=test_api
      - check-success=test_web
    merge_method: squash
```

**Activation is via `@mergifyio queue`** on the top PR of the stack. The bot reads `Depends-On:` markers and enqueues every PR in the chain whose `queue_conditions` are satisfied. Tried `pull_request_rules` with an auto-queue `actions: queue` block in dry-run 4 — schema-validates and Mergify acknowledges the PR is queue-eligible, but the auto-queue never fires on this free tier. Manual `@mergifyio queue` is the supported path; keep it.

**Batching is load-bearing.** With Step 2 gated behind the merge-queue branch filter, source PRs can't fail `lint`/`test_api`/`test_web` (those jobs are skipped). All PRs that pass Step 1 enter the queue together, Mergify forms a single batched draft branch, and Step 2 runs *once* against the combined content. The planted lint failure on PR2 fires inside the batched run.

**Bisection on batch failure (headline beat).** When the batched draft fails Step 2, Mergify doesn't just dequeue everything — it *bisects* by creating smaller drafts to isolate which PR is the actual offender. Dry-run 4 saw this happen: PR1+PR2 batched, lint failed on the combined draft, Mergify ran a bisection round, identified PR2 as the bad PR, **merged PR1 alone, kicked PR2 out.** That's queue intelligence the audience cares about. Tied to `batch_size > 1` — without batching, no bisection.

**Retry budget tuning.** `max_checks_retries: 2` (3 total attempts) chosen after dry-run 4 saw the planted `Date.now() % 10 > 6` flake (30% failure rate) exhaust a `: 1` budget repeatedly. 2 retries gives a ~2.7% chance of all attempts failing on the flake, low enough that the demo doesn't get stuck. For production, tune to your fastest flake rate.

**Note on approvals:** approval requirement was intentionally dropped (solo personal account; no second reviewer). The queue only waits on CI green. In the close, mention that adding `#approved-reviews-by>=1` is a one-line change for teams with reviewers.

**Compatibility gotcha:** GitHub's *native* merge queue ruleset (rule type `merge_queue`) is mutually exclusive with Mergify's queue — if it's enabled on the target branch and Mergify isn't a bypass actor, GitHub blocks Mergify from merging. The bootstrap checklist includes verifying this is off.

## 7. Demo runbook

Total: ~28 minutes live + ~10 min Q&A.

### Act 0 — Setup (off-stage, before the talk)
- `bootstrap.sh` already run; repo `mergify-demo-pokedex` exists in your personal account.
- Mergify GitHub App installed and scoped to that repo.
- Pre-recorded fallback clip queued in a hidden tab.
- `demo-final` branch already pushed with the completed stack merged (full backstop).
- A terminal open in the repo root. A browser with three tabs: repo home, Actions, and Mergify dashboard.

### Act 1 — Frame the problem (3 min)
- Open the repo on GitHub. Show `main` is clean.
- Say: *"I'm going to add a feature — paginated Pokemon list with a favorites button. The lazy version is one giant PR. The right version is three small ones. Watch."*
- Show the `.mergify.yml` and `ci.yml` in your editor. ~30 seconds each. Frame: "this is the entire Mergify surface for today's demo."

### Act 2 — Claude Code makes a stack (8 min, LIVE)
- Open Claude Code in the repo. Confirm the `mergify-stack` skill is installed (`/plugin list`).
- Paste the demo prompt (see Appendix A). It instructs Claude to plan a 3-PR stack matching the table in §4 and execute it.
- Claude reads code, makes 3 commits each with a `Change-Id`, runs `mergify stack push`.
- 3 PRs appear on GitHub, linked top-to-bottom. **This is the wow moment.**
- *Fallback:* if Claude stalls or refuses, hotkey to the pre-recorded clip and narrate over it.

### Act 3 — The queue takes over (13 min)

**Opening beat — the stacks tour (~1 min).** Open PR3 on GitHub. Point at the **stack map comment Mergify auto-posted** — it lists all three PRs with links and shows where this one sits in the chain. Same comment on PR1 and PR2. *"You didn't write this. Mergify did, the moment the stack was pushed."* Walk through the `Depends-On:` lines at the bottom of PR2 and PR3 bodies. In your terminal: `mergify stack list`. Three rows.

**The magic moment (~30 sec):**

> *"One PR-per-PR queueing is annoying. Watch this."*

Type `@mergifyio queue` as a comment on **PR3** (top of stack). Submit.

Mergify reads the `Depends-On:` chain and enqueues every PR in the stack whose `queue_conditions` are met. **PR1 and PR2 both enter the queue immediately. PR3 is held back by its planted typecheck failure** (queue_condition `check-success=typecheck` not satisfied). With `batch_size: 5`, Mergify merges PR1 and PR2 into a **single batched draft branch** (`mergify/merge-queue/main/...`) and runs Step 2 CI once against the combined content. **This is the headline batching beat — narrate it.**

1. **The batch fails, Mergify bisects (~6 min).** Step 2 on the batched draft fails — the lint plant in PR2 catches the unused `FavoriteRecord` import. Mergify retries (`max_checks_retries: 2`), the lint plant is deterministic so the retry also fails. **Now Mergify bisects:** it creates a smaller draft containing only PR1, runs Step 2 again — PR1 alone passes. Mergify **merges PR1** and **kicks PR2 out of the queue**. *"That's why we batch. Half the team's work shipped while we investigate the other half."* Tab to a terminal: `mergify queue status` shows the bisection state in real time.

2. **Fix-and-restack with persistence beat (~4 min).**

   - **Comment-persistence setup (~30 sec):** Before fixing, navigate to PR2's `apps/api/src/routes/list.ts` line 1 in Files Changed. Leave a review comment: *"unused import — remove."* This anchors the comment to this SHA.
   - **Fix-and-restack (~2 min):** In your editor, remove `type FavoriteRecord` from the import. From the original feature branch (not the generated `stack/` branch — see SPEAKER_NOTES), `git commit -a --fixup=<PR2-sha>`, `GIT_SEQUENCE_EDITOR=true git rebase -i --autosquash main`, `mergify stack push`. The stack republishes with new SHAs.
   - **Persistence reveal (~30 sec):** Switch back to GitHub PR2 → Files Changed. **Your review comment is still attached to line 1 of the new commit.** *"That's Mergify keeping review threads alive across the force-push."*
   - **Re-queue (~1 min):** Comment `@mergifyio queue` on PR3 (top) again. PR2 enters the queue solo this time (PR1 is already merged; PR3 still blocked). Step 2 passes on the draft. **PR2 squash-merges.**

3. **PR3 lands (~2 min).** PR3 was held back by typecheck. After PR2 merges, GitHub *usually* auto-retargets PR3's base from PR2's stack branch to `main` (requires repo setting "Automatically delete head branches" — bootstrap enables it). **In dry-run 4 this didn't fire and required a manual `gh pr edit 3 --base main` — be ready for either path.** PR3's source typecheck still fails — show the diff: `ownerId: string` is required in `packages/types` but PR1's test fixtures construct `Pokemon` literals without it. **"git couldn't see it; the stack rebase did."** One-line fix in `packages/types/src/index.ts`: `ownerId?: string`. `git commit -a --amend --no-edit`, `mergify stack push`, `@mergifyio queue` on PR3. PR3's source CI passes Step 1, enters queue, Step 2 passes, merges.

Run `mergify stack list` in the terminal — empty. The stack is gone because it's all on `main`.

### Optional Act-3 sub-beat: the "is it a plant or a real bug?" moment

If during a dry-run the agent generates a test that fails for a real (not planted) reason — e.g. a pagination assertion that doesn't match the size of `data/pokemon.json` — that's actually a teaching opportunity. *"The queue isn't psychic; it just gates on CI. When CI fails, you read the log."* `max_checks_retries` is your friend for flakes, but it can't save a deterministic bug — that's what bisection + the dequeue exist for. Dry-run 4 surfaced exactly this with PR2's pagination test asserting `body.total > 10` when the fixture had 10 entries. The Appendix A test-guidance clause was added afterwards to prevent it.

### Act 4 — Close (5 min)
- Tab to `main`: all three features shipped, history is three squash commits.
- Recap: *"What did Mergify do? Serialized merges so we never broke main. Auto-retried a flake. Auto-rebased the stack as each PR landed. Kept review comments attached across a force-push. Surfaced a semantic conflict at the right moment. And a coding agent produced the whole stack via a one-line skill install."*
- **Mention what was deliberately not shown** (one-liner each, in case anyone asks):
  - **Auto-merge:** `merge_protections_settings.auto_merge_conditions` for teams that don't want to type `@mergifyio queue`.
  - **Approvals:** add `#approved-reviews-by>=1` to `merge_conditions` for teams with reviewers.
  - **Two-step CI:** split fast checks into `queue_conditions` and slow ones into `merge_conditions` to cut CI bill.
  - **Parallel scopes:** for monorepos where PRs touch independent services — `mode: parallel` plus a `scopes:` block.
  - **Priority queues:** a second queue with `queue_conditions: [label = urgent]` for hotfixes that jump the line.
  - **Browser extension:** Chrome/Firefox toolbar with a one-click queue button on the GitHub PR page.
  - **Backports, CI Insights, private-repo features:** point at `docs.mergify.com`.
- Show the README: *"This whole demo is a template repo. Run `./bootstrap.sh` in your own account and you've got it."*
- Q&A.

## 8. Fallback plan

| Failure mode | Recovery |
|--------------|----------|
| Claude refuses or stalls > 30s in Act 2 | Hotkey to pre-recorded "Claude makes the stack" clip (~3 min, screen-captured + sped up). Narrate over it. Resume Act 3 live. |
| Mergify queue hangs / doesn't pick up a PR | Comment `@mergifyio refresh` on the PR. If still stuck after 60s, comment `@mergifyio queue` again on the top PR. If still stuck, switch to `demo-final` branch and walk through the already-merged state, narrating "here's what would have happened." |
| Mergify says the PRs aren't recognized as a stack (no `Depends-On:` markers) | Caused by Claude pushing via `git push` instead of `mergify stack push`. Run `mergify stack push` yourself in the terminal to re-publish. If that fails, switch to `demo-final`. |
| CI provider down (GitHub Actions outage) | Switch to `demo-final`. Run nothing live. |
| Network/wifi dies | Have a phone hotspot ready. If still down, switch to `demo-final` (it has the full history on disk, you can show locally). |

The `demo-final` branch is the universal backstop: it has the three squash commits already on `main` and the merged PR pages still viewable in the GitHub UI.

## 9. Bootstrap script — what `bootstrap.sh` does

```bash
#!/usr/bin/env bash
set -euo pipefail

REPO_NAME="${1:-mergify-demo-pokedex-$(date +%s)}"

# 1. Create repo from this template under the current gh user
gh repo create "$REPO_NAME" --template "$TEMPLATE_OWNER/mergify-demo-pokedex-template" --public --clone
cd "$REPO_NAME"

# 1a. Enable auto-delete of head branches. REQUIRED for Mergify Stacks:
# when the bottom PR of a stack merges and its branch is deleted, GitHub
# auto-retargets the upstack PRs to the merged-into branch. Without this,
# the queue stalls after the first merge and you have to retarget by hand.
gh repo edit --delete-branch-on-merge

# 2. Install deps
pnpm install

# 3. Install Mergify CLI if missing, then init stacks
command -v mergify >/dev/null || uv tool install mergify-cli
mergify stack setup

# 4. Open Mergify GitHub App install page (manual click required)
open "https://github.com/apps/mergify/installations/new" 2>/dev/null || xdg-open "https://github.com/apps/mergify/installations/new"

# 5. Print the remaining manual checklist
cat <<'EOF'

✓ Repo created and cloned.
✓ Auto-delete-head-branches enabled (required for stack retargeting).
✓ Dependencies installed.
✓ Mergify Stacks initialized (commit-msg + pre-push hooks active).
✓ Browser opened to Mergify GitHub App install.

NEXT (manual steps):
  1. In the browser tab that just opened, install the Mergify GitHub App
     and scope it to this new repo.
  2. Verify on https://dashboard.mergify.com that the repo appears.
  3. Activate the Merge Queue product for THIS repo on the Mergify
     dashboard. Per-repo activation is manual and required:
       https://dashboard.mergify.com/queues/status
     Without it, @mergifyio queue is rejected with
     "Merge Queue needs to be activated".
  4. Check Settings > Rules > Rulesets: make sure NO ruleset of type
     "merge_queue" (GitHub's native merge queue) is enabled on `main`.
     If one exists, disable it or add Mergify as a bypass actor with
     "always" mode. Otherwise Mergify cannot merge.
  5. Open the repo in your editor: code .
  6. Open Claude Code in the repo: /plugin install mergify-stack@mergify
  7. You're ready. See README.md for the demo walkthrough.

EOF
```

## 10. Self-runner `README.md` (outline, ~200 lines)

Sections, in order:

1. **What this is** (one paragraph + a screenshot of the final `main` history).
2. **What you'll learn** (3 bullets: queue, stacks, AI-agent + stacks integration).
3. **Prereqs** (gh CLI, pnpm, uv, a GitHub account, Claude Code or Cursor).
4. **One-line setup:** `curl -fsSL https://raw.githubusercontent.com/.../bootstrap.sh | bash`. Plus the manual steps the script prints.
5. **Walkthrough — Act 2:** "Now ask Claude Code to build the stack" (the prompt from Appendix A goes here verbatim). What to look for on the GitHub PRs page — especially the auto-posted stack map comment.
6. **Walkthrough — Act 3:** "Comment `@mergifyio queue` on the top PR (PR3). The whole stack enqueues bottom-up. Open a terminal and run `mergify queue status` and `mergify stack list` to see what's happening." Walk through each planted failure and the fix-and-restack flow. Mirror the runbook beats with screenshots.
7. **Reset for next demo:** `gh repo delete --yes && ./bootstrap.sh`.
8. **Where to go next:** links to Mergify docs sections on backports, priority queues, Insights.

## 11. Build TODOs

Numbered so a future session (Claude Code or you) can pick this up and ship it.

1. **Create the template repo.** `gh repo create mergify-demo-pokedex-template --public --template-flag`. Initial commit: empty pnpm monorepo skeleton.
2. **Scaffold `apps/api`** with Hono + Vitest. Single GET /pokemon endpoint returning bundled data.
3. **Scaffold `apps/web`** with Next.js app router. Single page that fetches from the api at build time.
4. **Scaffold `packages/types`** with a single `Pokemon` interface (no `ownerId` yet — that's PR3's plant).
5. **Drop in `data/pokemon.json`** (first-gen 151; trim from PokeAPI once, commit static).
6. **Write `.github/workflows/ci.yml`** with the five parallel jobs from §5.
7. **Write `.mergify.yml`** from §6. Include `max_checks_retries: 1`. Do NOT include a `pull_request_rules` auto-queue block or `auto_merge_conditions`. Do NOT use the deprecated `autoqueue` key.
8. **Write the planted-failure-free baseline** so `main` is green on its own. The plants only appear *in the stack PRs Claude creates*, not in the template.
9. **Write `bootstrap.sh`** per §9.
10. **Write `README.md`** per §10.
11. **Record the fallback clip:** run the demo end-to-end at least twice; capture the Claude-Code-makes-a-stack segment on the second run.
12. **Create the `demo-final` branch:** run the demo successfully once, then `git checkout -b demo-final && git push`. This branch has the finished history.
12a. **Setup-time check:** verify the template repo has NO `merge_queue` GitHub ruleset on `main`. Document this in the README's "first run" section.
13. **Dry-run the talk twice end-to-end** with a timer. Adjust the runbook timing.
14. **Write speaker notes** as a short cheat sheet (filename: `SPEAKER_NOTES.md` — one screen, just the act timings and the recovery hotkeys).

---

## Appendix A — The Claude Code prompt (live agent moment)

This is the prompt pasted into Claude Code on stage in Act 2. It assumes the `mergify-stack` skill is already installed.

```
You're working in a pnpm monorepo: apps/api (Hono), apps/web (Next.js),
packages/types. The repo currently exposes GET /pokemon returning bundled
first-gen 151 data.

Add three features as a STACKED set of pull requests, using the Mergify
Stacks workflow you have a skill for. Each PR must be independently
reviewable. Use `mergify stack push` to publish.

Stack contents (top of stack = PR3, bottom = PR1):

PR1: Pokemon data model + API data layer + tests.
  - Add Pokemon type to packages/types.
  - Add a data-loading layer in apps/api/src/data/ with a sort helper.
  - Cover with Vitest. Include this exact test verbatim — do not modify
    or "fix" it; it's intentional:

      it("sorts by id deterministically", () => {
        const seed = Date.now() % 10;
        expect(sortPokemon(samples, seed > 6 ? "asc" : "id")).toEqual(expected);
      });

PR2: Paginated list endpoint + web list page.
  - Add GET /pokemon?page=&pageSize= to apps/api.
  - Render the list at apps/web/app/page.tsx with a "next page" link.
  - In apps/api/src/routes/list.ts, include this exact import line verbatim;
    do not remove it:

      import { Pokemon, type FavoriteRecord } from "@pokedex/types";

  - CRITICAL: Do NOT reference `FavoriteRecord` anywhere else in
    apps/api/src/routes/list.ts. The import MUST remain unused (only
    `Pokemon` is allowed to be referenced) so ESLint's `no-unused-vars`
    rule flags `FavoriteRecord` as an error. Do not export, type-alias,
    add to a response shape, or otherwise touch `FavoriteRecord` to
    satisfy any code-smell instinct. The unused import is the point.

  - Test guidance: data/pokemon.json contains a small fixed set of entries
    (~34). When writing pagination tests, DO NOT assume a specific total
    count or `hasNext` value beyond what the fixture actually contains.
    Read data/pokemon.json before writing assertions; use relative checks
    like `expect(body.total).toBe(data.length)` instead of `> 10`.

PR3: Favorites endpoint + auth middleware + web favorite button.
  - Add `ownerId: string` as a REQUIRED field on the Pokemon type in
    packages/types. Do not make it optional.
  - Add a minimal bearer-token auth middleware in apps/api.
  - Add POST /favorites (auth-required) and GET /favorites/:userId.
  - Add a <FavoriteButton/> component in apps/web that calls POST /favorites.

Constraints:
- Each PR must build on its own once its parent is merged. The intentional
  plants above are demonstrations of real-world failure modes; leave them in.
- Use conventional commits.
- Title each PR clearly so a reviewer knows the slice.
- After pushing, comment back with the three PR URLs.
```

The "do not fix" / "do not remove" / "do not make it optional" clauses are load-bearing — they're how we keep the planted failures in despite Claude's instinct to clean up.

---

## 12. Dry-run findings (run 1 — 2026-05-18)

First end-to-end dry-run surfaced eight issues. Five were template bugs and are
fixed in-place; three are runbook/narrative issues you should resolve before the
recorded run.

| # | Finding | Status | Resolution |
|---|---------|--------|------------|
| 1 | GitHub Actions rejects job IDs containing colons (`test:api`, `test:web`). Every CI run on the original template failed instantly with "workflow file issue" — no jobs scheduled. | **Fixed** | Renamed jobs to `test_api` / `test_web` in `.github/workflows/ci.yml` and matched the `check-success=` names in `.mergify.yml`. PLAN.md §5 + §6 updated in place. |
| 2 | `pnpm/action-setup@v4` errors when both `version:` is set in the workflow AND `packageManager` is set in `package.json`. | **Fixed** | Dropped the `version:` input from the workflow — the action reads from `packageManager` (the canonical source). |
| 3 | PR2 plant collapsed: Claude kept the prescribed unused import verbatim *and* referenced `FavoriteRecord` in a `ListResponse` type alias, which made the import "used" so ESLint stopped flagging it. Net effect: the lint-error demo beat became a typecheck-error beat against an unresolvable type. | **Fixed** | Appendix A's PR2 instructions now include an explicit anti-cleverness clause forbidding any other reference to `FavoriteRecord` in `list.ts`. Second dry-run confirmed the plant fires correctly. |
| 4 | After the bottom PR merges, GitHub doesn't auto-retarget upstack PRs to `main` unless **Settings → General → Pull Requests → "Automatically delete head branches"** is enabled on the repo. Mergify Stacks relies on this native GitHub behaviour and does *not* perform the retarget itself. Without it, the top PR enters the queue, sees "Checks skipped — PR is already up-to-date", says "🔜 Merge", and stalls indefinitely. Recovery requires `gh pr edit <N> --base main`, a local rebase, and a force-push with `--no-verify` (Mergify's pre-push hook blocks otherwise). | **Fixed** | `bootstrap.sh` now runs `gh repo edit --delete-branch-on-merge` immediately after `gh repo create`. Future bootstraps won't hit this. Source: [articles.mergify.com — Handle your Stacked Pull Requests with a Merge Queue](https://articles.mergify.com/handle-your-stacked-pull-request-with-a-merge-queue/). |
| 5 | `@mergifyio update` is gated behind the paid "Workflow Automation" product. Comment is rejected with "needs to be activated to enable this feature." | **Documented** | Use `@mergifyio refresh` instead (free on all tiers). §8 fallback table calls this out implicitly; consider adding an explicit "free vs paid commands" note in SPEAKER_NOTES. |
| 6 | The PR3 semantic-conflict plant did NOT fire. Claude propagated the new required `ownerId` field through PR2's `apps/web/app/page.tsx` slice preemptively (since PR3 is stacked on top of PR2, the agent sees the inconsistency immediately and fixes it). After PR2 merged and PR3 rebased onto new `main`, typecheck still passed. | **Open** | Two options: (a) harden the prompt — forbid PR3 from touching any file PR2 touched (likely brittle, may need multiple rounds of testing); (b) **pivot the runbook** — drop the PR3 semantic-conflict beat and replace it with the natural "type-export-not-yet-defined" failure mode that the first run produced (`FavoriteRecord` doesn't exist in PR2's view of `@pokedex/types` until PR3 lands). The pivot is simpler and the failure is more visually concrete in the build log. **Recommend (b).** |
| 7 | PR1 flake fires correctly but only ~30% of runs, by design. In this dry-run it rolled safe on the initial CI but fired post-rebase on PR3, demonstrating the retry behaviour late in the demo rather than at the head of the queue. | Acceptable | On stage, if PR1's first CI passes, push an empty commit (`git commit --allow-empty -m "demo: nudge"`) to re-trigger CI and re-roll the flake. |
| 8 | `mergify stack push` only works from the **original** feature branch (e.g. `feat/pokedex-v2`), not from the generated `stack/...` branches. Recovery dance after `git rebase --autosquash`: `git checkout <orig> && git reset --hard <amended-SHA> && mergify stack push`. | **Documented** | Going into SPEAKER_NOTES.md as a recovery cheat-sheet entry. |

### What worked rock-solid

- `@mergifyio queue` on the top PR enqueued all three bottom-up, exactly as
  the docs describe.
- PR1 squash-merge, automatic queue progression to PR2.
- PR2 lint plant fired, was fixed locally via `git rebase -i --autosquash`,
  republished with `mergify stack push`. **The review comment posted on
  PR2's `list.ts` line 1 persisted across the force-push, re-anchored to the
  new SHA, and stayed un-outdated.** This is the headline persistence beat
  from §7 Act 3 and it works flawlessly.
- Re-queue with `@mergifyio queue` on the top PR after the PR2 fix — Mergify
  picked up where it left off.

### Action items before recorded run

1. Re-run the template build end-to-end against finding #4's fix (the
   `delete_branch_on_merge` repo flag) to confirm the queue auto-completes
   without manual retarget.
2. Make the runbook decision on finding #6 and update §4 + §7 accordingly.
3. Then record the fallback clip (§11 #11) and create `demo-final` (§11 #12).

## 12a. Dry-run findings (run 2 — 2026-05-18, post-fix verification)

Second end-to-end run executed against the patched template. Outcome:

- **Finding #4 confirmed fixed.** PR #3 auto-retargeted from PR #2's stack
  branch to `main` the instant PR #2's stack branch was deleted on squash
  merge. Zero manual `gh pr edit` required.
- **Finding #3 fix held up.** PR #2's `FavoriteRecord` import remained
  unused in `list.ts`; ESLint flagged it as expected on the first CI run.
- **Finding #6 path (b) materialized.** PR #3 typecheck failed on rebase
  because PR #1's `apps/api/test/sort.spec.ts` fixtures construct `Pokemon`
  literals without `ownerId`. The one-line fix in `packages/types`
  (`ownerId?: string`) unblocked the rebase. Demo beat works as designed.
- **All three PRs squash-merged into `main`** with no manual recovery beyond
  the planned fix-and-restack moments. `demo-final` branch pushed from this
  state at `5c49c524` (the PR #3 merge sha).

### Post-run change requested

- Added `batch_size: 5` and `batch_max_wait_time: 30 s` to the queue rule.
  Rationale: a batch size of 1 doesn't teach anything useful to an
  audience evaluating Mergify for production. With stacks, this collapses
  the post-fix re-queue into a single batched CI run that lands both PR2
  and PR3 together — also tighter on stage. **Not yet dry-run-validated**
  with this setting; add a third dry-run before recording.

## 12b. Dry-run findings (run 3 — 2026-05-18, with batching active)

Third end-to-end run executed against the template with `batch_size: 5`.

- **Finding #9 (new):** Mergify's **Merge Queue product is activated
  per-repo on the dashboard**, not at GitHub App install. Fresh bootstrap
  repos reject `@mergifyio queue` with *"⚠ The product Merge Queue needs
  to be activated to enable this feature."* until the user opens
  `https://dashboard.mergify.com/queues/status` and toggles it on. Cannot
  be automated via API. Updated `bootstrap.sh` checklist and PLAN.md §9 to
  prompt this step before Act 2 begins. SPEAKER_NOTES.md gets a recovery
  entry: if `@mergifyio queue` is rejected with that message, walk
  off-mic to the dashboard and flip the toggle.

- **Batching observation:** with both planted failures in place (PR2 lint
  + PR3 typecheck), `batch_size: 5` does NOT collapse merges. Each PR is
  blocked by its own queue_conditions, so each enters the batch alone.
  Three sequential merges, same beat count as `batch_size: 1`.

  **What batching does buy:** if a future iteration removes the per-PR
  failures, or in production with multiple independent PRs queued
  simultaneously, the batched CI run is the win. For the demo, narrate it
  in Act 4 close as *"and as a bonus, that single CI run actually handles
  up to 5 batched PRs — production teams shave their CI bill in half this
  way."* Don't promise an observable Act 3 batching beat with the current
  plant set.

- **Everything else worked.** PR #3 auto-retargeted to `main` after PR #2
  merged (finding #4 fix still solid). Review comment persisted across
  force-push (3rd consecutive confirmation). PR #3 semantic conflict
  fired in `sort.spec.ts`, fixed by one-line `ownerId?: string`.

### Action items before recording

1. Activate Merge Queue dashboard toggle on the actual demo repo well in
   advance (don't do it as part of Act 0).
2. Decide whether to keep the existing `mergify-demo-pokedex-1779123614`
   (with its `demo-final` branch) as the talk repo, or do one more
   fresh bootstrap on talk day. The talk-repo decision affects the
   `bootstrap.sh` reset-for-next-demo loop in §11 README walkthrough.
3. Record the fallback clip (§11 #11) — capture Act 2 only on a fresh
   bootstrap with all manual steps pre-done.
4. Timed run (§11 #13) — stopwatch through Acts 1–4 twice.

## 12c. Dry-run findings (run 4 — 2026-05-18, with two-step CI + batching)

Fourth end-to-end run executed against the redesigned two-step architecture
(Step 1 = `typecheck`/`build` on every PR, Step 2 = `lint`/`test_api`/
`test_web` gated to merge-queue branches). Five new findings, five fixes
applied to the template.

| # | Finding | Status | Resolution |
|---|---------|--------|------------|
| 10 | `pull_request_rules` auto-queue **does not fire** on the Mergify free tier. The block schema-validates and Mergify shows the PR as queue-eligible ("Merge queue is ready"), but no draft branch is ever created. Manual `@mergifyio queue` works fine. | **Fixed** | Removed the `pull_request_rules` block from `.mergify.yml`. Restored the manual `@mergifyio queue` opener in §7 Act 3. The trade-off goes the other way: keep the bot-command beat. |
| 11 | **Mergify bisection on batch failure (positive finding).** When a batched draft fails Step 2, Mergify automatically creates smaller drafts to isolate the offending PR. Dry-run 4 saw a PR1+PR2 batch fail on lint, Mergify bisected, merged PR1 alone, dequeued PR2. **Worth a dedicated narration beat** — it's not just an optimization, it's queue intelligence. | **Adopted** | Rewrote §7 Act 3 step 1 to make bisection the headline beat. Added one-liner to §6 framing. |
| 12 | The agent generated a pagination test asserting `body.total > 10` against `data/pokemon.json` which had only 10 entries. **Deterministic failure that looked exactly like the planted flake** for three batched cycles before I diagnosed (1m 30s + 3m 16s + 2m 23s wasted CI). Real-life pattern: tests that assume more data than fixtures contain. | **Fixed** | (a) Expanded `data/pokemon.json` to 34 entries (real first-gen subset, big enough that `pageSize: 10` always has a next page). (b) Added a test-guidance clause in Appendix A telling Claude to read `data/pokemon.json` before writing pagination assertions. (c) Added §7 Act 3 "is it a plant or a real bug?" sub-beat so the talk can absorb a similar surprise live. |
| 13 | `max_checks_retries: 1` (2 attempts total) is too thin for the planted flake at ~30% per roll. Six consecutive bad rolls across three dry-run-4 cycles. Statistically unlikely but it happened. | **Fixed** | Bumped to `max_checks_retries: 2` (3 attempts; ~2.7% chance of all failing). |
| 14 | GitHub's auto-retarget on stack-branch delete (the finding-#4 fix) **did not fire** when PR2 merged in dry-run 4 — PR3's base remained pointing at PR2's now-deleted branch. Worked in dry-run 2 + 3. Cause unknown; possibly intermittent or related to PR3's failing source CI at merge time. Manual `gh pr edit 3 --base main` recovered. | **Documented** | Added a SPEAKER_NOTES line and an "in dry-run 4 this didn't fire — be ready" note in §7 Act 3 step 3. Not a blocker; the manual recovery is one command. |

### What worked rock-solid in dry-run 4

- Two-step CI structure: source PRs paid Step 1 cost only; Step 2 ran exactly
  once per batched draft as designed.
- `@mergifyio queue` on PR3 enqueued PR1 + PR2 in one go (PR3 gated by
  typecheck plant).
- Batching formed correctly (`waiting_for_batch` → `preparing` → `running`).
- **Bisection ran without prompting** when the batch failed.
- Review-comment persistence across force-push: 4-for-4 across all dry runs.
- After fix-and-restack, `mergify stack push` cleanly re-published PR2 + PR3.
- Final main history is exactly three squash commits in dependency order.

---

## Decisions log (for future-you)

| Decision | Choice | Reason |
|----------|--------|--------|
| Audience | Engineers — adoption pitch | Drives hands-on, technical tone. |
| Scope | Queue + Stacks (agents/backports skipped) | Matches the docs page that triggered this; novel + flagship together. |
| Time | 25–30 min + 10 min Q&A | Both features need ~8 min each; rest is framing. |
| App | Pokedex viewer + favorites | Universally legible; favorites justifies auth in PR3. |
| Data | Bundled JSON, 151 first-gen | Deterministic CI; no network in tests. |
| Repo | pnpm monorepo (api, web, types) | Shared types is the seat of the semantic conflict. |
| Approval rule | Dropped | Solo personal account; mention as a one-line add in the close. |
| Bot command beat | `@mergifyio queue` used 3+ times naturally (initial enqueue + 2 re-queues after fixes) | Replaces the original "one `@mergify rebase`" idea — the queue command is the canonical Mergify UX and re-queueing after a failure is the natural beat. |
| Presentation | Terminal + browser, no slides | Adoption pitch; demo is the meat. |
| Fallback | Pre-recorded Claude clip + `demo-final` branch | Two backstops, no full troubleshooting doc. |
| Hosting | Personal GitHub, public repo, Mergify free tier | $0; mention enterprise tier exists. |
| Reset | `bootstrap.sh` deletes + recreates from template | ~30s per reset; bulletproof. |
| Stack activation | Manual `@mergifyio queue` on top PR (single command enqueues whole stack bottom-up) | Per Mergify Stacks docs; this is the headline beat — one command, three PRs land in order. Auto-queue config (`auto_merge_conditions`) intentionally omitted so this stays a deliberate, observable action. |
| Flake handling | `max_checks_retries: 1` in queue rule | Makes the queue-retry story automatic and visible on stage — no manual `@mergifyio queue` after the flake. |
| Monitoring during demo | CLI-first (`mergify queue status`, `mergify stack list`) + one dashboard browser flip | Fits the "terminal + browser, no slides" presentation. Dashboard appears once to show the visual retry. |
| GitHub native merge queue | Must be OFF on the demo repo | Mergify's queue is mutually exclusive with GitHub's `merge_queue` ruleset unless Mergify is a bypass actor. Verified in bootstrap checklist. |
