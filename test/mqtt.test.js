import test from 'node:test';
import assert from 'node:assert/strict';
import { MqttPublisher } from '../src/mqtt.js';

test('publishes retained diagnostics on the same HA device and cleans up discovery',()=>{
 const messages=[];const publisher=new MqttPublisher();publisher.connected=true;
 publisher.client={publish:(topic,payload,options)=>messages.push({topic,payload,options})};
 const station={id:'station-1',name:'Garden'},settings={mqtt:{baseTopic:'weather',discoveryPrefix:'homeassistant'}};
 publisher.publishActivity(settings,station,{since:'2026-10-22T08:00:00Z',initializations:1,measurementRequests:12});
 const configs=messages.filter(x=>x.topic.endsWith('/config'));
 assert.equal(configs.length,2);
 for(const message of configs){const config=JSON.parse(message.payload);assert.equal(config.entity_category,'diagnostic');assert.equal(config.state_class,'total_increasing');assert.deepEqual(config.device.identifiers,['ecowitt_share_station-1']);assert.equal(message.options.retain,true);}
 assert.equal(messages.find(x=>x.topic==='weather/station_1/share_initializations/state').payload,'1');
 assert.equal(messages.find(x=>x.topic==='weather/station_1/measurement_requests/state').payload,'12');
 const attrs=JSON.parse(messages.find(x=>x.topic.endsWith('/attributes')).payload);
 assert.equal(attrs.remaining_openings,null);assert.equal(attrs.recording_since,'2026-10-22T08:00:00Z');
 messages.length=0;publisher.clearDiscovery(settings,station,[]);
 assert.equal(messages.length,2);assert.ok(messages.every(x=>x.payload==='' && x.options.retain));
});

test('does not publish diagnostics while disconnected',()=>{
 const publisher=new MqttPublisher();publisher.client={publish:()=>assert.fail('unexpected MQTT write')};
 publisher.publishActivity({}, {id:'station'}, {initializations:1,measurementRequests:2});
});
