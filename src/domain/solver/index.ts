// src/domain/solver/index.ts
import { SolverInputData, OccupancyMatrix, SolverSession } from './model';
import { PRNG } from './rng';
import { constructInitialSchedule } from './construct';
import { improveWithSimulatedAnnealing } from './improve';
import { ulid } from 'ulid';
import { JadwalEntry } from '../types';

export interface SolverRunResult {
  entries: JadwalEntry[];
  unplaced: Array<{ sessionId: string; alasan: string }>;
  stats: {
    skor: number;
    iterasi: number;
    waktuMs: number;
    terpasangPct: number;
    seed: number;
  };
}

export function solveTimetable(
  input: SolverInputData,
  runId: string,
  onProgress?: (progress: number, cost: number) => void
): SolverRunResult {
  const startTime = performance.now();
  const prng = new PRNG(input.seed);
  const occ = new OccupancyMatrix();

  // Fase 1: Konstruksi (MRV + Ejection)
  const { unplaced } = constructInitialSchedule(input.sessions, input, occ, prng);

  // Fase 2: Perbaikan (Simulated Annealing)
  const { finalCost, iterations } = improveWithSimulatedAnnealing(
    input.sessions,
    input,
    occ,
    prng,
    startTime,
    onProgress
  );

  // Bangun entri jadwal hasil penempatan
  const entries: JadwalEntry[] = [];
  for (const s of input.sessions) {
    if (s.hari !== undefined && s.jpMulai !== undefined) {
      for (let i = 0; i < s.panjang; i++) {
        entries.push({
          id: ulid(),
          run_id: runId,
          blok_no: s.blok,
          kelas_id: s.kelasId,
          hari: s.hari,
          jp_ke: s.jpMulai + i,
          mapel_kelas_id: s.lessonId,
          guru_id: s.guruId,
          lab_id: s.labId,
          sesi_id: s.id,
          is_locked: 0,
        });
      }
    }
  }

  const elapsed = Math.round(performance.now() - startTime);
  const totalJP = input.sessions.reduce((acc, s) => acc + s.panjang, 0);
  const placedJP = entries.length;
  const terpasangPct = totalJP > 0 ? Math.round((placedJP / totalJP) * 100) : 100;

  return {
    entries,
    unplaced,
    stats: {
      skor: finalCost,
      iterasi: iterations,
      waktuMs: elapsed,
      terpasangPct,
      seed: input.seed,
    },
  };
}
