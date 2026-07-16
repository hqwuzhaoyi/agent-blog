# Limit Git access to the publication repository

The OpenClaw host reuses existing Git and GitHub CLI authentication, but its write authority is limited to the Publication Repository. The Review Skill never reads or stores credential values, and setup stops when repository-scoped authentication cannot be verified, minimizing the impact of a compromised scheduled job.
