// src/domain/solver/cost.ts
import { SolverSession, SolverInputData } from './model';
import { Hari } from '../types';

export function calculateSoftCost(
  sessions: SolverSession[],
  input: SolverInputData
): number {
  let totalCost = 0;
  const w = input.weights;

  // 1. R2: Mapel Berat di Jam Awal (sebelum istirahat pertama, biasanya JP 1-4)
  for (const s of sessions) {
    if (s.isBerat && s.hari && s.jpMulai !== undefined) {
      // Jika mulai setelah JP 4, beri penalti per JP
      if (s.jpMulai > 4) {
        totalCost += w.R2 * (s.jpMulai - 4) * s.panjang;
      }
    }
  }

  // 2. S8: Slot Hindari Guru
  for (const s of sessions) {
    if (s.hari && s.jpMulai !== undefined) {
      for (let i = 0; i < s.panjang; i++) {
        const key = `${s.blok}|${s.guruId}|${s.hari}|${s.jpMulai + i}`;
        if (input.guruHindari.has(key)) {
          totalCost += w.S8;
        }
      }
    }
  }

  // 3. R4a & R4b: Gap Mengajar & Hari Bebas Guru
  const guruSessions = new Map<string, SolverSession[]>();
  for (const s of sessions) {
    if (s.hari && s.jpMulai !== undefined) {
      const list = guruSessions.get(s.guruId) ?? [];
      list.push(s);
      guruSessions.set(s.guruId, list);
    }
  }

  for (const [, sList] of guruSessions.entries()) {
    let daysTaught = 0;
    for (let h = 1; h <= 5; h++) {
      const today = sList.filter((s) => s.hari === h);
      if (today.length > 0) {
        daysTaught++;
        // Kumpulkan semua nomor JP
        const allJPs: number[] = [];
        for (const s of today) {
          for (let i = 0; i < s.panjang; i++) {
            allJPs.push(s.jpMulai! + i);
          }
        }
        allJPs.sort((a, b) => a - b);
        const minJP = allJPs[0]!;
        const maxJP = allJPs[allJPs.length - 1]!;
        const span = maxJP - minJP + 1;
        const gap = span - allJPs.length;
        if (gap > 1) {
          totalCost += w.R4a * gap * gap; // penalti kuadratik
        } else if (gap === 1) {
          totalCost += w.R4a;
        }
      }
    }

    const freeDays = 5 - daysTaught;
    if (freeDays < 1) {
      totalCost += w.R4b;
    }
  }

  // 4. S5: Mapel sama di 2 sesi terpisah pada hari yang sama di kelas yang sama
  const classDayMapel = new Map<string, number>();
  for (const s of sessions) {
    if (s.hari) {
      const key = `${s.kelasId}|${s.hari}|${s.mapelId}`;
      const count = (classDayMapel.get(key) ?? 0) + 1;
      classDayMapel.set(key, count);
      if (count > 1) {
        totalCost += w.S5;
      }
    }
  }

  return totalCost;
}
