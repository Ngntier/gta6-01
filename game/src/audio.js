// All sound is synthesized with the Web Audio API — no audio files, no network.
// Engine hum, siren, gunshots, crashes, chimes and a soft synthwave pad loop.
// The context starts on the first user gesture; everything is a no-op before that.
import { STEP } from './config.js';

const MUSIC_NOTES = [
  // A slow, warm progression: Am9 — Fmaj7 — Cmaj7 — G6, one chord a bar.
  [110.0, 164.81, 246.94, 329.63],
  [87.31, 174.61, 220.0, 329.63],
  [130.81, 196.0, 261.63, 329.63],
  [98.0, 196.0, 246.94, 329.63],
];

export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let engineFilter = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = null;
  let musicTimer = null;
  let musicStep = 0;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, gain, slideTo, when = 0) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, gain, filterFreq, type = 'lowpass') {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start(t0);
  }

  function startMusic() {
    if (!ctx || musicTimer) return;
    musicTimer = setInterval(() => {
      if (muted) return;
      const chord = MUSIC_NOTES[musicStep % MUSIC_NOTES.length];
      musicStep += 1;
      for (const f of chord) tone(f, 3.4, 'triangle', 0.045);
      tone(chord[0] / 2, 3.2, 'sine', 0.05);
    }, 3200);
  }

  return {
    /** Start the audio context (call from a user gesture) and the music loop. */
    start() {
      if (!ensure()) return;
      if (ctx.state === 'suspended') ctx.resume();
      startMusic();
    },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = muted ? 0 : 0.5;
      if (muted) this.engine(0, false);
    },
    isMuted() {
      return muted;
    },
    /** Engine hum: speed01 0..1, on while driving. */
    engine(speed01, on) {
      if (!ctx) return;
      if (!on || muted) {
        if (engineGain) engineGain.gain.value = 0;
        return;
      }
      if (!engineOsc) {
        engineOsc = ctx.createOscillator();
        engineOsc.type = 'sawtooth';
        engineFilter = ctx.createBiquadFilter();
        engineFilter.type = 'lowpass';
        engineFilter.frequency.value = 420;
        engineGain = ctx.createGain();
        engineGain.gain.value = 0;
        engineOsc.connect(engineFilter);
        engineFilter.connect(engineGain);
        engineGain.connect(master);
        engineOsc.start();
      }
      engineOsc.frequency.value = 55 + speed01 * 130;
      engineFilter.frequency.value = 300 + speed01 * 900;
      engineGain.gain.value = 0.05 + speed01 * 0.05;
    },
    /** Police siren: on while any cop car is near. */
    siren(on) {
      if (!ctx) return;
      if (!on || muted) {
        if (sirenGain) sirenGain.gain.value = 0;
        return;
      }
      if (!sirenOsc) {
        sirenOsc = ctx.createOscillator();
        sirenOsc.type = 'square';
        sirenGain = ctx.createGain();
        sirenGain.gain.value = 0;
        sirenOsc.connect(sirenGain);
        sirenGain.connect(master);
        sirenOsc.start();
        let high = false;
        sirenTimer = setInterval(() => {
          high = !high;
          if (sirenOsc) sirenOsc.frequency.value = high ? 880 : 660;
        }, 380);
      }
      sirenGain.gain.value = 0.03;
    },
    shoot() {
      noise(0.12, 0.35, 3200, 'highpass');
      tone(140, 0.1, 'square', 0.18, 60);
    },
    crash(hard) {
      noise(hard ? 0.3 : 0.15, hard ? 0.5 : 0.25, 500);
      tone(70, 0.2, 'sine', 0.3, 40);
    },
    explosion() {
      noise(0.7, 0.6, 300);
      tone(50, 0.6, 'sine', 0.5, 28);
    },
    pickup() {
      tone(880, 0.09, 'sine', 0.2);
      tone(1318, 0.14, 'sine', 0.2, null, 0.08);
    },
    cash() {
      tone(1046, 0.08, 'triangle', 0.22);
      tone(1568, 0.12, 'triangle', 0.22, null, 0.07);
    },
    missionStart() {
      tone(523, 0.12, 'triangle', 0.22);
      tone(659, 0.12, 'triangle', 0.22, null, 0.11);
      tone(784, 0.2, 'triangle', 0.22, null, 0.22);
    },
    missionComplete() {
      const notes = [523, 659, 784, 1046];
      notes.forEach((f, i) => tone(f, 0.22, 'triangle', 0.24, null, i * 0.13));
    },
    missionFail() {
      tone(392, 0.25, 'sawtooth', 0.16, 300);
      tone(311, 0.4, 'sawtooth', 0.16, 220, 0.22);
    },
    wasted() {
      tone(220, 0.5, 'sawtooth', 0.2, 110);
      tone(165, 0.7, 'sawtooth', 0.2, 82, 0.4);
    },
    click() {
      tone(660, 0.06, 'square', 0.12);
    },
    honk() {
      tone(370, 0.18, 'square', 0.14);
      tone(466, 0.18, 'square', 0.1, null, 0.02);
    },
    skid() {
      noise(0.18, 0.12, 1800, 'bandpass');
    },
    /** Keep the engine/siren gains in sync every frame (cheap no-op when off). */
    tick() {
      if (!ctx) return;
      // The per-frame engine call in world.js drives the hum; nothing else here.
      void STEP;
    },
  };
}
