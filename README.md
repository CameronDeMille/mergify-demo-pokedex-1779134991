# Mergify Demo — Pokedex Pull-Stack

A self-contained, repeatable demo that shows Mergify's **merge queue** and **Stacks**
features in a single ~25–30 minute walkthrough. The stack is authored live by Claude
Code via the `mergify-stack` skill — that's the novel beat of the demo. Anyone with a
GitHub account and `gh`/`pnpm`/`uv` installed can clone, bootstrap, and run it
end-to-end against their own repo.

This is the template repo. Run `./bootstrap.sh` and you'll have your own working
copy with hooks installed and the Mergify GitHub App install page open in a browser
tab.

## What you'll learn

- **Merge queue** — how Mergify serializes merges against required CI, retries flaky
  jobs automatically, and keeps `main` green without humans babysitting auto-merge.
- **Stacks** — how to author a chain of dependent PRs (`mergify stack push`),
  enqueue the whole chain with one `@mergifyio queue` comment, and watch them land
  bottom-up.
- **AI agent + Stacks** — Claude Code with the `mergify-stack` skill produces the
  whole three-PR stack from a single prompt. The stack-aware skill is how the
  agent learns the `Change-Id` / `Depends-On` conventions.

## Prereqs

- [`gh`](https://cli.github.com) — GitHub CLI, logged in (`gh auth login`).
- [`pnpm`](https://pnpm.io) — package manager (Node 20+).
- [`uv`](https://docs.astral.sh/uv/) — used by `bootstrap.sh` to install `mergify-cli`.
- A GitHub account with permission to install the Mergify GitHub App on your own
  user namespace.
- [Claude Code](https://docs.claude.com/claude-code) or Cursor with the
  `mergify-stack` skill available. (Cursor users: same skill, different host.)

## One-line setup

```bash
curl -fsSL https://raw.githubusercontent.com/$TEMPLATE_OWNER/mergify-demo-pokedex-template/main/bootstrap.sh | bash
```

Or, if you've already cloned this template:

```bash
TEMPLATE_OWNER=<your-gh-handle> ./bootstrap.sh [optional-repo-name]
```

After the script runs you'll see a checklist. The manual steps it prints are:

1. Install the Mergify GitHub App in the browser tab that just opened and scope it
   to the new repo.
2. Verify the repo appears on [dashboard.mergify.com](https://dashboard.mergify.com).
3. **Check Settings → Rules → Rulesets and ensure there is NO ruleset of type
   `merge_queue` (GitHub's native merge queue) enabled on `main`.** Mergify's
   queue is mutually exclusive with GitHub's native merge queue. If one exists,
   either disable it or add Mergify as a bypass actor with mode `always`.
4. Open the repo in your editor.
5. In Claude Code: `/plugin install mergify-stack@mergify`.
6. You're ready.

## Walkthrough — Act 2: Claude Code makes the stack

Open Claude Code in the repo. Confirm the skill is installed with `/plugin list`.
Then paste this prompt verbatim:

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

The "do not fix / do not remove / do not make it optional" clauses are
load-bearing — they're how the planted failures survive Claude's clean-up instinct.

What to look for on the GitHub PRs page:

- Three PRs appear, titled by slice.
- Each PR body has a `Depends-On:` line linking it to its parent — that's how
  Mergify recognizes the stack.
- **Each PR has an auto-posted stack map comment** listing all three PRs with
  links. You didn't write it. Mergify posted it the moment `mergify stack push`
  ran. This is your "wow moment."

## Walkthrough — Act 3: the queue takes over

On GitHub, open the **top** PR of the stack (PR3) and post the comment:

```
@mergifyio queue
```

Mergify reads the `Depends-On:` markers and **enqueues all three PRs at once,
bottom-up**. From here you mostly narrate while the queue works.

Open a terminal to watch:

```bash
mergify queue status   # what's queued, in what order
mergify stack list     # which PRs are still in the stack
```

Three failures are planted across the stack. Each demonstrates a different
Mergify-flavoured recovery:

### Failure 1 — Flaky test on PR1

PR1 has a `Date.now()`-seeded test that fails ~30% of runs. When it fails in the
queue, Mergify dequeues PR1, recreates the draft PR, and retries (this is
`max_checks_retries: 1` in `.mergify.yml` doing the work). No human action.
Watch this once on the Mergify dashboard so the audience sees the retry visibly.
On retry, CI is green and PR1 squash-merges.

### Failure 2 — Lint error on PR2

PR2 has an unused import in `apps/api/src/routes/list.ts` that ESLint flags as
`error`. PR2 dequeues; PR3 cascades out (it depends on PR2).

Two beats here:

- **Comment-persistence beat.** Before fixing, navigate to the offending line in
  PR2's diff on GitHub. Leave a review comment ("unused import — remove"). Then
  fix the import, `git commit --amend`, `mergify stack push`. Switch back to
  GitHub: your review comment is still attached to the same line of the new
  commit, even though the SHA changed. Mergify keeps review threads alive
  across force-pushes.
- **Re-queue.** Comment `@mergifyio queue` on PR3 again. PR2 and PR3 re-enter
  the queue, bottom-up.

### Failure 3 — Semantic conflict on PR3

PR3 changes the `Pokemon` type in `packages/types` to require an `ownerId` field.
That doesn't conflict with PR2 in git's eyes — they touch different files. But
once PR2 merges and PR3 rebases on the new `main`, `apps/web/app/page.tsx`
(which PR2 added) builds `Pokemon[]` arrays without `ownerId`, and typecheck
fails on PR3.

**This is the conflict the audience cares about — git couldn't see it, but the
stack rebase did.** Fix: make `ownerId?: string` optional in `packages/types`.
`git commit --amend`, `mergify stack push`, `@mergifyio queue` on PR3 one more
time. CI green. PR3 squash-merges. Run `mergify stack list` — empty. The stack
is gone because it's all on `main`.

## Reset for the next demo

```bash
gh repo delete <your-repo-name> --yes
./bootstrap.sh
```

About 30 seconds. Bulletproof.

## Where to go next

- [Mergify queue docs](https://docs.mergify.com/queues/) — priority queues,
  parallel scopes, two-step CI gating.
- [Mergify Stacks docs](https://docs.mergify.com/stacks/) — the CLI workflow
  Claude is using under the hood.
- [Backports / Copy](https://docs.mergify.com/actions/copy/) — auto-create
  backport PRs to release branches.
- [CI Insights](https://docs.mergify.com/ci-insights/) — flaky-test analytics
  and slowest-test dashboards across your queue history.
- For teams with reviewers, add `#approved-reviews-by>=1` to `merge_conditions`
  in `.mergify.yml`.
- For teams that don't want to type `@mergifyio queue` on every PR, set
  `merge_protections_settings.auto_merge_conditions: true`. (Do not use the
  deprecated `autoqueue` key — it's removed mid-2026.)
