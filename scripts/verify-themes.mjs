#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
// Exercises the React presentation contract without changing the operator's site preferences.
const result = spawnSync('npx', ['vitest', 'run', 'test/theme-registry.test.ts'], { stdio: 'inherit' });
process.exitCode = result.status ?? 1;
