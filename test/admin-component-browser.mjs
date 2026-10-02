/** Isolated browser regressions; GET responses are mocked only in this session. */
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const origin=process.env.REACT_PREVIEW_URL||'http://localhost:3100';
assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(origin).hostname),'Admin component regression must use local preview');
const session='beui-admin-impl';
const browser=(...args)=>execFileSync('agent-browser',['--session',session,...args],{encoding:'utf8',timeout:30000}).trim();
const evaluate=code=>JSON.parse(browser('eval',code));
const eventually=predicate=>{const until=Date.now()+15000;while(Date.now()<until)if(predicate())return;assert.fail('Browser state did not settle')};
const click=(role,name)=>{const snapshot=browser('snapshot','-i');const line=snapshot.split('\n').find(line=>line.includes(`${role} "${name}"`));assert.ok(line,`Missing ${role}: ${name}`);browser('click',`@${line.match(/ref=(e\d+)/)[1]}`)};
const mainText=()=>evaluate('document.querySelector("main")?.textContent||""');
try{
 browser('set','viewport','1440','1000');browser('open',origin+'/agent-blog/admin/');
 eventually(()=>evaluate('!!document.querySelector("#review-key")'));
 browser('fill','#review-key','isolated-preview-password');click('button','登录');
 eventually(()=>evaluate('!!document.querySelector("nav[aria-label=审核导航]")'));
 evaluate(`(()=>{
 const savedFetch=window.fetch.bind(window);window.__adminMockMode='reviews-error';
 const revision='b'.repeat(64);
 const fixture={id:'qa-components-browser',revision,draftRevision:revision,publishedRevision:null,publishedAt:null,createdAt:'2026-10-03T00:00:00.000Z',url:'/agent-blog/reviews/qa-components-browser/',data:{title:'请求展示回归草稿',summary:'仅用于当前本地浏览器会话',date:'2026-10-03',source:'本地回归',platforms:['Hermes'],highlights:1},body:'## 完整保存预览\\n后台只读回归内容',html:'<h2>完整保存预览</h2><p>后台只读回归内容</p>',published:null};
 window.__adminFixture=fixture;
 const result=value=>new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}});
 window.fetch=async(input,init)=>{
 const path=new URL(typeof input==='string'?input:input.url,location.origin).pathname;
 if(!path.startsWith('/agent-blog/admin/api/'))return savedFetch(input,init);
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
 })()`);
 click('link','已发布');eventually(()=>mainText().includes('模拟列表读取失败'));
 assert.ok(!mainText().includes('没有符合条件')&&!mainText().includes('读取中'));
 evaluate('window.__adminMockMode="reviews-empty";true');click('button','重新读取');
 eventually(()=>mainText().includes('没有符合条件的工作日志'));assert.ok(!mainText().includes('模拟列表读取失败'));
 evaluate('window.__adminMockMode="reviews-loading";true');browser('fill','input[aria-label=搜索]','loading');
 eventually(()=>evaluate('typeof window.__resolveAdminRequest==="function"'));
 assert.ok(mainText().includes('读取中'));assert.ok(!mainText().includes('没有符合条件')&&!mainText().includes('模拟列表读取失败'));
 evaluate('window.__adminMockMode="ready";window.__resolveAdminRequest();true');eventually(()=>mainText().includes('请求展示回归草稿'));
 evaluate('window.__adminMockMode="episodes-error";true');click('link','播客');eventually(()=>mainText().includes('模拟节目读取失败'));
 assert.ok(!mainText().includes('读取中')&&!mainText().includes('暂无公开节目'));
 evaluate('window.__adminMockMode="episodes-empty";true');click('button','重新读取');eventually(()=>mainText().includes('暂无公开节目'));
 evaluate('window.__adminMockMode="ready";true');click('link','待确认');eventually(()=>mainText().includes('请求展示回归草稿'));evaluate('window.__adminMockMode="detail-error";true');click('link','请求展示回归草稿');
 eventually(()=>mainText().includes('模拟完整预览读取失败'));assert.ok(!mainText().includes('读取完整预览')&&!mainText().includes('完整保存预览'));
 evaluate('window.__adminMockMode="audit-error";true');click('button','重新读取');eventually(()=>mainText().includes('模拟审批记录读取失败'));assert.ok(!mainText().includes('读取完整预览')&&!mainText().includes('完整保存预览'));
 evaluate('window.__adminMockMode="ready";true');click('button','重新读取');eventually(()=>mainText().includes('完整保存预览'));
 assert.equal(evaluate('Array.from(document.querySelectorAll("[role=tabpanel]")).filter(e=>getComputedStyle(e).display!=="none").length'),2,'Desktop must keep two-column panels visible');
 browser('set','viewport','390','844');
 assert.equal(evaluate('Array.from(document.querySelectorAll("[role=tabpanel]")).filter(e=>getComputedStyle(e).display!=="none").length'),1);
 evaluate('document.querySelector("[role=tablist]").focus();true');
 eventually(()=>evaluate('Array.from(document.querySelectorAll("[role=tab]")).filter(e=>e.tabIndex===0).length')===1);
 assert.ok(evaluate('Array.from(document.querySelectorAll("[role=tab]")).every(e=>document.getElementById(e.getAttribute("aria-controls"))?.getAttribute("aria-labelledby")===e.id)'));
 evaluate('window.__adminPreview=document.querySelector(".reading-article");document.querySelector("[role=tab]").focus();true');
 browser('press','ArrowRight');eventually(()=>evaluate('document.querySelector("[role=tab][aria-selected=true]").textContent')==='信息与修订');
 browser('press','Home');eventually(()=>evaluate('document.querySelector("[role=tab][aria-selected=true]").textContent')==='预览');
 browser('press','End');eventually(()=>evaluate('document.querySelector("[role=tab][aria-selected=true]").textContent')==='信息与修订');
 click('button','编辑草稿');eventually(()=>evaluate('!!document.querySelector(".admin-editor input")'));
 browser('fill','.admin-editor input','未保存编辑保留检查');
 evaluate('window.__adminEditor=document.querySelector(".admin-editor input");document.querySelector("[role=tab][aria-selected=true]").focus();true');
 browser('press','ArrowRight');browser('press','ArrowLeft');
 assert.equal(evaluate('window.__adminEditor===document.querySelector(".admin-editor input")'),true,'Tab panels must remain mounted');
 assert.equal(evaluate('window.__adminPreview===document.querySelector(".reading-article")'),true,'Saved article preview must remain mounted');
 assert.equal(evaluate('document.querySelector(".admin-editor input").value'),'未保存编辑保留检查');
 assert.equal(evaluate('Array.from(document.querySelectorAll("button")).find(e=>e.textContent.includes("确认并发布")).disabled'),true,'Dirty edits must disable approval');
 assert.ok(evaluate('document.documentElement.scrollWidth<=innerWidth'));
 console.log('Admin component browser regression passed: mutually exclusive request outcomes/retry, desktop panels, mobile keyboard tabs and mounted dirty edits.');
}catch(error){console.error('Admin regression failure:',browser('snapshot','-i'));console.error(evaluate('({path:location.pathname,mode:window.__adminMockMode,main:document.querySelector("main")?.textContent})'));throw error;}finally{browser('close')}
