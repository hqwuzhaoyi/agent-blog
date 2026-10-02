/** Browser regression acceptance against the isolated seeded React preview. */
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const origin = process.env.REACT_PREVIEW_URL || 'http://localhost:3100';
const browser = (...args) => {
  if (args[0] === 'find' && args[1] === 'role' && args[3] === 'click') {
    const snapshot = execFileSync('agent-browser', ['--session', 'public-regression', 'snapshot', '-i'], { encoding: 'utf8' });
    const line = snapshot.split('\n').find(line => line.includes(`${args[2]} "${args[5]}"`));
    assert.ok(line, `Missing ${args[2]}: ${args[5]}`);
    args = ['click', `@${line.match(/ref=(e\d+)/)[1]}`];
  }
  return execFileSync('agent-browser', ['--session', 'public-regression', ...args], { encoding: 'utf8' }).trim();
};
const evaluate = code => JSON.parse(browser('eval', code));
const eventually = predicate => { for (let attempt = 0; attempt < 30; attempt++) if (predicate()) return; assert.fail('Browser state did not settle'); };
browser('open', `${origin}/agent-blog/`);
assert.equal(evaluate('document.querySelectorAll("audio").length'), 1);
assert.equal(evaluate('document.querySelector("audio").paused'), true);
browser('find', 'role', 'button', 'click', '--name', '播放本期 · 00:30');
assert.equal(evaluate('document.querySelector("audio").paused'), false);
evaluate('window.regressionAudio=document.querySelector("audio"); true');
evaluate('[...document.querySelectorAll("button")].find(button => button.textContent.includes("00:05")).click(); true');
assert.equal(evaluate('location.hash'), '');
assert.equal(evaluate('scrollY'), 0);
eventually(() => evaluate('regressionAudio.currentTime') >= 5);
evaluate('[...document.querySelectorAll("button")].find(button => button.textContent.includes("00:12")).click(); true');
eventually(() => evaluate('regressionAudio.currentTime') >= 12);
evaluate('[...document.querySelectorAll("button")].find(button => button.textContent.includes("00:05")).click(); true');
eventually(() => evaluate('regressionAudio.currentTime') >= 5 && evaluate('regressionAudio.currentTime') < 8);
browser('find', 'role', 'link', 'click', '--name', '节目笔记 →');
assert.ok(evaluate('location.pathname').includes('/episodes/'));
assert.equal(evaluate('regressionAudio === document.querySelector("audio")'), true);
assert.equal(evaluate('regressionAudio.paused'), false);
browser('find', 'role', 'link', 'click', '--name', '归档', '--exact');
assert.ok(evaluate('location.pathname').includes('/archive'));
browser('find', 'label', '关键词', 'fill', '无结果测试');
browser('select', 'select', '2026-10');
assert.ok(evaluate('location.search').includes('month=2026-10'));
eventually(() => evaluate('document.querySelector("[role=status]").textContent') === '0 条公开内容');
browser('back');
eventually(() => evaluate('document.querySelector("select").value') === '');
assert.equal(evaluate('regressionAudio === document.querySelector("audio")'), true);
browser('set', 'viewport', '390', '844');
browser('set', 'media', 'light', 'reduced-motion');
assert.equal(evaluate('matchMedia("(prefers-reduced-motion: reduce)").matches'), true);
assert.equal(evaluate('document.documentElement.scrollWidth > innerWidth'), false);
browser('find', 'role', 'button', 'click', '--name', '展开播放器');
eventually(() => evaluate('document.activeElement.textContent') === '关闭');
browser('press', 'Escape');
eventually(() => evaluate('document.activeElement.getAttribute("aria-label")') === '展开播放器');
browser('find', 'role', 'button', 'click', '--name', '展开播放器');
const handle = evaluate('(() => { const r=document.querySelector("[role=dialog] .cursor-grab").getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()');
browser('mouse', 'move', String(handle.x), String(handle.y));
browser('mouse', 'down', 'left');
browser('mouse', 'move', String(handle.x), String(handle.y + 190));
browser('mouse', 'up', 'left');
eventually(() => evaluate('document.querySelectorAll("[role=dialog]").length') === 0);
console.log('Public playback, route continuity, chapter, archive history and mobile focus acceptance passed.');

