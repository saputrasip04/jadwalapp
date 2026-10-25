// src/domain/solver/split-jp.ts

/**
 * Memecah total JP menjadi beberapa sesi berurutan.
 * Aturan:
 * - Jika jp <= maks, hasil [jp]
 * - Jika jp > maks, bagi menjadi bagian sesedikit mungkin dengan panjang seragam,
 *   bagian terbesar di depan. Contoh maks = 3:
 *   6 -> [3, 3]
 *   5 -> [3, 2]
 *   7 -> [3, 2, 2]
 *   4 -> [2, 2]
 */
export function splitJP(jp: number, maksJpSesi = 3): number[] {
  if (jp <= 0) return [];
  if (jp <= maksJpSesi) return [jp];

  const numSessions = Math.ceil(jp / maksJpSesi);
  const base = Math.floor(jp / numSessions);
  const remainder = jp % numSessions;

  const result: number[] = [];
  for (let i = 0; i < numSessions; i++) {
    result.push(base + (i < remainder ? 1 : 0));
  }

  // Urutkan menurun agar sesi terpanjang di depan
  return result.sort((a, b) => b - a);
}
