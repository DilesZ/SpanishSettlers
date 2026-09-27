import { describe, expect, it } from 'vitest';
import { pushEvent, type GameEvent } from '@/game/systems/events';

describe('ticker de eventos', () => {
  it('numera y topa a 30', () => {
    let log: GameEvent[] = [];
    let id = 1;
    for (let i = 0; i < 35; i++) {
      const r = pushEvent(log, id, `ev${i}`);
      log = r.log;
      id = r.nextId;
    }
    expect(log.length).toBe(30);
    expect(log[0].text).toBe('ev5');
    expect(log[29].id).toBe(35);
  });
});
