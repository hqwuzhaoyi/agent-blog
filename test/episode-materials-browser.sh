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
await until(()=>js('document.querySelectorAll(".material-card").length===2'));
assert.equal(await js('document.querySelectorAll(".material-meta time").length'),1,'Do not invent an unknown source date');
assert.equal(await js('document.querySelectorAll(".material-actions a")[1].textContent'),'查看播放列表');
assert.ok(await js('[...document.querySelectorAll(".material-actions a")].every(a=>a.target==="_blank"&&a.rel.includes("noopener")&&a.href.startsWith("https://"))'));
await js('document.querySelector(".episode-inline-player button").focus()');await pressKey('Enter');
await until(()=>js('!!document.querySelector("audio").src && document.querySelector("audio").readyState>=1'));
await js('window.materialAudio=document.querySelector("audio");materialAudio.pause()');
await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});
await js('document.querySelector(".material-listen").scrollIntoView({block:"center"});document.querySelector(".material-listen").focus({preventScroll:true});window.materialScroll=scrollY');
await pressKey('Enter');
await until(()=>js('materialAudio.currentTime>=5 && !materialAudio.paused'));
assert.equal(await js('location.hash'),'');
assert.equal(await js('scrollY'),await js('materialScroll'));
assert.equal(await js('document.querySelectorAll("audio").length'),1);
await js('materialAudio.pause()');
await js('document.querySelectorAll(".material-listen")[1].focus({preventScroll:true})');await pressKey('Enter');
await until(()=>js('materialAudio.currentTime>=12 && materialAudio.currentTime<15'));
await js('materialAudio.pause()');
for(const width of [390,1440]){
 await cdp('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
 assert.ok(await js('document.documentElement.scrollWidth<=innerWidth'));
 assert.ok(await js('[...document.querySelectorAll(".material-card")].every(e=>e.scrollWidth<=e.clientWidth)'));
}
await js('document.querySelector(".public-nav a[href*=archive]").click()');
await until(()=>js('location.pathname==="/archive"'));
assert.equal(await js('materialAudio===document.querySelector("audio")'),true);
cliLog('Episode materials passed: selected cards, truthful dates/source links, measured chapter actions without scroll/hash, single audio continuity and 390/1440 layouts.');
EGO
