# TECH.md — Arsitektur & Teknologi Penjadwal Blok SMK

## 1. Keputusan Teknologi

| Area | Pilihan | Alasan |
|------|---------|--------|
| Bahasa | TypeScript (`strict`, `noUncheckedIndexedAccess`) | Menangkap kelas bug penjadwalan (indeks, null) saat kompilasi |
| UI | React 18 + Vite | Cepat, ekosistem matang, mudah dibuat PWA |
| Styling | Tailwind CSS + komponen sendiri | Konsisten, mudah cetak |
| State | Zustand (+ selector memo) | Ringan; state mudah dites; tanpa boilerplate |
| Penyimpanan | IndexedDB lewat Dexie | Kuota besar, transaksional, asinkron (localStorage tidak cocok) |
| Validasi | Zod | Satu skema untuk form, impor, dan baca DB |
| Tabel besar | TanStack Table + TanStack Virtual | Virtualisasi untuk grid jadwal total |
| Solver | Kode TypeScript sendiri di Web Worker (konstruktif + local search) | Tanpa dependensi native; mudah dikontrol (batal, waktu, seed) |
| Ekspor | SheetJS (XLSX), jsPDF + autotable (PDF), CSS print | Offline, tanpa server |
| Test | Vitest, fast-check (property), Playwright (e2e) | Domain murni + uji acak + uji alur |
| PWA | vite-plugin-pwa | Offline setelah pemuatan pertama |
| Paket | pnpm | Cepat, deterministik |

Alternatif bila perlu server/multi-pengguna (v2): API + PostgreSQL memakai DDL di `DATABASE.md`; solver pindah ke worker server (mis. OR-Tools CP-SAT). Domain dan verifier dibuat tanpa dependensi DOM agar bisa dipakai ulang.

## 2. Arsitektur Berlapis

```
UI (React)  ->  Feature hooks  ->  Application services  ->  Domain (murni)
                                         |                       ^
                                         v                       |
                                   Repository (Dexie)      Worker (solver/export)
```

- **Domain** (`src/domain`): tipe, aturan, pre-flight, verifier, solver core. Tanpa React/DOM/Dexie. Fungsi murni berbasis `Result`.
- **Application services**: orkestrasi (muat data -> validasi -> jalankan worker -> simpan hasil dalam transaksi).
- **Repository** (`src/db`): satu-satunya jalur ke Dexie; selalu memvalidasi dengan Zod saat membaca dan menulis.
- **UI**: hanya menampilkan state dan mengirim intent; tidak berisi aturan bisnis.

### Struktur folder

```
src/
  domain/
    types.ts            # BlokNo, Hari, JenisHari, entitas
    result.ts           # Result<T,E>, ok(), err()
    errors.ts           # AppError (kode, pesan_user, detail, saran)
    constants.ts        # bobot default, batas
    time.ts             # util HH:MM, durasi
    model/              # build model dari data mentah: SlotGrid, Lesson, Session
    preflight/          # kapasitas kelas/guru/lab, kelengkapan
    verifier/           # R1,H2..H9,R3 + rekap; TIDAK mengimpor solver
    solver/             # domain.ts, construct.ts, improve.ts, cost.ts, rng.ts, index.ts
    reports/            # rekap JP, hari bebas, gap
  workers/
    solver.worker.ts
    export.worker.ts
  db/
    schema.ts migrations.ts repository/*.ts integrity.ts snapshot.ts backup.ts
  lib/
    logger.ts zod-schemas.ts export-xlsx.ts export-pdf.ts
  ui/
    ErrorBoundary.tsx DataGrid.tsx Toast.tsx ConfirmDialog.tsx StatusBadge.tsx
  features/
    01-setting/ 02-mapel/ 03-matrix-sk/ 04-jurusan/ 05-mapel-kelas/ 06-guru/
    07-jam-efektif/ 08-template-jadwal/ 09-jadwal-total/ 10-jadwal-jurusan/
    11-jadwal-kelas/ 12-jadwal-guru/
  app/ shell.tsx sidebar.tsx readiness-gate.ts store.ts
tests/ unit/ property/ fixtures/ e2e/
docs/ ASSUMPTIONS.md CHANGELOG.md
```

## 3. Strategi Anti-Crash (Detail Implementasi)

