# Publish Morning Coffee automatically on Cloudflare

The Agent Operator approved automatic publication of Morning Coffee Episodes because requiring a daily PR merge prevents listening when waking up. Episodes pass measured-audio and publication checks, then publish directly through Cloudflare Workers and R2; ADR-0007's human approval gate continues to apply to Daily Reviews. Episode audio and published show notes are retained in R2 and restored for every deployment, while Git remains the source of application code and approved Daily Reviews.
