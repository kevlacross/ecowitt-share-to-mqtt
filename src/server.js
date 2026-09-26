import http from "node:http";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { openDatabase } from "./db.js";
import { EcowittShareProvider } from "./ecowitt-share-provider.js";
import { MqttPublisher } from "./mqtt.js";
const port=Number(process.env.PORT||8080), db=openDatabase(), provider=new EcowittShareProvider();
let mqttStatus={connected:false,error:null,lastPublished:null}; const mqtt=new MqttPublisher((x)=>mqttStatus={...mqttStatus,...x});
const settings=()=>db.getSetting("app",{mqtt:{host:"",port:1883,username:"",password:"",tls:false,baseTopic:"ecowitt_share",discoveryPrefix:"homeassistant"},debug:false});
function send(res,status,body){res.writeHead(status,{"content-type":"application/json","cache-control":"no-store"});res.end(JSON.stringify(body));}
async function body(req){let raw="";for await(const chunk of req)raw+=chunk;if(raw.length>100000)throw Error("Request too large");return raw?JSON.parse(raw):{};}
async function sync(id){const station=db.station(id);if(!station)throw Error("Station not found");const started=Date.now();try{const data=await provider.fetchStation(station.share_url,station.device_id);db.upsertSensors(id,data.measurements);db.updateResult(id,{durationMs:Date.now()-started,count:data.measurements.length});const s=db.sensors(id);mqtt.publish(settings(),station,s);mqttStatus.lastPublished=new Date().toISOString();return {measurements:data.measurements.length};}catch(error){db.updateResult(id,{error:error.message,durationMs:Date.now()-started});throw error;}}
async function api(req,res,url){const parts=url.pathname.split("/").filter(Boolean), method=req.method;
 if(method==="GET"&&url.pathname==="/api/status")return send(res,200,{stations:db.stations(),mqtt:mqttStatus});
 if(method==="GET"&&url.pathname==="/api/settings"){const s=settings();if(s.mqtt?.password)s.mqtt.password="";return send(res,200,s);}
 if(method==="PUT"&&url.pathname==="/api/settings"){const next=await body(req),old=settings();if(!next.mqtt?.password)next.mqtt.password=old.mqtt?.password||"";db.setSetting("app",next);return send(res,200,{ok:true});}
 if(method==="POST"&&url.pathname==="/api/mqtt/test"){try{await mqtt.connect(settings());return send(res,200,{ok:true,message:"MQTT connection successful"});}catch(e){return send(res,400,{ok:false,message:e.message});}}
 if(method==="GET"&&url.pathname==="/api/stations")return send(res,200,db.stations());
 if(method==="POST"&&url.pathname==="/api/stations"){const input=await body(req);if(!input.name||!input.shareUrl)throw Error("Name and Share URL are required");const id=db.saveStation(input);return send(res,201,{id});}
 const id=parts[2]; if(parts[1]==="stations"&&id){
   if(method==="PUT"&&parts.length===3){const current=db.station(id);if(!current)throw Error("Station not found");const update=await body(req);const input={...current,...update,id,shareUrl:update.shareUrl||current.share_url};return send(res,200,{id:db.saveStation(input)});}
   if(method==="DELETE"&&parts.length===3){mqtt.clearDiscovery(settings(),db.station(id),db.sensors(id));db.deleteStation(id);return send(res,200,{ok:true});}
   if(method==="GET"&&parts[3]==="sensors")return send(res,200,db.sensors(id));
   if(method==="PUT"&&parts[3]==="sensors"&&parts[4]){db.setSensor(id,decodeURIComponent(parts[4]),await body(req));return send(res,200,{ok:true});}
   if(method==="POST"&&parts[3]==="sync"){try{return send(res,200,{ok:true,...await sync(id)});}catch(e){return send(res,502,{ok:false,error:e.message});}}
   if(method==="POST"&&parts[3]==="discovery"){mqtt.publish(settings(),db.station(id),db.sensors(id));return send(res,200,{ok:true});}
 } send(res,404,{error:"Not found"});
}
const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,`http://${req.headers.host}`);if(url.pathname.startsWith("/api/"))return await api(req,res,url);const file=url.pathname==="/"?"index.html":url.pathname.slice(1);if(file.includes(".."))return send(res,400,{error:"Invalid path"});const data=await readFile(join("public",file));res.writeHead(200,{"content-type":file.endsWith(".js")?"application/javascript":"text/html; charset=utf-8"});res.end(data);}catch(e){send(res,400,{error:e.message});}});
server.listen(port,"0.0.0.0",()=>console.log(`Ecowitt-share_to_MQTT listening on :${port}`));
// Re-establish the persisted broker connection after container restarts. A
// failed initial connection is non-fatal; mqtt.js continues reconnecting and
// station polling remains independent.
if (settings().mqtt?.host) {
  mqtt.connect(settings()).catch(error => console.error(`MQTT startup connection failed: ${error.message}`));
}
const shutdown=async()=>{console.log("Shutdown requested");await mqtt.stop();db.close();server.close(()=>process.exit(0));setTimeout(()=>process.exit(1),8000).unref();};process.on("SIGTERM",shutdown);process.on("SIGINT",shutdown);
setInterval(()=>{for(const st of db.stations().filter(x=>x.enabled)){const due=!st.lastSuccess||Date.now()-Date.parse(st.lastSuccess)>=st.intervalSeconds*1000;if(due)sync(st.id).catch(e=>console.error(`Station ${st.name}: ${e.message}`));}},5000).unref();
