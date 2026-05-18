#!/usr/bin/env bash
set -euo pipefail

REPO_NAME="${1:-mergify-demo-pokedex-$(date +%s)}"

# 1. Create repo from this template under the current gh user
gh repo create "$REPO_NAME" --template "$TEMPLATE_OWNER/mergify-demo-pokedex-template" --public --clone
cd "$REPO_NAME"

# 1a. Enable auto-delete of head branches. REQUIRED for Mergify Stacks:
# when the bottom PR of a stack merges and its branch is deleted, GitHub
# auto-retargets the upstack PRs to the merged-into branch. Without this,
# the queue stalls after the first merge and you must retarget by hand.
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

Repo created and cloned.
Auto-delete-head-branches enabled (required for stack retargeting).
Dependencies installed.
Mergify Stacks initialized (commit-msg + pre-push hooks active).
Browser opened to Mergify GitHub App install.

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
