#!/usr/bin/env bash
# Build the two sites and rsync each to its server.
#
#   ./deploy.sh            build + deploy both
#   ./deploy.sh org        only www.qnamarkup.org (editor, docs, library)
#   ./deploy.sh net        only www.qnamarkup.net (viewer, document page)
#   DRY=1 ./deploy.sh      show what would change without copying
#
# Set the two destinations below (user@host:/path/to/document-root/).
set -euo pipefail
cd "$(dirname "$0")"

ORG_DEST="${ORG_DEST:-user@www.qnamarkup.org:/var/www/qnamarkup.org/html/}"
NET_DEST="${NET_DEST:-user@www.qnamarkup.net:/var/www/qnamarkup.net/html/}"

node build.js --site

RSYNC=(rsync -az --human-readable --itemize-changes --exclude '.DS_Store')
[ -n "${DRY:-}" ] && RSYNC+=(--dry-run)

what="${1:-both}"
if [ "$what" = org ] || [ "$what" = both ]; then
  echo "== www.qnamarkup.org  ->  $ORG_DEST"
  # --delete keeps the site tidy, but dist/ is protected so previously published
  # versions (dist/<version>/) stay online for pages that pin them.
  "${RSYNC[@]}" --delete --filter='P dist/*/' site/org/ "$ORG_DEST"
fi
if [ "$what" = net ] || [ "$what" = both ]; then
  echo "== www.qnamarkup.net  ->  $NET_DEST"
  "${RSYNC[@]}" --delete site/net/ "$NET_DEST"
fi
echo "done."
