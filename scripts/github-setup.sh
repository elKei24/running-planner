#!/usr/bin/env bash
# One-time repository settings for the PR + squash-merge + automatic release workflow.
# Needs the GitHub CLI (`gh auth login` first). Safe to re-run.
#
#   scripts/github-setup.sh [owner/repo]
set -euo pipefail

repo="${1:-$(gh repo view --json nameWithOwner -q .nameWithOwner)}"

echo "Merge settings for $repo: squash only, commit message from the PR title and description"
gh api -X PATCH "repos/$repo" \
  -F allow_merge_commit=false \
  -F allow_rebase_merge=false \
  -F allow_squash_merge=true \
  -f squash_merge_commit_title=PR_TITLE \
  -f squash_merge_commit_message=PR_BODY \
  -F delete_branch_on_merge=true \
  -F allow_update_branch=true >/dev/null

echo "Ruleset for main: changes only through squash-merged PRs with green checks"
ruleset='{
  "name": "main",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": false,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false,
        "allowed_merge_methods": ["squash"]
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": true,
        "required_status_checks": [
          { "context": "Typecheck, lint, test, build" },
          { "context": "Validate PR title" }
        ]
      }
    }
  ]
}'
existing="$(gh api "repos/$repo/rulesets" -q '.[] | select(.name == "main") | .id')"
if [ -n "$existing" ]; then
  gh api -X PUT "repos/$repo/rulesets/$existing" --input - <<<"$ruleset" >/dev/null
else
  gh api -X POST "repos/$repo/rulesets" --input - <<<"$ruleset" >/dev/null
fi

echo "Done. Also make sure Settings -> Pages -> Source is 'GitHub Actions'."
