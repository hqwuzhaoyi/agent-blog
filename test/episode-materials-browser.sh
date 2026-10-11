#!/usr/bin/env bash
set -euo pipefail
ego-browser nodejs <<'EGO'
const assert=(await import('node:assert/strict')).default;
await useOrCreateTaskSpace(process.env.EGO_TASKSPACE||'gitlog domain and player');
const origin=process.env.REACT_PREVIEW_URL||'http://localhost:3100';
assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(origin).hostname));
const until=async predicate=>{const deadline=Date.now()+15000;while(Date.now()<deadline){if(await predicate())return;await wait(.05)}assert.fail('Material browser condition did not settle')};
await openOrReuseTab(origin+'/episodes/2026-10-02',{wait:true,timeout:20});
await gotoAndWait(origin+'/episodes/2026-10-02',{timeout:20});
await until(()=>js('document.querySelectorAll("[aria-labelledby=episode-materials-title] article").length===3'));
assert.equal(await js('document.querySelectorAll("[aria-labelledby=episode-materials-title] time").length'),2,'Do not invent an unknown source date');
assert.equal(await js('document.querySelectorAll("[aria-labelledby=episode-materials-title] a")[1].textContent'),'查看播放列表');
assert.ok(await js('[...document.querySelectorAll("[aria-labelledby=episode-materials-title] a")].every(a=>a.target==="_blank"&&a.rel.includes("noopener")&&a.href.startsWith("https://"))'));
const sourceLinks=await js('[...document.querySelectorAll("[aria-labelledby=episode-materials-title] a")].map(a=>a.href)');
assert.equal(new Set(sourceLinks).size, sourceLinks.length, 'Each source appears only once');
assert.equal(await js('document.querySelectorAll("[aria-labelledby=episode-timeline-title]").length'),0,'No duplicate timeline section');
assert.equal(await js('document.querySelector("[aria-labelledby=episode-materials-title] details").open'),false);
await js('document.querySelector("[aria-labelledby=episode-materials-title] summary").click()');
assert.equal(await js('document.querySelector("[aria-labelledby=episode-materials-title] details").open'),true);
// SSR content appears before React attaches the playback handler.
await until(()=>js('Object.keys(document.querySelector("[aria-label=播客播放器] button")||{}).some(key=>key.startsWith("__reactProps"))'));
await js('document.querySelector("[aria-label=播客播放器] button").focus()');await pressKey('Enter');
await until(()=>js('!!document.querySelector("audio").src && document.querySelector("audio").readyState>=1'));
await js('window.materialAudio=document.querySelector("audio");materialAudio.pause()');
await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});
await js('document.querySelector("button[aria-label^=播放对应章节]").scrollIntoView({block:"center"});document.querySelector("button[aria-label^=播放对应章节]").focus({preventScroll:true});window.materialScroll=scrollY');
await pressKey('Enter');
await until(()=>js('materialAudio.currentTime>=5 && !materialAudio.paused'));
assert.equal(await js('location.hash'),'');
assert.equal(await js('scrollY'),await js('materialScroll'));
assert.equal(await js('document.querySelectorAll("audio").length'),1);
await js('materialAudio.pause()');
await js('document.querySelectorAll("button[aria-label^=播放对应章节]")[1].focus({preventScroll:true})');await pressKey('Enter');
await until(()=>js('materialAudio.currentTime>=12 && materialAudio.currentTime<15'));
await js('materialAudio.pause()');
for(const width of [390,1440]){
 await cdp('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
 assert.ok(await js('document.documentElement.scrollWidth<=innerWidth'));
 assert.ok(await js('[...document.querySelectorAll("[aria-labelledby=episode-materials-title] article")].every(e=>e.scrollWidth<=e.clientWidth)'));
}
await js('document.querySelector("header nav a[href*=archive]").click()');
await until(()=>js('location.pathname==="/archive"'));
assert.equal(await js('materialAudio===document.querySelector("audio")'),true);
cliLog('Episode materials passed: selected cards, truthful dates/source links, measured chapter actions without scroll/hash, single audio continuity and 390/1440 layouts.');
EGO
