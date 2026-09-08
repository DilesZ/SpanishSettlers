// Música ambiental generativa (100% WebAudio, sin assets).
// Laud medieval: paseo aleatorio por modo dórico + bordón grave + pad.
export const DORIAN = [0, 2, 3, 5, 7, 9, 10, 12, 14, 15, 17, 19, 21, 22, 24];
export const BASE_FREQ = 196; // Sol grave

/** Paso de random-walk sobre la escala (testeable). */
export function melodyStep(current: number, rand: () => number = Math.random): number {
  const move = rand();
  const delta = move < 0.15 ? -2 : move < 0.4 ? -1 : move < 0.75 ? 1 : 2;
  const next = current + delta;
  if (next < 0) return 1;
  if (next >= DORIAN.length) return DORIAN.length - 3;
  return next;
}

export function degreeToFreq(degree: number): number {
  return BASE_FREQ * Math.pow(2, DORIAN[degree] / 12);
}

interface MusicState {
  ctx: AudioContext | null;
  master: GainNode | null;
  enabled: boolean;
  degree: number;
  timer: ReturnType<typeof setInterval> | null;
}

const state: MusicState = {
  ctx: null,
  master: null,
  enabled: typeof window !== 'undefined' && window.localStorage.getItem('spanish-settlers-music') !== 'off',
  degree: 7,
  timer: null,
};

export function isMusicEnabled(): boolean {
  return state.enabled;
}

function ensureCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!state.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      state.ctx = new AC();
      state.master = state.ctx.createGain();
      state.master.gain.value = 0.14;
      state.master.connect(state.ctx.destination);
      startDrone();
    }
    if (state.ctx.state === 'suspended') void state.ctx.resume();
    return state.ctx;
  } catch {
    return null;
  }
}

/** Bordón grave continuo (Sol + Re). */
function startDrone() {
  const ctx = state.ctx;
  const out = state.master;
  if (!ctx || !out) return;
  for (const [mult, gain] of [[1, 0.05], [1.5, 0.03]] as const) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = BASE_FREQ * mult;
    const g = ctx.createGain();
    g.gain.value = gain;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoG = ctx.createGain();
    lfoG.gain.value = gain * 0.5;
    lfo.connect(lfoG);
    lfoG.connect(g.gain);
    osc.connect(g);
    g.connect(out);
    osc.start();
    lfo.start();
  }
}

function pluck(freq: number, when: number, vol: number) {
  const ctx = state.ctx;
  const out = state.master;
  if (!ctx || !out) return;
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, when);
  g.gain.linearRampToValueAtTime(vol, when + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, when + 2.8);
  osc.connect(g);
  g.connect(out);
  osc.start(when);
  osc.stop(when + 3);
}

/** Arranca el generador (llamar tras un gesto del usuario). */
export function startMusic() {
  if (!state.enabled || state.timer || typeof window === 'undefined') return;
  const ctx = ensureCtx();
  if (!ctx) return;
  state.timer = setInterval(() => {
    if (!state.enabled || !state.ctx || document.hidden) return;
    // noche: más espaciado y grave (lee el cielo si existe)
    const sky = (window as unknown as { __sky?: { alpha: number } }).__sky;
    const night = sky ? Math.min(1, sky.alpha * 2.4) : 0;
    if (Math.random() < 0.25 + night * 0.2) return; // silencios
    state.degree = melodyStep(state.degree);
    const freq = degreeToFreq(state.degree) * (night > 0.5 ? 0.5 : 1);
    pluck(freq, state.ctx.currentTime, 0.5 - night * 0.15);
    if (Math.random() < 0.3) {
      pluck(freq * 1.5, state.ctx.currentTime + 0.35, 0.25);
    }
  }, 2600);
}

export function setMusicEnabled(on: boolean) {
  state.enabled = on;
  try {
    window.localStorage.setItem('spanish-settlers-music', on ? 'on' : 'off');
  } catch { /* noop */ }
  if (on) {
    startMusic();
  } else if (state.timer) {
    clearInterval(state.timer);
    state.timer = null;
  }
}
