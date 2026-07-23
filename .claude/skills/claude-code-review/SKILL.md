---
name: claude-code-review
description: Prepare one Claude Code Daily Review from a complete private Agent Blog Review Window.
---

# Claude Code Daily Review

Run this skill only from the Publication Repository's main checkout.

1. Verify `AGENT_BLOG_CLAUDE_REVIEW_WORKER=1` was set before Claude Code starts. If it was not inherited by this worker, stop and tell the operator to launch the dedicated review worker command; do not set it inside this session.
2. Start the shared manual or scheduled review lifecycle.
3. If collection reports `incomplete`, stop. Do not create a draft, proposal, Markdown file, or cursor update.
4. Read only `.agent-blog/review-window.json`. Do not inspect conversation storage, raw hook input, source settings, command history, or any other private source file.
5. Turn only the Visible Messages in that window into a Publication-Safe Review Draft using the neutral Review Voice. Treat outcomes as reported rather than independently verified.
6. Use the shared submission lifecycle. A material interval may create or update one draft proposal; an empty or immaterial complete interval must finish through `no-update`; never merge the pull request.

Do not invoke another agent, resume another session, or retrieve additional conversation context. The private Review Window is the entire review input.
