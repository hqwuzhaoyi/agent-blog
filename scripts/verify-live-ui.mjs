import deployment from "../src/site-origin.json" with { type: "json" };
/** Read-only deployment acceptance: SSR plus the actual browser resource URLs. */
import assert from 'node:assert/strict';
import { parseArgs } from 'node:util';
const { values } = parseArgs({ options: { origin: { type: 'string', default: deployment.origin } } });
const origin = new URL(values.origin).origin;
const checked = new Set();
for (const path of ['/', '/admin/']) {
  const page = await fetch(origin + path);
  assert.equal(page.status, 200, path);
  assert.match(page.headers.get('Content-Type') ?? '', /text\/html/);
  const html = await page.text();
  const resources = [...html.matchAll(/(?:src|href)="(\/assets\/[^"?]+)"/g)].map(match => match[1]);
  assert.ok(resources.some(url => url.endsWith('.css')), 'SSR must reference a stylesheet');
  assert.ok(resources.some(url => url.endsWith('.js')), 'SSR must reference the hydration runtime');
  for (const url of resources) {
    if (checked.has(url)) continue;
    const asset = await fetch(origin + url);
    assert.equal(asset.status, 200, 'Unreachable browser resource: ' + url);
    assert.match(asset.headers.get('Content-Type') ?? '', url.endsWith('.css') ? /text\/css/ : /(?:javascript|ecmascript)/, 'SSR response intercepted a static resource');
    checked.add(url);
  }
}
const session = await fetch(origin + '/admin/api/session');
assert.equal(session.status, 401, 'Unauthenticated reviewer session must remain protected');
console.log(JSON.stringify({status:'passed',origin,browserResources:checked.size,reviewerGuard:true,productionWrites:false}));