### 3.1 Error handling
- `Result<T, AppError>` untuk semua fungsi domain/repository. `throw` hanya untuk bug programmer (invariant) dan ditangkap di tepi.
- `ErrorBoundary` per menu: tampilan "Menu ini bermasalah" + tombol Coba lagi, Unduh log, Buka Safe Mode; menu lain tetap berfungsi.
- Handler global `window.onerror` dan `unhandledrejection` -> `logger.error` + toast; tidak pernah mematikan aplikasi.
- `AppError`: `{ kode, pesanUser, detail?, saran?, sumber }`. Pesan user harus mengandung tindakan perbaikan.

### 3.2 Keamanan data
- **Autosave**: perubahan masuk antrean tulis, debounce 500 ms, satu transaksi per batch, indikator status di bar atas. Gagal tulis -> retry 3x (backoff), lalu banner merah + tawarkan unduh backup JSON saat itu juga.
- **Snapshot bergulir**: otomatis sebelum solver, sebelum impor, sebelum migrasi, sebelum perubahan template jam; maksimal 20 (manual dikecualikan).
- **Penyimpanan hampir penuh**: panggil `navigator.storage.estimate()` saat startup dan tiap snapshot; di atas 80% tampilkan peringatan; `navigator.storage.persist()` diminta di awal.
- **Tutup paksa**: karena penulisan transaksional dan snapshot sebelum aksi besar, state selalu bisa dipulihkan ke titik konsisten terakhir. Draft edit manual yang belum tersimpan disimpan di tabel `setting` (`draft_edit`) tiap perubahan.
- **Multi-tab**: `BroadcastChannel` + kunci Web Locks; tab kedua membuka mode baca saja agar tidak saling menimpa.

### 3.3 Startup yang aman
1. Buka DB; bila gagal (versi, korup) -> **Safe Mode**: tidak memuat jadwal, tawarkan impor backup / ekspor mentah / reset terkontrol.
2. Periksa `schema_version` -> migrasi dengan snapshot.
3. `integrityCheck()`: FK yatim, pola_blok tidak lengkap, jam_slot rusak. Baris bermasalah **dikarantina** (`__quarantine`), bukan membuat aplikasi gagal.
4. Hitung status tiap menu dan Readiness Gate.

### 3.4 Solver tidak boleh crash/freeze
- Jalan di Web Worker; UI hanya mengirim `START{input, seed, timeBudgetMs}` dan menerima `PROGRESS`, `DONE`, `ERROR`.
- `CANCEL` menyetel flag; loop memeriksa flag dan `performance.now()` tiap N iterasi.
- Seluruh isi worker dibungkus `try/catch`; kegagalan -> pesan `ERROR` + hasil parsial terakhir yang valid.
- Batas memori: jumlah iterasi dan ukuran riwayat dibatasi; tidak ada rekursi tanpa batas (backtracking pakai tumpukan eksplisit + batas kedalaman).
- Worker mati (OOM/terminate) -> UI mendeteksi lewat `onerror`/heartbeat 5 detik, menampilkan pesan, dan jadwal sebelumnya tetap utuh (penulisan hasil hanya setelah `DONE` valid, dalam satu transaksi).

### 3.5 Aksi destruktif
- `ConfirmDialog` menyebut dampak konkret ("Menghapus guru G07 akan melepas 12 penugasan").
- Hapus master = nonaktifkan; hapus fisik hanya bila `canDelete()` kosong.
- Undo/redo di editor jadwal (command pattern, 50 langkah); perubahan massal dibungkus satu command.

## 4. Model Internal Solver

