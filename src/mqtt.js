import mqtt from "mqtt";
import { createHash } from "node:crypto";
import { homeAssistantMetadata } from "./home-assistant.js";
const slug = (value) => String(value).toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"") || "sensor";
const escapeTopic = (value) => String(value).replace(/[#+]/g, "_");
export class MqttPublisher {
  constructor(onStatus=()=>{}) { this.client=null; this.onStatus=onStatus; this.connected=false; }
  config(settings) { return settings.mqtt || {}; }
  async connect(settings) {
    const c=this.config(settings); if (!c.host) throw new Error("MQTT host is not configured");
    await this.stop();
    const protocol=c.tls ? "mqtts" : "mqtt";
    this.client=mqtt.connect(`${protocol}://${c.host}:${c.port|| (c.tls?8883:1883)}`, { username:c.username||undefined,password:c.password||undefined,reconnectPeriod:2000,connectTimeout:10000,will:{topic:`${escapeTopic(c.baseTopic||"ecowitt_share")}/availability`,payload:"offline",retain:true} });
    this.client.on("connect",()=>{this.connected=true;this.onStatus({connected:true,error:null});this.client.publish(`${escapeTopic(c.baseTopic||"ecowitt_share")}/availability`,"online",{retain:true});});
    this.client.on("error",e=>this.onStatus({connected:false,error:e.message})); this.client.on("close",()=>{this.connected=false;this.onStatus({connected:false});});
    await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error("MQTT connection timeout")),11000);this.client.once("connect",()=>{clearTimeout(timer);resolve()});this.client.once("error",e=>{clearTimeout(timer);reject(e)})});
  }
  async stop() { if(this.client) await this.client.endAsync(true); this.client=null; this.connected=false; }
  publish(settings, station, sensors) {
    if(!this.connected) return; const c=this.config(settings), base=escapeTopic(c.baseTopic||"ecowitt_share"), discovery=escapeTopic(c.discoveryPrefix||"homeassistant"), stationKey=slug(station.id);
    for(const sensor of sensors.filter(s=>s.enabled)) { const key=slug(sensor.stableId), id=`ecowitt_share_${stationKey}_${key}`, state=`${base}/${stationKey}/${key}/state`, label=sensor.customName||sensor.name;
      const config={name:label,unique_id:id,state_topic:state,availability_topic:`${base}/availability`,...homeAssistantMetadata(sensor),device:{identifiers:[`ecowitt_share_${station.id}`],name:station.name,manufacturer:"Ecowitt",model:"Shared Station"}};
      this.client.publish(`${discovery}/sensor/${id}/config`,JSON.stringify(config),{retain:true}); this.client.publish(state,String(sensor.value),{retain:true});
    }
  }
  clearDiscovery(settings,station,sensors){ if(!this.client) return;const c=this.config(settings),p=escapeTopic(c.discoveryPrefix||"homeassistant"),sk=slug(station.id);for(const s of sensors){const id=`ecowitt_share_${sk}_${slug(s.stableId)}`;this.client.publish(`${p}/sensor/${id}/config`,"",{retain:true});}}
}
