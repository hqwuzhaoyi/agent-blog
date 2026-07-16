# Make submissions publication-safe before Git

Privacy filtering runs locally before a Review Submission is committed or pushed, because later edits cannot reliably remove sensitive material from Git history. Secrets, personal identifiers, private paths and links, and customer-identifying information are removed; when safety is uncertain, the entire affected Work Highlight is omitted, with pull-request review serving only as a second defense.
