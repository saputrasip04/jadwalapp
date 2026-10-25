# AGENT.md — Aturan Kerja Agen Pembangun "Penjadwal Blok SMK"

Dokumen ini adalah kontrak perilaku untuk setiap AI agent (atau developer) yang mengerjakan repo ini.
Baca juga: `PRD.md`, `DATABASE.md`, `TECH.md`.

---

## 1. Peran & Misi

Kamu adalah engineer senior dan ahli timetabling. Misi: membangun aplikasi penjadwalan SMK sistem blok yang
**tidak crash**, **tidak menghasilkan jadwal bentrok**, dan **dapat diaudit** oleh admin kurikulum non-teknis.

Urutan prioritas saat ada trade-off:
1. Integritas data (data pengguna tidak boleh hilang atau rusak)
2. Kebenaran jadwal (aturan HARD tidak pernah dilanggar tanpa dilaporkan)
3. Stabilitas (tidak crash, tidak freeze)
4. Kejelasan bagi pengguna (pesan error yang bisa ditindaklanjuti)
5. Kualitas jadwal (skor soft constraint)
6. Kecepatan & estetika

## 2. Urutan Baca Dokumen

1. `PRD.md` — sumber kebenaran perilaku & aturan bisnis
2. `DATABASE.md` — sumber kebenaran skema & constraint
3. `TECH.md` — arsitektur, solver, strategi anti-crash
4. File ini — cara bekerja

Bila bertentangan: PRD > DATABASE > TECH > AGENT. Jangan menyelesaikan pertentangan secara diam-diam; catat di
`docs/ASSUMPTIONS.md` dengan format `[tanggal] konteks | pilihan | alasan`.

## 3. Prinsip Anti-Crash (Wajib)

| # | Prinsip | Implementasi minimal |
|---|---------|----------------------|
| A1 | Tidak ada exception lolos ke pengguna | Error Boundary per menu; fungsi domain mengembalikan `Result<T, AppError>`, bukan `throw` |
| A2 | Semua input tervalidasi | Skema Zod di batas (form, impor Excel, impor JSON, baca DB) |
| A3 | UI tidak pernah freeze | Solver, verifier besar, dan ekspor berat jalan di Web Worker |
| A4 | Solver selalu berhenti | `timeBudgetMs` wajib; cek `cancelled` tiap iterasi; hasil parsial tetap dikembalikan |
| A5 | Data tidak hilang | Autosave debounce + transaksi IndexedDB + snapshot bergulir (maks 20) + ekspor JSON |
| A6 | Migrasi aman | `schema_version`; migrasi bertahap dan idempoten; backup otomatis sebelum migrasi |
| A7 | Integritas relasi | Cek ketergantungan sebelum hapus; default soft-delete (`aktif=false`) |
| A8 | Aksi destruktif bisa dibatalkan | Konfirmasi + undo/redo (minimal 50 langkah di editor jadwal) |
| A9 | Gagal lembut | Data korup atau tidak valid: karantina baris itu, tampilkan laporan, aplikasi tetap jalan (Safe Mode) |
| A10 | Tidak ada state implisit | Tidak ada global mutable; state hanya lewat store terdaftar |
| A11 | Tabel besar tidak membuat browser lambat | Virtualisasi baris/kolom; memoization selector |
| A12 | Deterministik | Solver menerima `seed`; seed yang sama + input sama = hasil sama |

## 4. Aturan Domain yang Tidak Boleh Salah

- Blok 1 (minggu ganjil) dan Blok 2 (minggu genap) **tidak pernah bersamaan**. Bentrok guru/lab/kelas hanya
  diperiksa **di dalam blok yang sama**. Cek lintas blok = konsistensi, hari bebas, dan beban, bukan bentrok slot.
- Mapel `PRODUKTIF` hanya di hari bertipe `PRODUKTIF` milik kelas itu; `REGULER` hanya di hari `REGULER`.
- Pola hari **per kelas per blok**, bukan per jurusan.
- Satu slot (blok, kelas, hari, JP) berisi paling banyak satu entri.
- Satu slot (blok, guru, hari, JP) berisi paling banyak satu entri; sama untuk lab.
- Sesi tidak boleh melintasi istirahat (kecuali opsi dinyalakan di Setting).
- Jadwal berstatus `FINAL` **hanya** bila verifier independen melaporkan 0 pelanggaran HARD.
- Verifier **tidak boleh** memakai kode atau struktur data internal solver. Ia menghitung ulang dari `jadwal_entry` mentah.

## 5. Alur Kerja

1. **Rencana**: pecah per milestone (lihat `PRD.md` bagian 12). Tulis rencana pendek sebelum koding.
2. **Skema dulu**: ubah `DATABASE.md` bila skema berubah, lalu tulis migrasi dan test-nya.
3. **Domain murni dulu, UI kemudian**: logika di `src/domain` tanpa import React/DOM; mudah dites.
4. **Test sebelum solver**: tulis test verifier dan fixture sebelum mengerjakan solver.
5. **Kerjakan vertikal**: satu menu selesai (data -> validasi -> UI -> test) sebelum pindah.
6. **Jalankan gate** (bagian 8) sebelum menyatakan milestone selesai.
7. **Laporkan** (bagian 9).

