// SFX CC0 (Kenney) con HTMLAudio + precarga. Se desbloquea con el primer gesto.
const FILES: Record<string, string> = {
  click: '/assets/audio/click.ogg',
  select: '/assets/audio/select.ogg',
  confirm: '/assets/audio/confirm.ogg',
  built: '/assets/audio/built.ogg',
  error: '/assets/audio/error.ogg',
  chop: '/assets/audio/chop.ogg',
  sword: '/assets/audio/sword.ogg',
  pluck: '/assets/audio/pluck.ogg',
  splash: '/assets/audio/splash.ogg',
};

const cache = new Map<string, HTMLAudioElement>();
let unlocked = false;

export function unlockAudio() {
  if (unlocked || typeof window === 'undefined') return;
  unlocked = true;
  for (const [name, file] of Object.entries(FILES)) {
    const a = new Audio(file);
    a.preload = 'auto';
    a.volume = name === 'error' ? 0.5 : 0.7;
    cache.set(name, a);
  }
}

let actx: AudioContext | null = null;

/**
 * Blips procedurales WebAudio (R1, sin assets): pop al entregar, coin al
 * completar quest/obra, horn grave al avistar rival u oleada. El audio nunca
 * debe romper el juego: todo envuelto en try/catch y no-op sin gesto.
 */
export function playBlip(kind: 'pop' | 'coin' | 'horn' | 'bell') {
  try {
    if (typeof window === 'undefined') return;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    actx ??= new AC();
    if (actx.state === 'suspended') void actx.resume().catch(() => undefined);
    const t0 = actx.currentTime;
    const osc = actx.createOscillator();
    const gain = actx.createGain();
    osc.connect(gain);
    gain.connect(actx.destination);
    if (kind === 'pop') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, t0);
      osc.frequency.exponentialRampToValueAtTime(880, t0 + 0.08);
      gain.gain.setValueAtTime(0.18, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.12);
      osc.start(t0);
      osc.stop(t0 + 0.13);
    } else if (kind === 'coin') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, t0);
      osc.frequency.setValueAtTime(1320, t0 + 0.09);
      gain.gain.setValueAtTime(0.16, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.22);
      osc.start(t0);
      osc.stop(t0 + 0.23);
    } else if (kind === 'bell') {
      // Campana de asedio: dos parciales que decaen (procedural, sin samples).
      const osc2 = actx.createOscillator();
      const gain2 = actx.createGain();
      osc2.connect(gain2);
      gain2.connect(actx.destination);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(660, t0);
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(990, t0);
      gain.gain.setValueAtTime(0.16, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 1.2);
      gain2.gain.setValueAtTime(0.08, t0);
      gain2.gain.exponentialRampToValueAtTime(0.001, t0 + 0.9);
      osc.start(t0);
      osc.stop(t0 + 1.25);
      osc2.start(t0);
      osc2.stop(t0 + 0.95);
      return;
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(147, t0);
      osc.frequency.linearRampToValueAtTime(110, t0 + 0.35);
      gain.gain.setValueAtTime(0.14, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.4);
      osc.start(t0);
      osc.stop(t0 + 0.42);
    }
  } catch {
    // audio nunca debe romper el juego
  }
}

export function playSfx(name: keyof typeof FILES) {
  try {
    if (typeof window === 'undefined') return;
    unlockAudio();
    const a = cache.get(name);
    if (!a) return;
    const clone = a.cloneNode() as HTMLAudioElement;
    clone.volume = a.volume;
    void clone.play().catch(() => undefined);
  } catch {
    // audio nunca debe romper el juego
  }
}