```ts
export type BlokNo = 1 | 2;
export type Hari = 1 | 2 | 3 | 4 | 5;
export type JenisHari = 'PRODUKTIF' | 'REGULER';

export interface Slot { hari: Hari; jp: number; urutan: number; }       // baris JP nyata
export interface DayTemplate {
  hari: Hari;
  jps: number[];                // nomor JP berurutan
  breakAfter: Record<number, { long: boolean }>;   // JP n diikuti istirahat
}

export interface Lesson {                          // satu (mapel x kelas x blok)
  id: string; kelasId: string; mapelId: string; guruId: string; labId: string | null;
  jenis: JenisHari; berat: boolean; pjok: boolean; blok: BlokNo;
  sesi: number[];                // mis. [3,3]
}
export interface Session { id: string; lessonId: string; panjang: number; }

export interface SolverInput {
  blok: BlokNo[]; days: DayTemplate[]; kelas: KelasView[]; pola: PolaMap;
  lessons: Lesson[]; guru: GuruView[]; unavailable: UnavailMap; labs: LabView[];
  locked: LockedEntry[]; weights: Weights; flags: { r3Hard: boolean; sesiLintasIstirahat: boolean };
  seed: number; timeBudgetMs: number;
}

export interface SolverOutput {
  entries: Entry[];              // yang berhasil dipasang
  unplaced: Array<{ sessionId: string; alasan: string; kandidatTerbaik?: string }>;
  conflicts: Konflik[];          // termasuk saran
  stats: { skor: number; iterasi: number; waktuMs: number; terpasangPct: number; seed: number; berhenti: 'SELESAI'|'WAKTU'|'BATAL' };
}
```

### 4.1 Prinsip pemodelan
- **Blok dipecahkan terpisah**: Blok 1 dan Blok 2 tidak pernah bersamaan, sehingga dua masalah independen untuk constraint HARD. Penghubung hanya soft: konsistensi posisi (S7) dan hari bebas guru (pass kedua memakai hasil Blok 1 sebagai preferensi Blok 2).
- **Representasi**: array padat `occKelas[kelasIdx][hari][jp]`, `occGuru[guruIdx][hari][jp]`, `occLab[labIdx][hari][jp]` berisi id sesi atau -1. Pengecekan bentrok O(1).
- **Domain sesi**: himpunan posisi `(hari, jpMulai)` yang legal: jenis hari sama, seluruh JP berurutan dalam hari yang sama dan tidak melintasi istirahat, tidak menyentuh slot istirahat, guru tersedia (H6), R3 bila hard.
- **Pemecahan JP menjadi sesi** (`splitJP`) bila `pola_sesi` kosong: `jp <= maks` -> `[jp]`; selain itu bagi menjadi bagian sesedikit mungkin dengan panjang sama, terbesar lebih dulu (6->[3,3], 5->[3,2], 7->[3,2,2], 4->[2,2]). Mapel praktik boleh memakai sesi lebih panjang lewat `maks_jp_sesi`.

### 4.2 Algoritma (3 fase)

**Fase 0 — Pre-flight.** Jalankan pemeriksaan kapasitas (PRD bagian 8). Bila ada ERROR yang membuat masalah mustahil, solver tidak dijalankan; kembalikan laporan.

**Fase 1 — Konstruksi (MRV + penempatan biaya terendah).**
1. Pasang semua `locked` lebih dulu.
2. Urutkan sesi: yang paling terbatas dahulu (domain kecil, guru/lab "bersama" banyak kelas, sesi panjang, guru dengan beban tinggi, kelas yang pola produktifnya identik dengan kelas lain pada guru yang sama).
3. Untuk tiap sesi: ambil posisi di domain dengan **biaya tambahan terendah** (fungsi biaya soft inkremental). Jika domain kosong -> **ejection chain** terbatas: cari sesi penghalang (sesi lain yang menempati slot yang dibutuhkan), cabut, pasang sesi ini, antrekan sesi yang dicabut (maks kedalaman 4, maks percobaan per sesi 50, daftar tabu agar tidak berputar).
4. Sesi yang tetap gagal masuk `unplaced` beserta alasan (mis. "guru G07 penuh Sen-Rab Blok 1").

**Fase 2 — Perbaikan (simulated annealing / tabu).** Hingga `timeBudgetMs`:
- Langkah: (a) pindahkan satu sesi ke posisi legal lain, (b) tukar dua sesi dalam kelas yang sama (tipe hari sama), (c) tukar posisi dua sesi guru yang sama antar kelas, (d) coba pasang `unplaced` dengan ejection.
- Hanya menerima langkah yang **tidak melanggar HARD**. Terima langkah yang menaikkan biaya dengan peluang `exp(-delta/T)`; jadwal terbaik disimpan.
- Pendinginan geometrik; reheat bila stagnan; semua keacakan dari PRNG ber-seed (mulberry32).

