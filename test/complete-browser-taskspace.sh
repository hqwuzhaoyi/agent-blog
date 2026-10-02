#!/usr/bin/env bash
set -euo pipefail
# Dedicated final heredoc. Invoke only after successful prior suite output.
ego-browser nodejs <<'EGO'
cliLog(await completeTaskSpace(process.env.EGO_TASKSPACE || 'gitlog domain and player', { keep: false }));
EGO
