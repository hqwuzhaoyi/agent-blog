#!/usr/bin/env bash
set -euo pipefail
# Ego heredoc runtime; reuse the goal taskspace. Run suites sequentially, then
# bash test/complete-browser-taskspace.sh after all preceding output passes.
ego-browser nodejs <<'EGO'
const assert = (await import('node:assert/strict')).default;
const task = await useOrCreateTaskSpace(process.env.EGO_TASKSPACE || 'gitlog domain and player');
const origin = process.env.REACT_PREVIEW_URL || 'http://localhost:3100';
const evaluate = code => js(code);
const eventually = async predicate => { const until = Date.now() + 20000; while (Date.now() < until) { if (await predicate()) return; await wait(.05); } assert.fail('Browser state did not settle'); };
const near = (actual, expected, tolerance = .2) => assert.ok(Math.abs(actual - expected) < tolerance, actual + ' != ' + expected);
const slider = label => '[role=slider][aria-label=' + JSON.stringify(label) + ']';
const key = async (label, name) => { await js('document.querySelector(' + JSON.stringify(slider(label)) + ').focus(); true'); await pressKey(name); };
let viewport = {width:1440,height:1000};
let point = {x:0, y:0}; let mouseDown = false;
const mouseTo = async (label, ratio) => { const p = await js('(()=>{const r=document.querySelector(' + JSON.stringify(slider(label)) + ').parentElement.getBoundingClientRect();return {x:r.x+r.width*' + ratio + ',y:r.y+r.height/2}})()'); await browser('mouse','move',p.x,p.y); };
const clickNamed = async (role, name) => {
  const marker = await js('(()=>{const normalize=v=>v.replace(/\\s+/g, ""); const candidates=[...document.querySelectorAll(' + JSON.stringify(role === 'link' ? 'a' : 'button') + ')]; const node=candidates.find(el=>normalize(el.getAttribute("aria-label")||el.textContent)===normalize(' + JSON.stringify(name) + ') && el.getBoundingClientRect().width>0 && el.getBoundingClientRect().height>0 && !el.closest("[inert]")); if(!node)return null; document.querySelectorAll("[data-ego-regression-action]").forEach(el=>el.removeAttribute("data-ego-regression-action")); node.setAttribute("data-ego-regression-action", "target"); return "[data-ego-regression-action=target]";})()');
  assert.ok(marker, 'Missing ' + role + ': ' + name); await click(marker);
};
const browser = async (command, ...args) => {
  if (command === 'set' && args[0] === 'viewport') { viewport={width:Number(args[1]),height:Number(args[2])}; if(await ensureRealTab()) return cdp('Emulation.setDeviceMetricsOverride',{...viewport,deviceScaleFactor:1,mobile:false}); return; }
  if (command === 'set' && args[0] === 'media') return cdp('Emulation.setEmulatedMedia', {features:[{name:'prefers-color-scheme',value:args[1]},{name:'prefers-reduced-motion',value:args.includes('reduced-motion')?'reduce':'no-preference'}]});
  if (command === 'open') { await openOrReuseTab(args[0],{wait:true,timeout:20}); await gotoAndWait(args[0],{timeout:20,settle:.15}); await cdp('Emulation.setDeviceMetricsOverride',{...viewport,deviceScaleFactor:1,mobile:false}); return; }
  if (command === 'find' && args[0] === 'role') return clickNamed(args[1],args[4]);
  if (command === 'find' && args[0] === 'label') { await waitForElement('input[type=search]'); return fillInput('input[type=search]',args[3]); }
  if (command === 'click') return click(args[0]);
  if (command === 'fill') { await waitForElement(args[0]); return fillInput(args[0],args[1]); }
  if (command === 'press') return pressKey(args[0]);
  if (command === 'back') { await js('history.back(); true'); await wait(.1); return; }
  if (command === 'snapshot') return snapshotText();
  if (command === 'select') return js('(()=>{const el=document.querySelector(' + JSON.stringify(args[0]) + ');el.value=' + JSON.stringify(args[1]) + ';el.dispatchEvent(new Event("change",{bubbles:true}));return true})()');
  if (command === 'mouse') {
    if (args[0] === 'move') { point={x:Number(args[1]),y:Number(args[2])}; return cdp('Input.dispatchMouseEvent',{type:'mouseMoved',...point,buttons:mouseDown?1:0}); }
    mouseDown=args[0]==='down'; return cdp('Input.dispatchMouseEvent',{type:mouseDown?'mousePressed':'mouseReleased',...point,button:'left',buttons:mouseDown?1:0,clickCount:1});
  }
  if (command === 'scroll') { const selector=args[args.indexOf('--selector')+1]; const p=await js('(()=>{const r=document.querySelector(' + JSON.stringify(selector) + ').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()'); return cdp('Input.dispatchMouseEvent',{type:'mouseWheel',...p,deltaX:0,deltaY:Number(args[1])}); }
  throw new Error('Unsupported regression action: ' + command);
};
const mainText = () => js('document.querySelector("main")?.textContent||""');
try {
    (await browser('set', 'viewport', '1440', '1000'));
    (await browser('open', `${origin}/`));
    (await eventually(async () => (await evaluate('Object.keys(document.querySelector(".hero-listen button")||{}).some(key=>key.startsWith("__reactProps"))'))));
    (await browser("click", ".hero-listen button"));
    (await eventually(async () => (await evaluate('!!document.querySelector("[role=slider]")'))));
    (await eventually(async () => (await evaluate('document.querySelector("audio").readyState')) >= 1));
    (await evaluate('document.querySelector("audio").pause(); window.sliderAudio=document.querySelector("audio"); true'));
    assert.equal((await evaluate('document.querySelectorAll("audio").length')), 1);
    assert.equal((await evaluate(`document.querySelector('${slider('播放进度')}').parentElement.getBoundingClientRect().height`)), 44);
    (await mouseTo('播放进度', .4));
    (await browser('mouse', 'down'));
    near((await evaluate('sliderAudio.currentTime')), 12);
    (await mouseTo('播放进度', .7));
    near((await evaluate('sliderAudio.currentTime')), 21);
    (await browser('mouse', 'up'));
    (await key('播放进度', 'ArrowRight'));
    near((await evaluate('sliderAudio.currentTime')), 21.1);
    (await key('播放进度', 'Home'));
    near((await evaluate('sliderAudio.currentTime')), 0);
    (await key('播放进度', 'End'));
    near((await evaluate('sliderAudio.currentTime')), 30);
    (await mouseTo('音量', .4));
    (await browser('mouse', 'down'));
    (await browser('mouse', 'up'));
    near((await evaluate('sliderAudio.volume')), .4, .01);
    (await key('音量', 'ArrowRight'));
    near((await evaluate('sliderAudio.volume')), .45, .01);
    assert.equal((await evaluate('document.querySelector(".player-volume-value").textContent')), '45%');
    assert.ok((await evaluate('document.querySelector(".player-time-readout").textContent')).includes('/'));
    (await evaluate('sliderAudio.currentTime=9; sliderAudio.dispatchEvent(new Event("timeupdate"));true'));
    near(Number((await evaluate(`document.querySelector('${slider('播放进度')}').getAttribute('aria-valuenow')`))), 9);
    const before = (await evaluate('({scroll:scrollY,hash:location.hash})'));
    (await evaluate('[...document.querySelectorAll(".chapter-button")].find(b=>b.textContent.includes("00:12")).click();true'));
    near((await evaluate('sliderAudio.currentTime')), 12, 1);
    assert.deepEqual((await evaluate('({scroll:scrollY,hash:location.hash})')), before);
    (await evaluate('document.querySelector(".public-nav a[href*=archive]").click();true'));
    assert.equal((await evaluate('sliderAudio===document.querySelector("audio")')), true);
    (await browser('set', 'viewport', '390', '844'));
    (await evaluate('document.querySelector(".persistent-player-title").click();true'));
    (await eventually(async () => (await evaluate('!!document.querySelector("[role=dialog]")'))));
    assert.equal((await evaluate('!!document.querySelector("[role=dialog] [role=slider]")')), true);
    (await eventually(async () => (await evaluate('Math.abs(document.querySelector("[role=dialog]").getBoundingClientRect().bottom-innerHeight)<1'))));
    // Content scrolling changes only its own scrollTop; chapter/slider gestures do not seek the page.
    // This CLI's mouse wheel emits at (0,0), so explicitly target the native scroll container.
    (await evaluate('(()=>{const list=document.querySelector("[role=dialog] .overflow-y-auto");window.sliderScrollBefore=scrollY;list.style.maxHeight="120px";return true})()'));
    (await browser('scroll', 'down', '80', '--selector', '[role=dialog] .overflow-y-auto'));
    (await eventually(async () => (await evaluate('document.querySelector("[role=dialog] .overflow-y-auto").scrollTop')) > 0));
    assert.equal((await evaluate('scrollY')), (await evaluate('sliderScrollBefore')));
    (await browser('set', 'media', 'light', 'reduced-motion'));
    (await evaluate('document.querySelector("audio").pause();true'));
    (await key('播放进度', 'Home'));
    near((await evaluate('document.querySelector("audio").currentTime')), 0);
    assert.equal((await evaluate('matchMedia("(prefers-reduced-motion: reduce)").matches')), true);
    assert.equal((await evaluate('document.documentElement.scrollWidth<=innerWidth')), true);
    cliLog('Official beUI sliders: pointer/click/keyboard, controlled media time, volume, same audio navigation, chapter scroll/hash, mobile sheet and reduced motion passed.');
}
catch (error) {
    cliLog(await snapshotText());
    throw error;
}

EGO
