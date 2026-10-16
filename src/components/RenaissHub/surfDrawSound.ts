// Small gesture-unlocked Web Audio cues keep the ceremony in sync without
// loading another media asset or sending sound through the application server.
type Cue = 'box-open' | 'foil-tear' | 'card-flip' | 'flip-all';

let audio: AudioContext | null = null;
let noise: AudioBuffer | null = null;
const preferenceKey = 'renaiss:surf-draw-sound-enabled';

export function isSurfDrawSoundEnabled() {
  return typeof window === 'undefined' || window.localStorage.getItem(preferenceKey) !== 'false';
}

export function setSurfDrawSoundEnabled(enabled: boolean) {
  window.localStorage.setItem(preferenceKey, String(enabled));
  if (!enabled && audio?.state === 'running') void audio.suspend();
}

export function unlockSurfDrawSound() {
  if (typeof window === 'undefined' || !window.AudioContext || !isSurfDrawSoundEnabled()) return;
  audio ??= new AudioContext();
  if (audio.state === 'suspended') void audio.resume();
}

function whiteNoise(context: AudioContext) {
  if (noise) return noise;
  const length = Math.round(context.sampleRate * .8);
  noise = context.createBuffer(1, length, context.sampleRate);
  const samples = noise.getChannelData(0);
  for (let index = 0; index < length; index++) samples[index] = Math.random() * 2 - 1;
  return noise;
}

function rustle(context: AudioContext, at: number, duration: number, frequency: number, volume: number) {
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const envelope = context.createGain();
  source.buffer = whiteNoise(context);
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(frequency, at);
  filter.Q.value = .65;
  envelope.gain.setValueAtTime(.0001, at);
  envelope.gain.exponentialRampToValueAtTime(volume, at + Math.min(.035, duration / 3));
  envelope.gain.exponentialRampToValueAtTime(.0001, at + duration);
  source.connect(filter).connect(envelope).connect(context.destination);
  source.start(at);
  source.stop(at + duration);
  source.onended = () => { source.disconnect(); filter.disconnect(); envelope.disconnect(); };
}

function tone(context: AudioContext, at: number, duration: number, from: number, to: number, volume: number) {
  const source = context.createOscillator();
  const envelope = context.createGain();
  source.type = 'sine';
  source.frequency.setValueAtTime(from, at);
  source.frequency.exponentialRampToValueAtTime(to, at + duration);
  envelope.gain.setValueAtTime(volume, at);
  envelope.gain.exponentialRampToValueAtTime(.0001, at + duration);
  source.connect(envelope).connect(context.destination);
  source.start(at);
  source.stop(at + duration);
  source.onended = () => { source.disconnect(); envelope.disconnect(); };
}

export function playSurfDrawSound(cue: Cue) {
  if (document.hidden || !isSurfDrawSoundEnabled() || !audio || audio.state !== 'running') return;
  const at = audio.currentTime + .01;
  if (cue === 'box-open') {
    rustle(audio, at, .13, 1100, .065);
    tone(audio, at + .05, .22, 140, 64, .09);
    rustle(audio, at + .14, .3, 2300, .052);
  } else if (cue === 'foil-tear') {
    rustle(audio, at, .47, 3000, .085);
    rustle(audio, at + .2, .22, 1700, .045);
    tone(audio, at + .43, .12, 730, 420, .025);
  } else if (cue === 'flip-all') {
    rustle(audio, at, .37, 2200, .05);
    tone(audio, at + .18, .25, 570, 820, .025);
  } else {
    rustle(audio, at, .14, 1900, .05);
    tone(audio, at + .07, .13, 750, 520, .025);
  }
}