**Fase 3 — Verifikasi & pelaporan.** Jalankan verifier independen pada keluaran; bangun daftar `conflicts` dari: `unplaced`, soft constraint di atas ambang (gap > maks, hari bebas kurang, PJOK relaksasi), dan konsistensi lintas blok. Setiap konflik diberi `saran` dari tabel aturan (bagian 6).

### 4.3 Fungsi biaya (soft)

```
biaya = sum( w.R2  * jpBeratDiLuarZonaAwal
           + w.R4a * gapGuru(+ penalti kuadratik di atas maksGap)
           + w.R4b * max(0, minHariBebas - hariBebasGuru)
           + w.S5  * mapelSamaDuaSesiSehari
           + w.S6  * distribusiTidakMerata
           + w.S7  * posisiBedaAntarBlok
           + w.S8  * slotHindariGuru
           + sum(aturanTambahan R5..R7) )
```
Zona awal R2 = JP sebelum istirahat pertama pada hari itu. Gap dihitung hanya di antara JP mengajar pertama dan terakhir; istirahat tidak dihitung gap.

### 4.4 Verifier Independen (R8)
- Input: data mentah (`jadwal_entry`, `mapel_kelas`, `pola_blok`, `jam_slot`, `guru_ketersediaan`, `setting`). **Tidak** mengimpor modul solver atau struktur `occ*`.
- Menghitung ulang dengan `Map` dan kunci string `${blok}|${guru}|${hari}|${jp}` -> kumpulkan pelanggaran R1, H2, H3, H4, H5, H6, H7, H9, R3 + laporan R2/R4/R8.
- Output: `{ lulus: boolean, pelanggaran: Pelanggaran[], rekap: {...}, checklist: Record<'R1'|...|'R8','LULUS'|'PERINGATAN'|'GAGAL'> }`.
- Property test (fast-check): (1) jadwal valid yang dibangkitkan secara konstruktif selalu lulus; (2) satu mutasi yang disengaja (duplikasi guru, pindah ke hari salah jenis, PJOK di sebelah istirahat panjang, hapus satu JP) selalu terdeteksi dengan kode aturan yang tepat.

## 5. Protokol Worker

```ts
// pesan UI -> worker
type ToWorker =
  | { type: 'START'; input: SolverInput }
  | { type: 'CANCEL' };

// pesan worker -> UI
type FromWorker =
  | { type: 'PROGRESS'; fase: 0|1|2|3; terpasang: number; total: number; skor: number; elapsedMs: number }
  | { type: 'DONE'; output: SolverOutput }
  | { type: 'ERROR'; error: AppError; partial?: SolverOutput };
```
- Input dan output dikloning terstruktur (structured clone); tidak membagikan referensi ke store UI.
- `PROGRESS` dibatasi maksimal 5 pesan/detik.
- UI menyimpan hasil hanya setelah `DONE`/`partial` lolos verifier; baru kemudian mengganti jadwal aktif (atomik).

## 6. Tabel Saran Konflik (Ringkas)

| Aturan | Pesan | Saran otomatis |
|--------|-------|----------------|
| Kapasitas kelas (8.1) | JP produktif kelas X melebihi slot hari produktif | Tambah hari produktif di pola, kurangi JP, atau perpanjang JP/hari |
| Kapasitas guru (8.3) | Guru G07 butuh 30 JP di Blok 1 tetapi hanya 24 slot yang bisa | Pindahkan sebagian kelas ke guru lain, ubah pola hari agar tidak berimpit, atau kurangi JP |
| Bentrok guru lintas kelas | Guru G07 di PSPT 1 dan PSPT 2 pada Sen JP3 | Geser pola produktif salah satu kelas, atau tambah guru |
| Lab (H3) | Lab TV dibutuhkan 2 kelas pada Sen JP3-5 | Pecah jadwal lab, tambah ruang, atau atur ulang hari |
| H4 | Mapel produktif tidak punya hari produktif yang cukup | Periksa pola blok kelas |
| R3 | PJOK terpaksa menempel istirahat panjang | Pindahkan sesi PJOK, atau izinkan relaksasi di Setting |
| R4b | Guru G07 tidak punya hari bebas di Blok 1 | Kurangi sebaran kelas guru, atau ubah target hari bebas |
| R4a | Jeda 3 JP di hari Selasa untuk G07 | Pindahkan satu sesi; sarankan slot kandidat |

