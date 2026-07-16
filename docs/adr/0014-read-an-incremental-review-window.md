# Read an incremental review window

The first OpenClaw review considers only the previous 24 hours of Visible Messages, and subsequent runs advance saved cursors independently for each session. This bounds token usage and prevents duplicate or stale summaries, while leaving historical backfill outside the first version.
