#!/usr/bin/env bash
set -euo pipefail
ego-browser nodejs <<'EGO'
const assert = (await import('node:assert/strict')).default;
await useOrCreateTaskSpace(process.env.EGO_TASKSPACE || 'episode navigation');
const origin = process.env.REACT_PREVIEW_URL || 'http://localhost:3100';
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname));
const until = async predicate => {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) { if (await predicate()) return; await wait(.1); }
  assert.fail('Episode navigation did not settle');
};
await openOrReuseTab(origin + '/episodes/2026-10-02', { wait: true, timeout: 30 });
await gotoAndWait(origin + '/episodes/2026-10-02', { timeout: 30 });
await until(() => js('Object.keys(document.querySelector("[aria-label=播客播放器] button") || {}).some(k => k.startsWith("__reactProps"))'));
await click('[aria-label=播客播放器] button');
await until(() => js('!document.querySelector("audio").paused && document.querySelector("audio").readyState >= 1'));
await js('window.navigationAudio=document.querySelector("audio"); navigationAudio.loop=true');
const hashes = ['#shownotes', '#episode-materials-title'];
assert.deepEqual(await js('[...document.querySelectorAll("nav[aria-label=本期导航] a")].map(a=>a.hash)'), hashes);
for (const width of [320, 390, 1440]) {
  await cdp('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
  await wait(.2);
  for (const hash of hashes) {
    const selector = 'nav[aria-label=本期导航] a[href="' + hash + '"]';
    // The mobile directory scrolls with the page; reveal it before clicking.
    await js('document.querySelector(' + JSON.stringify(selector) + ').scrollIntoView({block:"center"})');
    await click(selector);
    await until(() => js('location.hash === ' + JSON.stringify(hash)));
    const result = await js(`(()=>{
      const target = document.querySelector(${JSON.stringify(hash)}).getBoundingClientRect();
      const nav = document.querySelector('nav[aria-label=本期导航]').getBoundingClientRect();
      return { targetTop: target.top, overlap: target.left < nav.right && target.right > nav.left && target.top < nav.bottom && target.bottom > nav.top, sidebar: document.querySelector('.detail-chapters').getBoundingClientRect().left >= document.querySelector('.episode-reading-column').getBoundingClientRect().right, overflow: document.documentElement.scrollWidth > innerWidth,
        sameAudio: navigationAudio === document.querySelector('audio'), playing: !navigationAudio.paused };
    })()`);
    assert.equal(result.overlap, false, hash + ' is covered by navigation');
    if (width === 1440) assert.equal(result.sidebar, true, 'Navigation must sit beside the article');
    assert.ok(result.targetTop >= 0, hash + ' is above the viewport');
    assert.ok(result.targetTop < 900, hash + ' did not scroll into view');
    assert.equal(result.overflow, false);
    assert.equal(result.sameAudio, true);
    assert.equal(result.playing, true);
  }
}
await js('history.back()');
await until(() => js('location.hash === "#shownotes"'));
assert.equal(await js('navigationAudio === document.querySelector("audio")'), true);
await js('navigationAudio.pause()');
await gotoAndWait(origin + '/episodes/2026-10-02#episode-materials-title', { timeout: 30 });
await until(() => js('(()=>{const target=document.getElementById("episode-materials-title").getBoundingClientRect();return target.top>=0 && target.top<innerHeight})()'));
const contacts = await js('[...document.querySelectorAll("footer nav[aria-label=联系方式] a")].map(a=>({name:a.getAttribute("aria-label"),href:a.href,icon:!!a.querySelector("svg"),text:a.textContent.trim()}))');
assert.deepEqual(contacts.map(a=>a.href), ['mailto:hqwuzhaoyi@gmail.com', 'https://github.com/hqwuzhaoyi', 'https://x.com/hqwuzhaoyi']);
assert.ok(contacts.every(a=>a.name && a.icon && !a.text));
cliLog('Episode navigation passed: anchors, right sidebar, history, deep link, uninterrupted audio, accessible contact icons and 320/390/1440 layouts.');
EGO
