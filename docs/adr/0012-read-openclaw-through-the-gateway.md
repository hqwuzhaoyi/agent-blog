# Read OpenClaw through the Gateway

The OpenClaw adapter runs on the Gateway host and reads sessions through upstream-supported Gateway interfaces instead of parsing transcript JSONL files. Default directories may help detect an installation, but the Gateway remains the state authority, reducing coupling to internal storage formats and deliberately excluding remote-Gateway collection from the first version.
