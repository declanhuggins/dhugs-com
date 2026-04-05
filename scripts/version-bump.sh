#!/usr/bin/env bash
# version-bump.sh — Bump version, update compat_date, commit & tag.
#
# Usage:
#   ./scripts/version-bump.sh [patch|minor|major]   (default: patch)
#
# What it does:
#   1. Bumps the version in package.json (via npm version --no-git-tag-version)
#   2. Sets compatibility_date in wrangler.jsonc to today's date
#   3. Commits all changes and creates a git tag
#
# NODE_VERSION is defined directly in wrangler.jsonc — edit it there when
# upgrading Node. The CI workflows read it from wrangler.jsonc automatically.

set -euo pipefail

BUMP="${1:-patch}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Validate bump type
if [[ "$BUMP" != "patch" && "$BUMP" != "minor" && "$BUMP" != "major" ]]; then
  echo "Usage: $0 [patch|minor|major]"
  exit 1
fi

# Ensure working tree is clean
if [[ -n "$(git status --porcelain)" ]]; then
  echo "Error: Working tree is dirty. Commit or stash changes first."
  exit 1
fi

# 1. Bump version in package.json (no git tag yet)
npm version "$BUMP" --no-git-tag-version > /dev/null
NEW_VERSION=$(node -p "require('./package.json').version")
echo "Version bumped to $NEW_VERSION"

# 2. Update compatibility_date to today
TODAY=$(date +%Y-%m-%d)
sed "s/\"compatibility_date\": \"[0-9-]*\"/\"compatibility_date\": \"$TODAY\"/" wrangler.jsonc > wrangler.jsonc.tmp
mv wrangler.jsonc.tmp wrangler.jsonc
echo "Compatibility date set to $TODAY"

# 3. Commit and tag
git add package.json wrangler.jsonc
git commit -m "$(cat <<EOF
v${NEW_VERSION}

- Bump version to ${NEW_VERSION} (${BUMP})
- Update compatibility_date to ${TODAY}
EOF
)"
git tag -a "v${NEW_VERSION}" -m "v${NEW_VERSION}"
echo ""
echo "Created commit and tag v${NEW_VERSION}"
echo "Run 'git push && git push --tags' to publish."
