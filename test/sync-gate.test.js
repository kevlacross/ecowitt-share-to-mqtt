import test from "node:test";
import assert from "node:assert/strict";
import { SyncGate } from "../src/sync-gate.js";

test("manual and automatic requests join the same in-flight sync", async()=>{
 const gate=new SyncGate();let calls=0,finish;
 const first=gate.run("station",()=>{calls++;return new Promise(resolve=>finish=resolve);});
 const second=gate.run("station",()=>{calls++;});
 assert.equal(first,second);await Promise.resolve();assert.equal(calls,1);
 finish(48);assert.equal(await second,48);assert.equal(gate.ready("station"),true);
});

test("backs off repeated failures, caps the delay and recovers after success",async()=>{
 let now=0;const gate=new SyncGate({now:()=>now,retryMs:60,maxRetryMs:240});let calls=0;
 const fail=()=>{calls++;throw Error("offline");};
 for(const delay of [60,120,240,240]){
  await assert.rejects(gate.run("s",fail),/offline/);
  await assert.rejects(gate.run("s",fail),/paused/);
  assert.equal(gate.ready("other"),true);
  now+=delay-1;assert.equal(gate.ready("s"),false);now++;assert.equal(gate.ready("s"),true);
 }
 assert.equal(calls,4);await gate.run("s",()=>48);assert.equal(gate.ready("s"),true);
 await assert.rejects(gate.run("s",fail));now+=60;assert.equal(gate.ready("s"),true);
});

test("an unusable share stays paused until configuration changes",async()=>{
 let now=0;const gate=new SyncGate({now:()=>now});
 await assert.rejects(gate.run("s",()=>{throw Object.assign(Error("no stations"),{retryable:false});}));
 now=10**12;assert.equal(gate.ready("s"),false);
 gate.reset("s");assert.equal(gate.ready("s"),true);
});
