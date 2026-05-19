// Lightweight beep sounds via Web Audio (no external files)
let ctx: AudioContext | null = null;
const getCtx = () => {
  if (typeof window === "undefined") return null;
  if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  return ctx;
};

const beep = (freq: number, duration = 120, type: OscillatorType = "sine", volume = 0.15) => {
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.value = volume;
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start();
  gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + duration / 1000);
  osc.stop(c.currentTime + duration / 1000);
};

export const playSuccessSound = () => beep(880, 90, "sine", 0.18);
export const playErrorSound = () => {
  beep(220, 180, "sawtooth", 0.2);
  setTimeout(() => beep(160, 220, "sawtooth", 0.2), 90);
};