## 7. Performa

- Ukuran referensi: 48 kelas, ~45 JP/kelas/blok -> ~2.100 JP, ~900 sesi per blok, 80 guru, 8 lab. Struktur `occ*` kecil (< 1 MB).
- Target: solusi layak < 15 detik, perbaikan sampai batas waktu (default 60 detik).
- UI: virtualisasi grid; selector Zustand memo; hindari render ulang seluruh tabel saat hover sel; hitung sorotan legal/ilegal di worker ringan atau dengan cache per sel terpilih.
- Pencarian posisi legal bukan O(n) pindai penuh: gunakan bitmask per kelas/guru per hari (satu bilangan 32-bit per hari) sehingga cek sesi panjang k = operasi bit.

## 8. Ekspor & Cetak

- **XLSX**: sheet `Rekap`, satu sheet per kelas/guru/jurusan, `Jadwal Total Blok 1` dan `Blok 2`; gaya sel berwarna dengan label P/R.
- **PDF**: A4 landscape per kelas/guru; A3 landscape untuk jadwal total; gunakan font tertanam; satu entitas per halaman.
- **Cetak**: stylesheet `@media print`, `page-break-after` per entitas, sembunyikan sidebar.
- **Backup JSON**: format di `DATABASE.md` bagian 8.
- Ekspor berat berjalan di `export.worker.ts` dengan progres.

## 9. Strategi Test

| Jenis | Cakupan |
|-------|---------|
| Unit | splitJP, time util, preflight, tiap aturan verifier, fungsi biaya, repository (dengan fake-indexeddb) |
| Property | Verifier (valid selalu lulus; mutasi selalu terdeteksi), solver (hasil tanpa pelanggaran HARD untuk banyak seed), splitJP (jumlah = JP) |
| Golden fixture | `tests/fixtures/mini` (2 kelas PSPT, 6 guru) dengan pola dari brief; `stress` (48 kelas/80 guru); `infeasible` (sengaja mustahil; harus menghasilkan laporan, bukan crash) |
| Ketahanan | Data kosong, JSON korup, versi skema lebih baru, FK yatim, quota penuh (mock), worker di-terminate, tab ditutup saat tulis |
| E2E (Playwright) | Alur: impor data -> Readiness Gate -> solver -> edit manual -> verifikasi -> FINAL -> ekspor |
| Aksesibilitas | axe-core pada tiap menu |

CI: lint -> typecheck -> unit/property -> build -> e2e. Rilis diblokir bila ada test merah.

## 10. Perintah & Skrip

```bash
pnpm i
pnpm dev            # dev server
pnpm lint           # eslint --max-warnings 0
pnpm typecheck      # tsc --noEmit
pnpm test           # vitest run (unit + property)
pnpm test:e2e       # playwright
pnpm build          # produksi + PWA
pnpm fixtures:gen   # bangkitkan fixture stres
```

## 11. Keamanan & Privasi
- Tidak ada panggilan jaringan untuk data sekolah. CSP ketat (`default-src 'self'`).
- Impor file: batasi ukuran (maks 10 MB), parse di worker, validasi Zod, jangan `eval`, escape sel Excel yang diawali `= + - @` saat ekspor CSV/XLSX (cegah formula injection).
- Log tidak memuat data pribadi di luar kode guru dan nama yang memang diperlukan.

## 12. Risiko Teknis & Mitigasi

| Risiko | Mitigasi |
|--------|----------|
| Data tidak muat (mustahil secara matematis) | Pre-flight + laporan saran sebelum solver; solver tetap mengembalikan hasil parsial |
| Bentrok tersembunyi akibat pola produktif identik pada kelas berbagi guru/lab | Pre-flight 8.3/8.4 khusus mendeteksi pola identik; MRV memprioritaskan sesi tersebut |
| Solver terjebak lokal | Reheat, banyak seed, tombol "Coba seed lain" dan varian A/B |
| Pengguna mengubah data setelah jadwal jadi | Status `PERLU_VERIFIKASI` otomatis + ringkasan perubahan |
| Browser membersihkan data | `storage.persist()`, backup berkala (pengingat tiap 7 hari), ekspor satu klik |
| Kompleksitas UI grid | Virtualisasi, komponen `DataGrid` tunggal yang dites ketat |