## 6. Konvensi Kode

- Bahasa: TypeScript `strict: true`, tanpa `any` (gunakan `unknown` + Zod). `noUncheckedIndexedAccess: true`.
- Nama tabel/field mengikuti `DATABASE.md` persis (`snake_case` di DB; mapper ke `camelCase` di TypeScript).
- Teks UI: Bahasa Indonesia, nada jelas dan tidak menyalahkan. Pesan error harus memuat **apa yang salah, di mana, dan cara memperbaiki**.
- Komentar kode: Bahasa Inggris atau Indonesia, konsisten per file; jelaskan *mengapa*, bukan *apa*.
- Fungsi domain: murni, tanpa efek samping, maksimal ~50 baris; kembalikan `Result`.
- Tidak ada `console.log` tersisa; gunakan `logger` (level, konteks, ring buffer 500 entri, bisa diunduh).
- Tidak ada angka ajaib; bobot penalti dan batas ada di `src/domain/constants.ts` atau Setting.
- Aksesibilitas: kontras cukup, bisa dioperasikan keyboard, warna jenis hari juga memakai label teks (P/R).

## 7. Struktur Repo (ringkas; detail di TECH.md)

```
src/
  domain/      # tipe, aturan, verifier, preflight, solver core (tanpa DOM)
  workers/     # solver.worker.ts, export.worker.ts
  db/          # dexie, migrasi, repository
  features/    # satu folder per menu (01-setting ... 12-jadwal-perguru)
  ui/          # komponen bersama (DataGrid, ErrorBoundary, Toast, ConfirmDialog)
  lib/         # logger, result, zod-schemas, export
tests/         # unit, property, e2e
docs/          # ASSUMPTIONS.md, CHANGELOG.md
```

## 8. Definition of Done (per milestone)

- [ ] `pnpm lint` dan `pnpm typecheck` bersih tanpa peringatan.
- [ ] `pnpm test` lulus; cakupan `src/domain` minimal 90%.
- [ ] Property test verifier lulus (jadwal acak yang dibuat valid selalu lolos; satu mutasi sengaja yang melanggar selalu terdeteksi).
- [ ] Skenario crash manual lulus: data kosong, data korup, tutup tab saat solver jalan, impor file salah, localStorage/IndexedDB penuh, muat ulang di tengah edit.
- [ ] Fixture "stres" (>= 48 kelas, >= 80 guru) menghasilkan jadwal atau laporan kendala dalam batas waktu tanpa freeze UI.
- [ ] Tiap menu punya kondisi: kosong, memuat, error, berhasil.
- [ ] `docs/ASSUMPTIONS.md` dan `CHANGELOG.md` diperbarui.

## 9. Format Laporan Akhir Tiap Milestone

1. Yang dibuat (file/menu)
2. Yang diuji (jenis test + hasil)
3. Asumsi yang diambil
4. Risiko / utang teknis tersisa
5. Langkah berikutnya

## 10. Larangan

- Jangan menghapus atau menimpa data pengguna tanpa snapshot dan konfirmasi.
- Jangan menyatakan "tidak ada bentrok" tanpa menjalankan verifier dan menampilkan hasilnya.
- Jangan menyembunyikan aturan yang gagal; semua kendala masuk tabel `konflik` dengan saran.
- Jangan memakai `localStorage` untuk data utama (kuota kecil, sinkron, mudah korup); hanya untuk preferensi UI ringan.
- Jangan menjalankan solver di main thread.
- Jangan menambah dependensi besar tanpa alasan tertulis di `CHANGELOG.md`.
- Jangan hardcode data sekolah, nama guru, atau jurusan di logika; semua dari database/seed.
- Jangan mengubah makna aturan R1-R8 tanpa persetujuan; bobot boleh disetel lewat Setting.

## 11. Ambigu atau Data Belum Lengkap

Kasus yang sudah diketahui (jangan ditebak diam-diam, gunakan default di bawah dan tandai `is_assumed = true`):

| Hal | Default sementara | Tindakan UI |
|-----|-------------------|-------------|
| Jumlah program keahlian | Lengkap 8 jurusan (AK, TKR, TKJ, PSPT, KUL, DPB, APAT, LAS) | CRUD tetap terbuka bila sekolah ingin menambah/mengubah |
| Pola PSPT 1 Blok 2 kosong | Kebalikan Blok 1 | Tandai asumsi di menu 4 |
| Pola PSPT 2 Blok 1 kosong | Kebalikan Blok 2 | Tandai asumsi di menu 4 |
| Daftar mapel/guru/JP belum diisi | Tidak ada; seed contoh bisa dihapus | Readiness Gate menahan menu 8-12 |
| Arti "JP per minggu" saat dua blok punya jumlah hari produktif/reguler berbeda | Disimpan terpisah `jp_blok1` dan `jp_blok2`; bila hanya satu angka diberikan, dipakai di keduanya | Tampilkan peringatan kapasitas bila tidak muat |
| Aturan R5-R7 | Slot kosong di Setting | Tampil sebagai "belum diisi", tidak mempengaruhi solver |
| Nama program "AK" | Disimpan persis seperti input pengguna | Tidak dikoreksi otomatis |
