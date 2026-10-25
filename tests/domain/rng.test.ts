import { describe, it, expect } from 'vitest';
import { PRNG } from '../../src/domain/solver/rng';

describe('PRNG (Mulberry32 Deterministic RNG)', () => {
  it('harus menghasilkan urutan angka yang identik untuk seed yang sama', () => {
    const rng1 = new PRNG(12345);
    const rng2 = new PRNG(12345);

    for (let i = 0; i < 50; i++) {
      expect(rng1.next()).toBe(rng2.next());
    }
  });

  it('harus menghasilkan urutan berbeda untuk seed berbeda', () => {
    const rng1 = new PRNG(12345);
    const rng2 = new PRNG(67890);

    const s1 = Array.from({ length: 5 }, () => rng1.next());
    const s2 = Array.from({ length: 5 }, () => rng2.next());
    expect(s1).not.toEqual(s2);
  });

  it('harus mematuhi batas nextInt(min, max)', () => {
    const rng = new PRNG(42);
    for (let i = 0; i < 100; i++) {
      const val = rng.nextInt(1, 10);
      expect(val).toBeGreaterThanOrEqual(1);
      expect(val).toBeLessThanOrEqual(10);
      expect(Number.isInteger(val)).toBe(true);
    }
  });

  it('harus mengacak array tanpa menghilangkan atau menduplikasi elemen', () => {
    const rng = new PRNG(999);
    const original = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const shuffled = rng.shuffle(original);

    expect(shuffled).toHaveLength(original.length);
    expect([...shuffled].sort((a, b) => a - b)).toEqual(original);
  });
});
