import test from "node:test";
import assert from "node:assert/strict";
import { EcowittShareProvider, normalizeDashboard } from "../src/ecowitt-share-provider.js";
import { sensorLabel } from "../src/sensor-labels.js";

test("parses share link without leaking its token", () => {
  const provider = new EcowittShareProvider();
  assert.deepEqual(provider.parseShareUrl("https://www.ecowitt.net/home/share?authorize=ABC123&device_id=device"), { authorize: "ABC123", deviceId: "device" });
  assert.throws(() => provider.parseShareUrl("https://example.test/home/share?authorize=ABC123"));
});

test("uses localized, meaningful labels while retaining stable IDs", () => {
  assert.equal(sensorLabel("baromabs_increment", "Absolute", "de"), "Absoluter Luftdruck – Änderung");
  assert.equal(sensorLabel("dailyrain", "Daily", "en"), "Daily rain");
  assert.equal(sensorLabel("baromabsin_daily_max", "Daily max", "de"), "Absoluter Luftdruck – Tagesmaximum");
  assert.equal(sensorLabel("max_daily_tempf", "Daily max", "de"), "Außentemperatur – Tagesmaximum");
  assert.equal(sensorLabel("dailyrainin", "Daily", "de"), "Tagesregen");
  assert.equal(sensorLabel("baromabsin_increment", "Absolute", "de"), "Absoluter Luftdruck – Änderung");
  assert.equal(sensorLabel("soilmoisture2", "", "de"), "Bodenfeuchte 2");
  const value = normalizeDashboard({ rain: { data: { dailyrain: { name: "dailyrain", title: "Daily", value: "0", unit: "mm" } } } }, "de")[0];
  assert.equal(value.name, "Tagesregen");
  assert.equal(value.stableId, "ecowitt:rain:dailyrain");
});

test("normalizes dynamic groups, decimal commas and non-numeric battery state", () => {
  const values = normalizeDashboard({ outdoor: { data: { tempf: { name: "tempf", title_custom: "Temperature", value: "19,7", unit: "°C", time: "now" } } }, batt: { data: { wh65batt: { value: "Normal", unit: "", batt_type: "Normal" } } } });
  assert.equal(values[0].value, 19.7);
  assert.equal(values[0].stableId, "ecowitt:outdoor:tempf");
  assert.equal(values[1].value, "Normal");
});

const share = "https://www.ecowitt.net/home/share?authorize=TEST123";
function fakeFetch(calls) {
  return async (url, options) => {
    calls.push({path:new URL(url).pathname, fields:Object.fromEntries(options.body)});
    return {ok:true, json:async()=>url.endsWith("get_device_list") ? {errcode:0,list:[{device_id:"device",share_id:"shared",name:"Garden"}]} : {errcode:0,data:{outdoor:{data:{temp:{value:20}}}}}};
  };
}

test("resolves a share once across polls, manual listing and process restarts", async () => {
  const calls=[];let saved;
  const provider=new EcowittShareProvider({fetchImpl:fakeFetch(calls),saveStations:value=>saved=value});
  await provider.fetchStation(share);
  await provider.fetchStation(share);
  await provider.listStations(share);
  assert.equal(calls.filter(x=>x.path.endsWith("get_device_list")).length,1);
  assert.equal(calls.filter(x=>x.path.endsWith("/home")).length,2);
  assert.ok(!JSON.stringify(saved).includes("TEST123"));
  const restarted=new EcowittShareProvider({fetchImpl:fakeFetch(calls),savedStations:saved});
  await restarted.fetchStation(share);
  assert.equal(calls.filter(x=>x.path.endsWith("get_device_list")).length,1);
});

test("concurrent first reads share one discovery; changed links get their own state", async () => {
  const calls=[];
  const provider=new EcowittShareProvider({fetchImpl:fakeFetch(calls)});
  await Promise.all([provider.fetchStation(share),provider.fetchStation(share)]);
  assert.equal(calls.filter(x=>x.path.endsWith("get_device_list")).length,1);
  await provider.fetchStation(share.replace("TEST123","NEW123"));
  assert.equal(calls.filter(x=>x.path.endsWith("get_device_list")).length,2);
});

test("a failed dashboard does not rediscover or reopen its share", async () => {
  const calls=[];const base=fakeFetch(calls);let fail=false;
  const provider=new EcowittShareProvider({fetchImpl:async (...args)=>{
    if(fail && args[0].endsWith("/home")) return {ok:false,status:503};
    return base(...args);
  }});
  await provider.fetchStation(share);fail=true;
  await assert.rejects(provider.fetchStation(share),/503/);
  fail=false;await provider.fetchStation(share);
  assert.equal(calls.filter(x=>x.path.endsWith("get_device_list")).length,1);
});

test("recognizes share errors without displaying upstream credentials", async () => {
  const provider=new EcowittShareProvider({fetchImpl:async()=>({ok:true,json:async()=>({error:{errmsg:"secret TEST123",residence_time:1000}})})});
  await assert.rejects(provider.fetchStation(share),error=>!error.message.includes("TEST123") && error.message.includes("remaining openings"));
});

test("an empty/exhausted share is not reopened, even after a restart", async()=>{
 let calls=0,saved;
 const fetchImpl=async()=>{calls++;return {ok:true,json:async()=>({errcode:0,list:[]})};};
 const provider=new EcowittShareProvider({fetchImpl,saveStations:value=>saved=value});
 for(let i=0;i<2;i++) await assert.rejects(provider.fetchStation(share),e=>e.retryable===false);
 const restarted=new EcowittShareProvider({fetchImpl,savedStations:saved});
 await assert.rejects(restarted.fetchStation(share),/polling paused/);
 assert.equal(calls,1);
});

test("separate attempt counters survive restarts and do not expose a token",async()=>{
 const calls=[];let saved,activity;
 const provider=new EcowittShareProvider({fetchImpl:fakeFetch(calls),saveStations:value=>saved=value,saveActivity:value=>activity=structuredClone(value)});
 await provider.fetchStation(share);await provider.fetchStation(share);
 let state=provider.diagnostics(share);assert.equal(state.initializations,1);assert.equal(state.measurementRequests,2);assert.equal(state.remainingOpenings,null);assert.ok(state.since);
 const restarted=new EcowittShareProvider({fetchImpl:fakeFetch(calls),savedStations:saved,savedActivity:activity});
 await restarted.fetchStation(share);state=restarted.diagnostics(share);
 assert.equal(state.initializations,1);assert.equal(state.measurementRequests,3);assert.ok(!JSON.stringify(activity).includes('TEST123'));
});
