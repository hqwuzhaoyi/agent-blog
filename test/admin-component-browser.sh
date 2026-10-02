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
assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(origin).hostname),'Admin component regression must use local preview');
try {
    (await browser('set', 'viewport', '1440', '1000'));
    (await browser('open', origin + '/admin/'));
    (await eventually(async () => (await evaluate('!!document.querySelector("#review-key") || !!document.querySelector("nav[aria-label=审核导航]")'))));
    if(await evaluate('!!document.querySelector("#review-key")')) { (await browser('fill', '#review-key', 'isolated-preview-password')); (await clickNamed('button', '登录')); }
    (await eventually(async () => (await evaluate('!!document.querySelector("nav[aria-label=审核导航]")'))));
    (await evaluate(`(()=>{
 const savedFetch=window.fetch.bind(window);window.__adminMockMode='reviews-error';
 const revision='b'.repeat(64);
 const fixture={id:'qa-components-browser',revision,draftRevision:revision,publishedRevision:null,publishedAt:null,createdAt:'2026-10-03T00:00:00.000Z',url:'/reviews/qa-components-browser/',data:{title:'请求展示回归草稿',summary:'仅用于当前本地浏览器会话',date:'2026-10-03',source:'本地回归',platforms:['Hermes'],highlights:1},body:'## 完整保存预览\\n后台只读回归内容',html:'<h2>完整保存预览</h2><p>后台只读回归内容</p>',published:null};
 window.__adminFixture=fixture;
 const result=value=>new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}});
 window.fetch=async(input,init)=>{
 const path=new URL(typeof input==='string'?input:input.url,location.origin).pathname;
 if(!path.startsWith('/admin/api/'))return savedFetch(input,init);
 if(init?.method&&!['GET','HEAD'].includes(init.method))throw new Error('Component regression forbids content writes');
 if(path.endsWith('/audit'))return window.__adminMockMode==='audit-error'?new Response(JSON.stringify({error:'模拟审批记录读取失败'}),{status:503,headers:{'Content-Type':'application/json'}}):result({items:[]});
 if(path.endsWith('/reviews/qa-components-browser'))return window.__adminMockMode==='detail-error'?new Response(JSON.stringify({error:'模拟完整预览读取失败'}),{status:503,headers:{'Content-Type':'application/json'}}):result(fixture);
 if(path.endsWith('/episodes'))return window.__adminMockMode==='episodes-error'?new Response(JSON.stringify({error:'模拟节目读取失败'}),{status:503,headers:{'Content-Type':'application/json'}}):result({items:[],page:1,limit:20,total:0});
 if(path.endsWith('/reviews')){
  if(window.__adminMockMode==='reviews-error')return new Response(JSON.stringify({error:'模拟列表读取失败'}),{status:503,headers:{'Content-Type':'application/json'}});
  if(window.__adminMockMode==='reviews-loading')return new Promise(resolve=>{window.__resolveAdminRequest=()=>resolve(result({items:[fixture],page:1,limit:10,total:1}))});
  return result({items:window.__adminMockMode==='reviews-empty'?[]:[fixture],page:1,limit:10,total:window.__adminMockMode==='reviews-empty'?0:1});
 }
 return savedFetch(input,init);
 };return true;
 })()`));
    (await clickNamed('link', '已发布'));
    (await eventually(async () => (await mainText()).includes('模拟列表读取失败')));
    assert.ok(!(await mainText()).includes('没有符合条件') && !(await mainText()).includes('读取中'));
    (await evaluate('window.__adminMockMode="reviews-empty";true'));
    (await clickNamed('button', '重新读取'));
    (await eventually(async () => (await mainText()).includes('没有符合条件的工作日志')));
    assert.ok(!(await mainText()).includes('模拟列表读取失败'));
    (await evaluate('window.__adminMockMode="reviews-loading";true'));
    (await browser('fill', 'input[aria-label=搜索]', 'loading'));
    (await eventually(async () => (await evaluate('typeof window.__resolveAdminRequest==="function"'))));
    assert.ok((await mainText()).includes('读取中'));
    assert.ok(!(await mainText()).includes('没有符合条件') && !(await mainText()).includes('模拟列表读取失败'));
    (await evaluate('window.__adminMockMode="ready";window.__resolveAdminRequest();true'));
    (await eventually(async () => (await mainText()).includes('请求展示回归草稿')));
    (await evaluate('window.__adminMockMode="episodes-error";true'));
    (await clickNamed('link', '播客'));
    (await eventually(async () => (await mainText()).includes('模拟节目读取失败')));
    assert.ok(!(await mainText()).includes('读取中') && !(await mainText()).includes('暂无公开节目'));
    (await evaluate('window.__adminMockMode="episodes-empty";true'));
    (await clickNamed('button', '重新读取'));
    (await eventually(async () => (await mainText()).includes('暂无公开节目')));
    (await evaluate('window.__adminMockMode="ready";true'));
    (await clickNamed('link', '待确认'));
    (await eventually(async () => (await mainText()).includes('请求展示回归草稿')));
    (await evaluate('window.__adminMockMode="detail-error";true'));
    (await clickNamed('link', '请求展示回归草稿'));
    (await eventually(async () => (await mainText()).includes('模拟完整预览读取失败')));
    assert.ok(!(await mainText()).includes('读取完整预览') && !(await mainText()).includes('完整保存预览'));
    (await evaluate('window.__adminMockMode="audit-error";true'));
    (await clickNamed('button', '重新读取'));
    (await eventually(async () => (await mainText()).includes('模拟审批记录读取失败')));
    assert.ok(!(await mainText()).includes('读取完整预览') && !(await mainText()).includes('完整保存预览'));
    (await evaluate('window.__adminMockMode="ready";true'));
    (await clickNamed('button', '重新读取'));
    (await eventually(async () => (await mainText()).includes('完整保存预览')));
    assert.equal((await evaluate('Array.from(document.querySelectorAll("[role=tabpanel]")).filter(e=>getComputedStyle(e).display!=="none").length')), 2, 'Desktop must keep two-column panels visible');
    (await browser('set', 'viewport', '390', '844'));
    assert.equal((await evaluate('Array.from(document.querySelectorAll("[role=tabpanel]")).filter(e=>getComputedStyle(e).display!=="none").length')), 1);
    (await evaluate('document.querySelector("[role=tablist]").focus();true'));
    (await eventually(async () => (await evaluate('Array.from(document.querySelectorAll("[role=tab]")).filter(e=>e.tabIndex===0).length')) === 1));
    assert.ok((await evaluate('Array.from(document.querySelectorAll("[role=tab]")).every(e=>document.getElementById(e.getAttribute("aria-controls"))?.getAttribute("aria-labelledby")===e.id)')));
    (await evaluate('window.__adminPreview=document.querySelector(".reading-article");document.querySelector("[role=tab]").focus();true'));
    (await browser('press', 'ArrowRight'));
    (await eventually(async () => (await evaluate('document.querySelector("[role=tab][aria-selected=true]").textContent')) === '信息与修订'));
    (await browser('press', 'Home'));
    (await eventually(async () => (await evaluate('document.querySelector("[role=tab][aria-selected=true]").textContent')) === '预览'));
    (await browser('press', 'End'));
    (await eventually(async () => (await evaluate('document.querySelector("[role=tab][aria-selected=true]").textContent')) === '信息与修订'));
    (await clickNamed('button', '编辑草稿'));
    (await eventually(async () => (await evaluate('!!document.querySelector(".admin-editor input")'))));
    (await browser('fill', '.admin-editor input', '未保存编辑保留检查'));
    (await evaluate('window.__adminEditor=document.querySelector(".admin-editor input");document.querySelector("[role=tab][aria-selected=true]").focus();true'));
    (await browser('press', 'ArrowRight'));
    (await browser('press', 'ArrowLeft'));
    assert.equal((await evaluate('window.__adminEditor===document.querySelector(".admin-editor input")')), true, 'Tab panels must remain mounted');
    assert.equal((await evaluate('window.__adminPreview===document.querySelector(".reading-article")')), true, 'Saved article preview must remain mounted');
    assert.equal((await evaluate('document.querySelector(".admin-editor input").value')), '未保存编辑保留检查');
    assert.equal((await evaluate('Array.from(document.querySelectorAll("button")).find(e=>e.textContent.includes("确认并发布")).disabled')), true, 'Dirty edits must disable approval');
    assert.ok((await evaluate('document.documentElement.scrollWidth<=innerWidth')));
    cliLog('Admin component browser regression passed: mutually exclusive request outcomes/retry, desktop panels, mobile keyboard tabs and mounted dirty edits.');
}
catch (error) {
    cliLog(['Admin regression failure:', (await browser('snapshot', '-i'))]);
    cliLog((await evaluate('({path:location.pathname,mode:window.__adminMockMode,main:document.querySelector("main")?.textContent})')));
    throw error;
}

EGO
