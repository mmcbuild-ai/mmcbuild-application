#!/usr/bin/env bash
#
# sync-handover.sh — losslessly push local work to the MMC Build mirror.
#
# Model: this working copy (dennissolver side) is the dev source of truth.
# `handover` points at the mmcbuild-ai org repo, which Karthik may ALSO commit
# to. This script integrates his commits FIRST (rebase), then pushes — so
# nothing on either side is ever lost. It NEVER force-pushes.
#
#   mmcbuild-prod    -> handover = mmcbuild-ai/mmc-market
#   mmcbuild-shared  -> handover = mmcbuild-ai/mmc-shared
#
# Usage:  bash scripts/sync-handover.sh            # syncs handover/main
#         bash scripts/sync-handover.sh origin2 dev # custom remote/branch
#
# IMPORTANT — do NOT run this until the one-time reconciliation has happened
# (org `main` reset back to the last real commit). Until then the mirror tip
# still carries the 3 premature @mmcbuild-ai rename commits, and rebasing onto
# it would pull that broken state into this working copy. After reconciliation,
# this is your normal "push across" command.
#
# This script deliberately does NOT touch `origin` (the deploy source). Pushing
# the deploy is a separate, intentional step.

set -euo pipefail

REMOTE="${1:-handover}"
BRANCH="${2:-main}"

# Confirm the remote exists.
if ! git remote get-url "$REMOTE" >/dev/null 2>&1; then
  echo "ERROR: remote '$REMOTE' not configured in this repo. Run 'git remote -v'." >&2
  exit 2
fi

# Refuse to run with a dirty tree — uncommitted work + rebase = pain.
if [ -n "$(git status --porcelain)" ]; then
  echo "ERROR: working tree is dirty. Commit or stash before syncing." >&2
  git status --short >&2
  exit 2
fi

echo "Fetching $REMOTE/$BRANCH ..."
git fetch "$REMOTE" "$BRANCH"

behind=$(git rev-list --count "HEAD..${REMOTE}/${BRANCH}")
ahead=$(git rev-list --count "${REMOTE}/${BRANCH}..HEAD")
echo "Mirror has ${behind} commit(s) you don't have; you have ${ahead} commit(s) to send."

if [ "$behind" -gt 0 ]; then
  echo "Commits on the mirror that will be preserved:"
  git --no-pager log --oneline "HEAD..${REMOTE}/${BRANCH}"
  echo "Integrating them first (rebase) so none are lost ..."
  if ! git rebase "${REMOTE}/${BRANCH}"; then
    echo ""
    echo "CONFLICT: you and the mirror changed the same lines."
    echo "  1) resolve the files, 2) 'git add' them, 3) 'git rebase --continue',"
    echo "  4) re-run this script. Nothing was pushed — the mirror is untouched."
    exit 1
  fi
fi

if [ "$ahead" -eq 0 ] && [ "$behind" -eq 0 ]; then
  echo "Already in sync. Nothing to push."
  exit 0
fi

echo "Pushing to ${REMOTE}/${BRANCH} (fast-forward, never --force) ..."
git push "$REMOTE" "$BRANCH"
echo "Done. The mirror now has your work on top of everything that was already there."
