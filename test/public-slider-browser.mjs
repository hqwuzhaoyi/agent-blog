/** Official beUI slider acceptance against isolated preview fixtures. */
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const session = 'beui-slider-impl';
const origin = process.env.REACT_PREVIEW_URL || 'http://localhost:3100';
const browser = (...args) => execFileSync('agent-browser', ['--session', session, ...args], { encoding: 'utf8' }).trim();
const evaluate = code => JSON.parse(browser('eval', code));
const eventually = predicate => { const deadline=Date.now()+20000; while(Date.now()<deadline) if(predicate()) return; assert.fail("Browser condition did not settle"); };
const near = (actual, expected, tolerance = .2) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);
const slider = label => `[role=slider][aria-label="${label}"]`;
const key = (label, key) => { evaluate(`document.querySelector('${slider(label)}').focus(); true`); browser('press', key); };
const mouseTo = (label, ratio) => { const p = evaluate(`(()=>{const r=document.querySelector('${slider(label)}').parentElement.getBoundingClientRect();return {x:r.x+r.width*${ratio},y:r.y+r.height/2}})()`); browser('mouse', 'move', String(Math.round(p.x)), String(Math.round(p.y))); };
try {
 browser('set', 'viewport', '1440', '1000'); browser('open', `${origin}/agent-blog/`);
 eventually(()=>evaluate('Object.keys(document.querySelector(".hero-listen button")||{}).some(key=>key.startsWith("__reactProps"))'));
 browser("click", ".hero-listen button");
 eventually(()=>evaluate('!!document.querySelector("[role=slider]")'));
 eventually(()=>evaluate('document.querySelector("audio").readyState')>=1);
 evaluate('document.querySelector("audio").pause(); window.sliderAudio=document.querySelector("audio"); true');
 assert.equal(evaluate('document.querySelectorAll("audio").length'),1);
 assert.equal(evaluate(`document.querySelector('${slider('播放进度')}').parentElement.getBoundingClientRect().height`),44);
 mouseTo('播放进度', .4); browser('mouse','down');
 near(evaluate('sliderAudio.currentTime'),12);
 mouseTo('播放进度', .7); near(evaluate('sliderAudio.currentTime'),21); browser('mouse','up');
 key('播放进度','ArrowRight'); near(evaluate('sliderAudio.currentTime'),21.1);
 key('播放进度','Home'); near(evaluate('sliderAudio.currentTime'),0);
 key('播放进度','End'); near(evaluate('sliderAudio.currentTime'),30);
 mouseTo('音量',.4); browser('mouse','down'); browser('mouse','up'); near(evaluate('sliderAudio.volume'),.4,.01);
 key('音量','ArrowRight'); near(evaluate('sliderAudio.volume'),.45,.01);
 evaluate('sliderAudio.currentTime=9; sliderAudio.dispatchEvent(new Event("timeupdate"));true');
 near(Number(evaluate(`document.querySelector('${slider('播放进度')}').getAttribute('aria-valuenow')`)),9);
 const before=evaluate('({scroll:scrollY,hash:location.hash})');
 evaluate('[...document.querySelectorAll(".chapter-button")].find(b=>b.textContent.includes("00:12")).click();true');
 near(evaluate('sliderAudio.currentTime'),12,1);
 assert.deepEqual(evaluate('({scroll:scrollY,hash:location.hash})'),before);
 evaluate('document.querySelector(".public-nav a[href*=archive]").click();true');
 assert.equal(evaluate('sliderAudio===document.querySelector("audio")'),true);
 browser('set','viewport','390','844');
 evaluate('document.querySelector(".persistent-player-title").click();true');
 eventually(()=>evaluate('!!document.querySelector("[role=dialog]")'));
 assert.equal(evaluate('!!document.querySelector("[role=dialog] [role=slider]")'),true);
 eventually(()=>evaluate('Math.abs(document.querySelector("[role=dialog]").getBoundingClientRect().bottom-innerHeight)<1'));
 // Content scrolling changes only its own scrollTop; chapter/slider gestures do not seek the page.
 // This CLI's mouse wheel emits at (0,0), so explicitly target the native scroll container.
 evaluate('(()=>{const list=document.querySelector("[role=dialog] .overflow-y-auto");window.sliderScrollBefore=scrollY;list.style.maxHeight="120px";return true})()');
 browser('scroll','down','80','--selector','[role=dialog] .overflow-y-auto');
 eventually(()=>evaluate('document.querySelector("[role=dialog] .overflow-y-auto").scrollTop')>0);
 assert.equal(evaluate('scrollY'),evaluate('sliderScrollBefore'));
 browser('set','media','light','reduced-motion');
 evaluate('document.querySelector("audio").pause();true');
 key('播放进度','Home'); near(evaluate('document.querySelector("audio").currentTime'),0);
 assert.equal(evaluate('matchMedia("(prefers-reduced-motion: reduce)").matches'),true);
 assert.equal(evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
 console.log('Official beUI sliders: pointer/click/keyboard, controlled media time, volume, same audio navigation, chapter scroll/hash, mobile sheet and reduced motion passed.');
} finally { browser('close'); }
