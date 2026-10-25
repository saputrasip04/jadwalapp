// src/domain/solver/construct.ts
import { SolverSession, SolverInputData, OccupancyMatrix, DayTemplate } from './model';
import { Hari } from '../types';
import { PRNG } from './rng';

export interface CandidateSlot {
  hari: Hari;
  jpMulai: number;
}

export function getLegalSlotsForSession(
  session: SolverSession,
  input: SolverInputData,
  occ: OccupancyMatrix
): CandidateSlot[] {
  const candidates: CandidateSlot[] = [];

  for (const day of input.days) {
    // 1. Cek Pola Hari Kelas: P vs R
    const polaHari = input.polaMap.get(`${session.kelasId}|${session.blok}|${day.hari}`);
    if (polaHari !== session.jenis) {
      continue;
    }

    const jps = day.jps;
    for (let i = 0; i <= jps.length - session.panjang; i++) {
      const jpMulai = jps[i]!;

      // 2. Cek apakah melintasi istirahat
      let crossesBreak = false;
      if (!input.sesiLintasIstirahat) {
        for (let step = 0; step < session.panjang - 1; step++) {
          const currentJp = jpMulai + step;
          if (day.breakAfter[currentJp]) {
            crossesBreak = true;
            break;
          }
        }
      }
      if (crossesBreak) continue;

      // 3. Cek R3: PJOK menempel ISHOMA
      if (session.isPjok && input.r3Hard) {
        // Cek apakah jpMulai menempel setelah ISHOMA
        const prevJp = jpMulai - 1;
        if (day.breakAfter[prevJp]?.isLong) continue;
        // Cek apakah jpSelesai menempel sebelum ISHOMA
        const lastJp = jpMulai + session.panjang - 1;
        if (day.breakAfter[lastJp]?.isLong) continue;
      }

      // 4. Cek Ketersediaan Guru (TIDAK_BISA)
      let guruUnavail = false;
      for (let step = 0; step < session.panjang; step++) {
        const checkJp = jpMulai + step;
        if (input.guruUnavail.has(`${session.blok}|${session.guruId}|${day.hari}|${checkJp}`)) {
          guruUnavail = true;
          break;
        }
      }
      if (guruUnavail) continue;

      // 5. Cek Occupancy (Kelas, Guru, Lab)
      let isFree = true;
      for (let step = 0; step < session.panjang; step++) {
        const checkJp = jpMulai + step;
        if (
          !occ.isKelasFree(session.kelasId, day.hari, checkJp) ||
          !occ.isGuruFree(session.guruId, day.hari, checkJp) ||
          !occ.isLabFree(session.labId, day.hari, checkJp)
        ) {
          isFree = false;
          break;
        }
      }

      if (isFree) {
        candidates.push({ hari: day.hari, jpMulai });
      }
    }
  }

  return candidates;
}

export function constructInitialSchedule(
  sessions: SolverSession[],
  input: SolverInputData,
  occ: OccupancyMatrix,
  prng: PRNG
): { unplaced: Array<{ sessionId: string; alasan: string }> } {
  const unplaced: Array<{ sessionId: string; alasan: string }> = [];

  // Urutkan sesi dengan heuristik MRV (Most Constrained First):
  // Sesi praktik panjang lebih dulu, mapel PJOK, guru dengan beban tinggi
  const sortedSessions = [...sessions].sort((a, b) => {
    if (b.panjang !== a.panjang) return b.panjang - a.panjang;
    if (a.isPjok !== b.isPjok) return a.isPjok ? -1 : 1;
    return 0;
  });

  for (const session of sortedSessions) {
    const candidates = getLegalSlotsForSession(session, input, occ);

    if (candidates.length > 0) {
      // Ambil slot acak dari kandidat terbaik untuk diversifikasi
      const picked = candidates[prng.nextInt(0, candidates.length - 1)]!;
      occ.occupy(session, picked.hari, picked.jpMulai);
    } else {
      // Coba Ejection Chain sederhana (kedalaman 1)
      let ejected = false;
      for (const day of input.days) {
        if (input.polaMap.get(`${session.kelasId}|${session.blok}|${day.hari}`) !== session.jenis) {
          continue;
        }
        for (let i = 0; i <= day.jps.length - session.panjang; i++) {
          const jpMulai = day.jps[i]!;
          // Cari sesi penghalang
          const obstacleId = occ.getObstacleSession(
            session.kelasId,
            session.guruId,
            session.labId,
            day.hari,
            jpMulai
          );
          if (obstacleId) {
            const obstacle = sessions.find((s) => s.id === obstacleId);
            if (obstacle && obstacle.id !== session.id) {
              // Cabut obstacle sementara
              occ.release(obstacle);
              // Cek apakah slot sekarang bebas untuk sesi kita
              const nowCandidates = getLegalSlotsForSession(session, input, occ);
              const matching = nowCandidates.find((c) => c.hari === day.hari && c.jpMulai === jpMulai);
              if (matching) {
                occ.occupy(session, day.hari, jpMulai);
                // Coba pasang kembali obstacle di tempat lain
                const obsCandidates = getLegalSlotsForSession(obstacle, input, occ);
                if (obsCandidates.length > 0) {
                  const pickObs = obsCandidates[0]!;
                  occ.occupy(obstacle, pickObs.hari, pickObs.jpMulai);
                  ejected = true;
                  break;
                } else {
                  // Gagal relokasi obstacle, rollback
                  occ.release(session);
                  occ.occupy(obstacle, obstacle.hari!, obstacle.jpMulai!);
                }
              } else {
                occ.occupy(obstacle, obstacle.hari!, obstacle.jpMulai!);
              }
            }
          }
        }
        if (ejected) break;
      }

      if (!ejected) {
        unplaced.push({
          sessionId: session.id,
          alasan: `Tidak ditemukan slot waktu legal yang kosong untuk guru/lab pada hari ${session.jenis}.`,
        });
      }
    }
  }

  return { unplaced };
}
