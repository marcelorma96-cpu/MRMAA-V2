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
