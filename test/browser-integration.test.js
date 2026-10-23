import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { BrowserShareProvider } from '../src/browser-share-provider.js';

test('real Chromium keeps one local document open while the page updates its own data', {skip:process.env.TEST_BROWSER!=='1'}, async()=>{
 let documents=0,measurements=0;
 const server=http.createServer((req,res)=>{
  if(req.url.startsWith('/home/share')){
   documents++;res.setHeader('Content-Type','text/html');res.end(`<html><body>fixture<script>
   async function post(path){const f=new FormData();f.set('authorize','TEST123');f.set('device_id','dev');await fetch('/index/'+path,{method:'POST',body:f});}
   (async()=>{await post('get_device_list');await post('home');setInterval(()=>post('home'),150)})();
   </script></body></html>`);return;
  }
  res.setHeader('Content-Type','application/json');
  if(req.url==='/index/get_device_list')res.end(JSON.stringify({errcode:0,list:[{device_id:'dev',share_id:'shared',name:'Fixture'}]}));
  else if(req.url==='/index/home'){measurements++;res.end(JSON.stringify({errcode:0,data:{temp:{data:{tempf:{value:measurements,unit:'°C'}}}}}));}
  else {res.statusCode=404;res.end('{}');}
 });
 server.listen(0,'127.0.0.1');await once(server,'listening');
 const baseUrl=`http://127.0.0.1:${server.address().port}`;
 class FixtureProvider extends BrowserShareProvider {parseShareUrl(value){const u=new URL(value);assert.equal(u.origin,baseUrl);return {authorize:u.searchParams.get('authorize'),deviceId:null};}}
 const provider=new FixtureProvider({baseUrl,startupTimeoutMs:15000});
 try{
  const url=baseUrl+'/home/share?authorize=TEST123';const first=await provider.fetchStation(url);
  let current=first;
  for(let i=0;i<30 && current.measurements[0].value<=first.measurements[0].value;i++){
   await new Promise(resolve=>setTimeout(resolve,100));current=await provider.fetchStation(url);
  }
  assert.ok(current.measurements[0].value>first.measurements[0].value);
  assert.equal(documents,1);assert.equal(provider.diagnostics(url).initializations,1);assert.ok(provider.diagnostics(url).measurementRequests>=2);
  const session=[...provider.sessions.values()][0];await session.page.reload().catch(()=>{});
  assert.equal(documents,1);assert.equal(provider.diagnostics(url).initializations,1);assert.equal(session.status,'paused');
 }finally{await provider.close();await new Promise(resolve=>server.close(resolve));}
});
