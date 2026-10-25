// src/domain/solver/model.ts
import { BlokNo, Hari, JenisHari, SettingBobot } from '../types';

export interface SolverSession {
  id: string;
  lessonId: string;
  kelasId: string;
  mapelId: string;
  guruId: string;
  labId: string | null;
  jenis: JenisHari;
  panjang: number;
  isBerat: boolean;
  isPjok: boolean;
  blok: BlokNo;
  // Penempatan hasil:
  hari?: Hari;
  jpMulai?: number;
}

export interface SolverLesson {
  id: string;
  mapelKelasId: string;
  kelasId: string;
  mapelId: string;
  guruId: string;
  labId: string | null;
  jenis: JenisHari;
  isBerat: boolean;
  isPjok: boolean;
  blok: BlokNo;
  jp: number;
  sesi: number[];
}

export interface DayTemplate {
  hari: Hari;
  jps: number[]; // daftar JP [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  breakAfter: Record<number, { isLong: boolean }>;
}

export interface SolverInputData {
  blokList: BlokNo[];
  days: DayTemplate[];
  lessons: SolverLesson[];
  sessions: SolverSession[];
  polaMap: Map<string, JenisHari>; // key: `${kelasId}|${blok}|${hari}`
  guruUnavail: Set<string>; // key: `${blok}|${guruId}|${hari}|${jp}`
  guruHindari: Set<string>;
  weights: SettingBobot;
  seed: number;
  timeBudgetMs: number;
  r3Hard: boolean;
  sesiLintasIstirahat: boolean;
}

export class OccupancyMatrix {
  // key: `${kelasId}|${hari}|${jp}` -> sessionId
  private kelasMap = new Map<string, string>();
  // key: `${guruId}|${hari}|${jp}` -> sessionId
  private guruMap = new Map<string, string>();
  // key: `${labId}|${hari}|${jp}` -> sessionId
  private labMap = new Map<string, string>();

  clear() {
    this.kelasMap.clear();
    this.guruMap.clear();
    this.labMap.clear();
  }

  isKelasFree(kelasId: string, hari: Hari, jp: number): boolean {
    return !this.kelasMap.has(`${kelasId}|${hari}|${jp}`);
  }

  isGuruFree(guruId: string, hari: Hari, jp: number): boolean {
    return !this.guruMap.has(`${guruId}|${hari}|${jp}`);
  }

  isLabFree(labId: string | null, hari: Hari, jp: number): boolean {
    if (!labId) return true;
    return !this.labMap.has(`${labId}|${hari}|${jp}`);
  }

  occupy(session: SolverSession, hari: Hari, jpMulai: number) {
    for (let i = 0; i < session.panjang; i++) {
      const jp = jpMulai + i;
      this.kelasMap.set(`${session.kelasId}|${hari}|${jp}`, session.id);
      this.guruMap.set(`${session.guruId}|${hari}|${jp}`, session.id);
      if (session.labId) {
        this.labMap.set(`${session.labId}|${hari}|${jp}`, session.id);
      }
    }
    session.hari = hari;
    session.jpMulai = jpMulai;
  }

  release(session: SolverSession) {
    if (session.hari === undefined || session.jpMulai === undefined) return;
    for (let i = 0; i < session.panjang; i++) {
      const jp = session.jpMulai + i;
      this.kelasMap.delete(`${session.kelasId}|${session.hari}|${jp}`);
      this.guruMap.delete(`${session.guruId}|${session.hari}|${jp}`);
      if (session.labId) {
        this.labMap.delete(`${session.labId}|${session.hari}|${jp}`);
      }
    }
    session.hari = undefined;
    session.jpMulai = undefined;
  }

  getObstacleSession(kelasId: string, guruId: string, labId: string | null, hari: Hari, jp: number): string | null {
    const kObs = this.kelasMap.get(`${kelasId}|${hari}|${jp}`);
    if (kObs) return kObs;
    const gObs = this.guruMap.get(`${guruId}|${hari}|${jp}`);
    if (gObs) return gObs;
    if (labId) {
      const lObs = this.labMap.get(`${labId}|${hari}|${jp}`);
      if (lObs) return lObs;
    }
    return null;
  }
}
