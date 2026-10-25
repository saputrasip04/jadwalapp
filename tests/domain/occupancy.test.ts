import { describe, it, expect } from 'vitest';
import { OccupancyMatrix, SolverSession } from '../../src/domain/solver/model';

describe('OccupancyMatrix (Pendeteksi Bentrok Solver)', () => {
  const dummySession1: SolverSession = {
    id: 'sess-1',
    lessonId: 'less-1',
    kelasId: 'kls-tkj-1',
    mapelId: 'mapel-mat',
    guruId: 'guru-budi',
    labId: null,
    jenis: 'REGULER',
    panjang: 3,
    isBerat: true,
    isPjok: false,
    blok: 1,
  };

  const dummySessionLab: SolverSession = {
    id: 'sess-lab',
    lessonId: 'less-lab',
    kelasId: 'kls-tkj-2',
    mapelId: 'mapel-jaringan',
    guruId: 'guru-siti',
    labId: 'lab-komputer-1',
    jenis: 'PRODUKTIF',
    panjang: 2,
    isBerat: false,
    isPjok: false,
    blok: 1,
  };

  it('harus mencatat slot sibuk untuk kelas dan guru ketika ditempatkan', () => {
    const mat = new OccupancyMatrix();

    // Pastikan awalnya bebas
    expect(mat.isKelasFree('kls-tkj-1', 1, 1)).toBe(true);
    expect(mat.isGuruFree('guru-budi', 1, 1)).toBe(true);

    // Tempati JP 1 sampai JP 3 (panjang 3)
    mat.occupy(dummySession1, 1, 1);

    expect(mat.isKelasFree('kls-tkj-1', 1, 1)).toBe(false);
    expect(mat.isKelasFree('kls-tkj-1', 1, 2)).toBe(false);
    expect(mat.isKelasFree('kls-tkj-1', 1, 3)).toBe(false);
    expect(mat.isKelasFree('kls-tkj-1', 1, 4)).toBe(true);

    expect(mat.isGuruFree('guru-budi', 1, 1)).toBe(false);
    expect(mat.isGuruFree('guru-budi', 1, 2)).toBe(false);
    expect(mat.isGuruFree('guru-budi', 1, 3)).toBe(false);
    expect(mat.isGuruFree('guru-budi', 1, 4)).toBe(true);
  });

  it('harus mencatat slot sibuk untuk Lab bila sesi menggunakan Lab', () => {
    const mat = new OccupancyMatrix();
    mat.occupy(dummySessionLab, 2, 4);

    expect(mat.isLabFree('lab-komputer-1', 2, 4)).toBe(false);
    expect(mat.isLabFree('lab-komputer-1', 2, 5)).toBe(false);
    expect(mat.isLabFree('lab-komputer-1', 2, 6)).toBe(true);
  });

  it('harus membebaskan seluruh slot saat sesi di-release', () => {
    const mat = new OccupancyMatrix();
    mat.occupy(dummySession1, 1, 1);
    expect(mat.isKelasFree('kls-tkj-1', 1, 2)).toBe(false);

    mat.release(dummySession1);
    expect(mat.isKelasFree('kls-tkj-1', 1, 1)).toBe(true);
    expect(mat.isKelasFree('kls-tkj-1', 1, 2)).toBe(true);
    expect(mat.isKelasFree('kls-tkj-1', 1, 3)).toBe(true);
    expect(mat.isGuruFree('guru-budi', 1, 1)).toBe(true);
  });

  it('harus mendeteksi obstacle session yang menghalangi', () => {
    const mat = new OccupancyMatrix();
    mat.occupy(dummySession1, 1, 1);

    const obs = mat.getObstacleSession('kls-tkj-1', 'guru-lain', null, 1, 2);
    expect(obs).toBe('sess-1');

    const noObs = mat.getObstacleSession('kls-lain', 'guru-lain', null, 1, 2);
    expect(noObs).toBeNull();
  });
});
