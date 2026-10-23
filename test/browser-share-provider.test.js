import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { BrowserShareProvider, requestFields } from '../src/browser-share-provider.js';
const link='https://www.ecowitt.net/home/share?authorize=TEST123';
function fixture(){
 const browser=new EventEmitter();const page=new EventEmitter();const frame={};let routeHandler;let navigations=0;
 page.mainFrame=()=>frame;page.goto=async url=>{navigations++;await routeHandler({request:()=>({isNavigationRequest:()=>true,frame:()=>frame,url:()=>url}),continue:async()=>{},abort:async()=>{}});};
 const context={newPage:async()=>page,route:async(_,handler)=>{routeHandler=handler;},close:async()=>page.emit('close')};
 browser.newContext=async()=>context;browser.close=async()=>{};
 const response=(path,payload,device='dev')=>({url:()=>`https://www.ecowitt.net/${path}`,ok:()=>true,request:()=>({postData:()=>`authorize=TEST123&device_id=${device}`}),json:async()=>payload});
 return {browser,page,context,response,get navigations(){return navigations},route:()=>routeHandler};
}
async function opened(f){const p=new BrowserShareProvider({launchBrowser:async()=>f.browser,startupTimeoutMs:100});const s=await p.open(link);await s.start;return {p,s};}
const dashboard=n=>({errcode:0,data:{temp:{data:{tempf:{value:n,unit:'°C'}}}}});

test('one page stays open across reads and accepts browser updates without polling',async()=>{
 const f=fixture();const {p,s}=await opened(f);
 await p.accept(s,f.response('index/get_device_list',{errcode:0,list:[{device_id:'dev',share_id:'shared',name:'Garden'}]}));
 await p.accept(s,f.response('index/home',dashboard(12)));
 assert.equal((await p.fetchStation(link)).measurements[0].value,12);
 assert.equal((await p.fetchStation(link)).measurements[0].value,12);
 await p.accept(s,f.response('index/home',dashboard(13)));
 assert.equal((await p.fetchStation(link)).measurements[0].value,13);
 assert.equal(f.navigations,1);assert.equal(p.diagnostics(link).initializations,1);await p.close();
});

test('a real reload attempt is blocked without consuming another page opening',async()=>{
 const f=fixture();const {p,s}=await opened(f);let aborted=false;
 await f.route()({request:()=>({isNavigationRequest:()=>true,frame:()=>f.page.mainFrame(),url:()=>link}),abort:async()=>{aborted=true;},continue:async()=>assert.fail()});
 assert.ok(aborted);assert.equal(p.diagnostics(link).initializations,1);
 await assert.rejects(p.fetchStation(link),/reload/);assert.equal(f.navigations,1);await p.close();
});

test('startup timeout and a page crash never reopen the share automatically',async()=>{
 const f=fixture();const {p}=await opened(f);
 await assert.rejects(p.fetchStation(link),/Waiting/);
 f.page.emit('crash');await assert.rejects(p.fetchStation(link),/crashed/);
 assert.equal(f.navigations,1);await p.close();
});

test('a new provider after a container restart counts a new page opening',async()=>{
 const f=fixture();const {p}=await opened(f);const saved=structuredClone(p.activity);await p.close();
 const g=fixture();const restarted=new BrowserShareProvider({launchBrowser:async()=>g.browser,savedActivity:saved});const s=await restarted.open(link);await s.start;
 assert.equal(restarted.diagnostics(link).initializations,2);await restarted.close();
});

test('explicit reopen counts once more; cached reads do not',async()=>{
 const f=fixture();const {p}=await opened(f);await p.release(link);const s=await p.open(link);await s.start;
 assert.equal(p.diagnostics(link).initializations,2);await p.close();
});

test('parses Ecowitt multipart fields without exposing credentials',()=>{
 const body='--bound\r\nContent-Disposition: form-data; name="authorize"\r\n\r\nTEST123\r\n--bound\r\nContent-Disposition: form-data; name="device_id"\r\n\r\ndev\r\n--bound--';
 const fields=requestFields({postData:()=>body});assert.equal(fields.get('authorize'),'TEST123');assert.equal(fields.get('device_id'),'dev');
});

test('rejects unrelated responses and flags stale snapshots without reloading',async()=>{
 const f=fixture();let now=1000;const p=new BrowserShareProvider({launchBrowser:async()=>f.browser,now:()=>now,staleMs:100});const s=await p.open(link);await s.start;
 await p.accept(s,f.response('index/home',dashboard(12)));now+=101;
 await assert.rejects(p.fetchStation(link),/fresh/);assert.equal(f.navigations,1);await p.close();
});
