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
(await browser('set', 'viewport', '1440', '1000'));
(await browser('open', `${origin}/`));
assert.equal((await evaluate('document.querySelectorAll("audio").length')), 1);
assert.equal((await evaluate('document.querySelector("audio").paused')), true);
(await browser('find', 'role', 'button', 'click', '--name', '播放本期 · 00:30'));
assert.equal((await evaluate('document.querySelector("audio").paused')), false);
(await evaluate('window.regressionAudio=document.querySelector("audio"); true'));
(await evaluate('[...document.querySelectorAll("button")].find(button => button.textContent.includes("00:05")).click(); true'));
assert.equal((await evaluate('location.hash')), '');
assert.equal((await evaluate('scrollY')), 0);
(await eventually(async () => (await evaluate('regressionAudio.currentTime')) >= 5));
assert.ok((await evaluate('document.querySelector(".chapter-button[aria-current=true]").textContent')).includes('00:05'));
(await evaluate('[...document.querySelectorAll("button")].find(button => button.textContent.includes("00:12")).click(); true'));
(await eventually(async () => (await evaluate('regressionAudio.currentTime')) >= 12));
assert.ok((await evaluate('document.querySelector(".chapter-button[aria-current=true]").textContent')).includes('00:12'));
(await evaluate('[...document.querySelectorAll("button")].find(button => button.textContent.includes("00:05")).click(); true'));
(await eventually(async () => (await evaluate('regressionAudio.currentTime')) >= 5 && (await evaluate('regressionAudio.currentTime')) < 8));
(await browser('find', 'role', 'link', 'click', '--name', '节目笔记 →'));
assert.ok((await evaluate('location.pathname')).includes('/episodes/'));
assert.equal((await evaluate('regressionAudio === document.querySelector("audio")')), true);
assert.equal((await evaluate('regressionAudio.paused')), false);
// The official chapter accordion keeps media and chapter controls intact.
assert.equal((await evaluate('document.querySelector(".chapter-accordion-trigger").getAttribute("aria-expanded")')), 'true');
(await evaluate('document.querySelector(".chapter-accordion-trigger").focus(); true'));
(await browser('press', 'Enter'));
(await eventually(async () => (await evaluate('document.querySelector(".chapter-accordion-trigger").getAttribute("aria-expanded")')) === 'false'));
assert.equal((await evaluate('document.querySelector(".chapter-accordion [role=region]").inert')), true);
(await browser('press', 'Enter'));
(await eventually(async () => (await evaluate('document.querySelector(".chapter-accordion-trigger").getAttribute("aria-expanded")')) === 'true'));
assert.equal((await evaluate('regressionAudio === document.querySelector("audio")')), true);
assert.equal((await evaluate('location.hash')), '');
(await browser('find', 'role', 'link', 'click', '--name', '工作日志', '--exact'));
assert.match((await evaluate('location.pathname')), /^\/reviews\/?$/);
assert.equal((await evaluate('document.querySelector("h1").textContent')), '工作日志');
assert.equal((await evaluate('document.querySelectorAll(".archive-toolbar, .episode-card, .archive-entry").length')), 0);
assert.ok((await evaluate('document.querySelectorAll(".review-list .review-entry").length')) > 0);
assert.equal((await evaluate('[...document.querySelectorAll(".public-nav .is-active")].map(link => link.textContent).join(",")')), '工作日志');
assert.equal((await evaluate('regressionAudio === document.querySelector("audio")')), true);
(await evaluate('document.querySelector(".review-copy").click(); true'));
(await eventually(async () => (await evaluate('document.querySelector(".detail-back")?.getAttribute("href")')) === '/reviews'));
(await browser('find', 'role', 'link', 'click', '--name', '工作日志', '--exact'));
assert.match((await evaluate('location.pathname')), /^\/reviews\/?$/);
(await browser('find', 'role', 'link', 'click', '--name', '归档', '--exact'));
assert.ok((await evaluate('location.pathname')).includes('/archive'));
assert.equal((await evaluate('[...document.querySelectorAll(".public-nav .is-active")].map(link => link.textContent).join(",")')), '归档');
const historyBeforeTyping = (await evaluate('history.length'));
(await browser('find', 'label', '关键词', 'fill', '无结果测试'));
(await eventually(async () => (await evaluate('location.search')).includes(encodeURIComponent('无结果测试'))));
assert.equal((await evaluate('history.length')), historyBeforeTyping);
(await browser('select', 'select', '2026-10'));
assert.ok((await evaluate('location.search')).includes('month=2026-10'));
(await eventually(async () => (await evaluate('document.querySelector("[role=status]").textContent')) === '0 条公开内容'));
(await browser('back'));
(await eventually(async () => (await evaluate('document.querySelector("select").value')) === ''));
assert.equal((await evaluate('regressionAudio === document.querySelector("audio")')), true);
(await browser('find', 'role', 'button', 'click', '--name', '重置筛选'));
(await eventually(async () => (await evaluate('document.querySelectorAll(".archive-entry,.review-entry").length')) > 0));
assert.equal((await evaluate('document.querySelector("input[type=search]").value')), '');
assert.equal((await evaluate('document.activeElement.type')), 'search');
// A list control must pause/resume the same audio without resetting its clock.
(await evaluate('regressionAudio.pause(); true'));
(await eventually(async () => (await evaluate('document.querySelector(".entry-play").getAttribute("aria-pressed")')) === 'false'));
(await evaluate('document.querySelector(".entry-play").click(); true'));
(await eventually(async () => (await evaluate('document.querySelector(".entry-play").getAttribute("aria-pressed")')) === 'true'));
(await evaluate('regressionAudio.currentTime=7; true'));
(await evaluate('document.querySelector(".entry-play").click(); true'));
(await eventually(async () => (await evaluate('regressionAudio.paused'))));
assert.equal((await evaluate('document.querySelector(".entry-play").getAttribute("aria-pressed")')), 'false');
assert.ok((await evaluate('regressionAudio.currentTime')) >= 7);
(await evaluate('document.querySelector(".entry-play").click(); true'));
(await eventually(async () => !(await evaluate('regressionAudio.paused'))));
assert.ok((await evaluate('regressionAudio.currentTime')) >= 7);
(await browser('set', 'viewport', '390', '844'));
(await browser('set', 'media', 'light', 'reduced-motion'));
assert.equal((await evaluate('matchMedia("(prefers-reduced-motion: reduce)").matches')), true);
assert.equal((await evaluate('document.documentElement.scrollWidth > innerWidth')), false);
(await browser('find', 'role', 'button', 'click', '--name', '展开播放器'));
(await eventually(async () => (await evaluate('document.activeElement.textContent')) === '关闭'));
(await browser('press', 'Escape'));
(await eventually(async () => (await evaluate('document.activeElement.getAttribute("aria-label")')) === '展开播放器'));
(await eventually(async () => (await evaluate('document.querySelectorAll("[role=dialog]").length')) === 0));
(await browser('find', 'role', 'button', 'click', '--name', '展开播放器'));
(await eventually(async () => (await evaluate('(() => { const sheet=document.querySelector("[role=dialog]"); return !!sheet && Math.abs(sheet.getBoundingClientRect().bottom-innerHeight)<1; })()'))));
const handle = (await evaluate('(() => { const r=document.querySelector("[role=dialog] .cursor-grab").getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()'));
(await browser('mouse', 'move', String(Math.round(handle.x)), String(Math.round(handle.y))));
(await browser('mouse', 'down', 'left'));
(await browser('mouse', 'move', String(Math.round(handle.x)), String(Math.round(handle.y + 190))));
(await browser('mouse', 'up', 'left'));
(await eventually(async () => (await evaluate('document.querySelectorAll("[role=dialog]").length')) === 0));
(await browser('find', 'role', 'button', 'click', '--name', '打开导航菜单'));
(await eventually(async () => (await evaluate('document.querySelectorAll(".mobile-nav a").length')) === 4));
const navigationTitle = (await evaluate('document.querySelector("[role=dialog] h2").textContent'));
const closingTitle = (await evaluate('(async () => { document.querySelector("[data-sheet-close]").click(); await new Promise(requestAnimationFrame); return document.querySelector("[role=dialog] h2")?.textContent ?? null; })()'));
assert.ok(closingTitle === null || closingTitle === navigationTitle, 'Closing must retain its panel content');
(await eventually(async () => (await evaluate('document.querySelectorAll("[role=dialog]").length')) === 0));
assert.equal((await evaluate('document.activeElement.getAttribute("aria-label")')), '打开导航菜单');
assert.equal((await evaluate('getComputedStyle(document.querySelector(".persistent-player")).backdropFilter')), 'none');
assert.ok(parseFloat((await evaluate('getComputedStyle(document.querySelector(".entry-play")).transitionDuration'))) <= 0.00001);
cliLog('Public playback, chapter state, list toggle, filter reset/history, route continuity and mobile sheet acceptance passed.');

EGO
