# Make review generation idempotent

The pair of Agent Source and Review Day uniquely identifies a Review Draft. Retrying a failed run updates the same Markdown file and pull request, and per-session cursors advance only after the draft is pushed successfully, preventing duplicate reviews and skipped messages.
