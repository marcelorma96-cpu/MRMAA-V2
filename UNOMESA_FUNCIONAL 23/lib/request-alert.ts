export function requestAlertSettings(value: unknown) {
  const v = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const interval = Number(v.interval), volume = Number(v.volume);
  return { enabled: v.enabled !== false, interval: [5,10,20,30].includes(interval) ? interval : 10,
    volume: Number.isFinite(volume) && v.volume !== undefined ? Math.max(0,Math.min(100,volume)) : 65 };
}

/** A short two-note chime, repeated by the mounted notice. No audio downloads. */
export function requestChime(context: AudioContext, volume: number) {
  if(context.state !== 'running' || volume <= 0) return;
  [660,880].forEach((frequency,index)=>{
    const oscillator=context.createOscillator(), gain=context.createGain();
    const start=context.currentTime+index*.2;
    oscillator.type='sine'; oscillator.frequency.value=frequency;
    gain.gain.setValueAtTime(0,start);
    gain.gain.linearRampToValueAtTime(volume/100*.16,start+.025);
    gain.gain.exponentialRampToValueAtTime(.0001,start+.3);
    oscillator.connect(gain);gain.connect(context.destination);
    oscillator.onended=()=>{oscillator.disconnect();gain.disconnect()};
    oscillator.start(start);oscillator.stop(start+.32);
  });
}

/** Loop includes the silent gap; it does not depend on throttled JS timers. */
export function startRequestAlert(context: AudioContext, volume: number, interval: number): () => void {
  if(context.state !== 'running' || volume <= 0) return ()=>{};
  const seconds=[5,10,20,30].includes(interval)?interval:10,rate=22050;
  const buffer=context.createBuffer(1,seconds*rate,rate),samples=buffer.getChannelData(0);
  [660,880].forEach((frequency,index)=>{
    const offset=Math.round(index*.2*rate),length=Math.round(.32*rate);
    for(let i=0;i<length;i++){
      const time=i/rate;
      const envelope=Math.min(1,time/.025)*Math.exp(-time*24);
      samples[offset+i]+=.16*envelope*Math.sin(2*Math.PI*frequency*time);
    }
  });
  const source=context.createBufferSource(),gain=context.createGain();
  source.buffer=buffer;source.loop=true;source.loopStart=0;source.loopEnd=seconds;
  gain.gain.value=Math.max(0,Math.min(100,volume))/100;
  source.connect(gain);gain.connect(context.destination);source.start();
  let stopped=false;
  return()=>{if(stopped)return;stopped=true;source.stop();source.disconnect();gain.disconnect()};
}
