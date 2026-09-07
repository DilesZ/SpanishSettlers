// SFX CC0 (Kenney) con HTMLAudio + precarga. Se desbloquea con el primer gesto.
const FILES: Record<string, string> = {
  click: '/assets/audio/click.ogg',
  select: '/assets/audio/select.ogg',
  confirm: '/assets/audio/confirm.ogg',
  error: '/assets/audio/error.ogg',
  chop: '/assets/audio/chop.ogg',
  sword: '/assets/audio/sword.ogg',
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
