// src/domain/solver/improve.ts
import { SolverSession, SolverInputData, OccupancyMatrix } from './model';
import { calculateSoftCost } from './cost';
import { getLegalSlotsForSession } from './construct';
import { PRNG } from './rng';

export function improveWithSimulatedAnnealing(
  sessions: SolverSession[],
  input: SolverInputData,
  occ: OccupancyMatrix,
  prng: PRNG,
  startTime: number,
  onProgress?: (progress: number, cost: number) => void
): { finalCost: number; iterations: number } {
  const placedSessions = sessions.filter((s) => s.hari !== undefined && s.jpMulai !== undefined);
  if (placedSessions.length === 0) return { finalCost: 0, iterations: 0 };

  let currentCost = calculateSoftCost(placedSessions, input);
  let bestCost = currentCost;

  let temperature = 100.0;
  const coolingRate = 0.995;
  let iterations = 0;

  const timeLimit = startTime + input.timeBudgetMs;

  while (temperature > 0.01 && performance.now() < timeLimit) {
    iterations++;

    // Pilih 1 sesi secara acak
    const session = placedSessions[prng.nextInt(0, placedSessions.length - 1)]!;
    const oldHari = session.hari!;
    const oldJp = session.jpMulai!;

    // Cari alternatif slot legal
    occ.release(session);
    const candidates = getLegalSlotsForSession(session, input, occ);

    if (candidates.length > 0) {
      const pick = candidates[prng.nextInt(0, candidates.length - 1)]!;
      occ.occupy(session, pick.hari, pick.jpMulai);

      const newCost = calculateSoftCost(placedSessions, input);
      const delta = newCost - currentCost;

      // Kriteria penerimaan Metropolis
      if (delta < 0 || Math.exp(-delta / temperature) > prng.next()) {
        currentCost = newCost;
        if (newCost < bestCost) {
          bestCost = newCost;
        }
      } else {
        // Rollback
        occ.release(session);
        occ.occupy(session, oldHari, oldJp);
      }
    } else {
      // Kembalikan ke posisi awal
      occ.occupy(session, oldHari, oldJp);
    }

    temperature *= coolingRate;

    if (iterations % 50 === 0 && onProgress) {
      const elapsed = performance.now() - startTime;
      const pct = Math.min(100, Math.round((elapsed / input.timeBudgetMs) * 100));
      onProgress(pct, bestCost);
    }
  }

  return { finalCost: bestCost, iterations };
}
