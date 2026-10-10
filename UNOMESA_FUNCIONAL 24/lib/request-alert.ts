export function requestAlertSettings(value: unknown) {
  const v = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const interval = Number(v.interval), volume = Number(v.volume);
  return { enabled: v.enabled !== false, interval: [5,10,20,30].includes(interval) ? interval : 10,
    volume: Number.isFinite(volume) && v.volume !== undefined && v.volume !== null ? Math.max(0,Math.min(100,volume)) : 65 };
}

/** PCM WAV with two notes followed by silence. Gain is encoded for iOS, which
 * controls HTML audio volume at device level. No downloads or AudioContext. */
export function requestAlertWav(seconds: number, volume: number): ArrayBuffer {
  const rate=16000, duration=[1,5,10,20,30].includes(seconds)?seconds:10;
  const frames=duration*rate,bytes=new ArrayBuffer(44+frames*2),view=new DataView(bytes);
  const text=(offset:number,value:string)=>{for(let i=0;i<value.length;i++)view.setUint8(offset+i,value.charCodeAt(i))};
  text(0,'RIFF');view.setUint32(4,36+frames*2,true);text(8,'WAVE');text(12,'fmt ');
  view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);
  view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);
  text(36,'data');view.setUint32(40,frames*2,true);
  const gain=Math.max(0,Math.min(100,volume))/100;
  [660,880].forEach((frequency,n)=>{
    const offset=Math.round(n*.34*rate),length=Math.round(.3*rate);
    for(let i=0;i<length;i++){
      const t=i/rate,envelope=Math.min(1,t/.012)*Math.pow(1-t/.3,1.6);
      const sample=.6*gain*envelope*Math.sin(2*Math.PI*frequency*t);
      view.setInt16(44+(offset+i)*2,Math.round(sample*32767),true);
    }
  });
  return bytes;
}
