#!/usr/bin/env sh
# Run on a fresh release/vX.Y.Z branch (cut from develop) before its PR to
# main: removes everything production doesn't need, so main holds only what
# Coolify builds (docker-compose.yml + apps/api, apps/admin, apps/web, apps/portal) and the
# CI that checks it. develop keeps all of it; never merge develop into main
# directly, or these files come back.
set -e
cd "$(git rev-parse --show-toplevel)"

git rm -rq --ignore-unmatch -- \
  .claude .impeccable docs promo-video \
  CLAUDE.md DESIGN.md PRODUCT.md README.md .prettierrc.json tsconfig.base.json \
  .github/pull_request_template.md \
  apps/web/AGENTS.md apps/web/CLAUDE.md apps/web/scripts \
  apps/api/readme.md apps/admin/readme.md apps/web/readme.md apps/portal/readme.md

git rm -q -- .github/strip-for-release.sh
echo "Stripped. Review with: git status"
