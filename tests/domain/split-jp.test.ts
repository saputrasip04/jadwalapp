import { describe, it, expect } from 'vitest';
import { splitJP } from '../../src/domain/solver/split-jp';

describe('splitJP (Pemecahan JP ke Sesi)', () => {
  it('harus membagi jp <= maks_jp_sesi menjadi tepat 1 sesi', () => {
    expect(splitJP(2, 3)).toEqual([2]);
    expect(splitJP(3, 3)).toEqual([3]);
    expect(splitJP(1, 4)).toEqual([1]);
  });

  it('harus memecah 6 JP dengan maks 3 menjadi [3, 3]', () => {
    expect(splitJP(6, 3)).toEqual([3, 3]);
  });

  it('harus memecah 5 JP dengan maks 3 menjadi [3, 2]', () => {
    expect(splitJP(5, 3)).toEqual([3, 2]);
  });

  it('harus memecah 7 JP dengan maks 3 menjadi [3, 2, 2]', () => {
    expect(splitJP(7, 3)).toEqual([3, 2, 2]);
  });

  it('harus memastikan total JP setelah dipecah persis sama dengan input JP', () => {
    for (let jp = 1; jp <= 20; jp++) {
      const parts = splitJP(jp, 3);
      const sum = parts.reduce((a, b) => a + b, 0);
      expect(sum).toBe(jp);
      for (const p of parts) {
        expect(p).toBeLessThanOrEqual(3);
      }
    }
  });
});
