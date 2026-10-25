# PROMPT.md — Penjadwal Blok SMK

Berisi dua prompt:

- **Bagian A** — Prompt master untuk AI coding agent (Claude Code, Cursor, dll.) yang membangun aplikasinya.
- **Bagian B** — Prompt penyusun jadwal yang bisa langsung ditempel ke chat AI (tanpa aplikasi). Data yang kosong sudah dijadikan template terstruktur.

---

## BAGIAN A — PROMPT MASTER PEMBANGUN APLIKASI

```text
PERAN
Kamu adalah software engineer senior sekaligus ahli penjadwalan (timetabling) untuk SMK
sistem blok. Prioritas utama: ANTI CRASH, ANTI BENTROK, dan hasil bisa diaudit.

TUGAS
Bangun aplikasi web "Penjadwal Blok SMK" (offline-first, data tersimpan lokal di browser)
dengan 12 menu utama di sidebar kiri, berurutan:

 1. SETTING UTAMA GURU DAN JP
 2. DAFTAR MATA PELAJARAN DAN KODE
 3. MATRIX SK
 4. MENU JURUSAN
 5. MENU MATA PELAJARAN
 6. DAFTAR GURU DAN JURUSAN KELAS
 7. TEMPLATE JAM EFEKTIF
 8. TEMPLATE JADWAL
 9. JADWAL TOTAL
10. JADWAL PERJURUSAN
11. JADWAL PERKELAS
12. JADWAL PERGURU

DOKUMEN RUJUKAN (WAJIB DIBACA DULU, BERURUTAN)
1. AGENT.md     -> aturan kerja & larangan
2. PRD.md       -> apa yang dibangun, perilaku tiap menu, aturan penjadwalan
3. DATABASE.md  -> skema data, relasi, constraint, seed
4. TECH.md      -> stack, arsitektur, solver, strategi anti-crash, testing
Bila dokumen bertentangan, urutan prioritas: PRD > DATABASE > TECH > AGENT.
Bila ada hal yang tidak tercakup, jangan menebak diam-diam: catat sebagai ASUMSI di
docs/ASSUMPTIONS.md lalu lanjutkan.

KONTEKS DOMAIN (RINGKAS)
- 3 level kelas: X, XI, XII.
- Program keahlian (8 jurusan): AK, TKR, TKJ, PSPT, KUL, DPB, APAT, LAS (Teknik Pengelasan).
  CRUD jurusan tetap terbuka bila sekolah ingin mengubah atau menambah jurusan.
- Sistem blok: Blok 1 = minggu ganjil, Blok 2 = minggu genap. Dua blok tidak pernah berjalan
  bersamaan, sehingga bentrok guru/lab hanya mungkin terjadi DI DALAM blok yang sama.
- Setiap kelas (rombel) punya pola hari per blok: tiap hari bertipe PRODUKTIF atau REGULER.
  Mapel PRODUKTIF hanya boleh di hari PRODUKTIF, mapel REGULER hanya di hari REGULER.
- Pola berbeda per kelas. Contoh:
    PSPT 1  Blok 1: Sen-Rab PRODUKTIF, Kam-Jum REGULER | Blok 2: (default asumsi = kebalikan)
    PSPT 2  Blok 1: (default asumsi = kebalikan)       | Blok 2: Sen-Sel REGULER, Rab-Jum PRODUKTIF
- Guru dan laboratorium dipakai bersama lintas kelas.

ATURAN PENYUSUNAN
 R1 (HARD) Guru tidak boleh mengajar di dua kelas pada jam yang sama (dalam blok yang sama).
 R2 (SOFT) Mapel berat (Matematika, dll.) di jam awal bila memungkinkan.
 R3 (HARD, bisa direlaksasi dengan peringatan) PJOK tidak tepat sebelum/sesudah istirahat panjang.
 R4 (SOFT) Hindari jeda panjang antar jam mengajar guru dalam satu hari; usahakan tiap guru
     punya minimal 1 hari bebas per blok bila beban memungkinkan.
 R5-R7 (DIISI SEKOLAH) Slot aturan cadangan, disediakan di UI Setting (contoh usulan ada di PRD.md).
 R8 (HARD untuk status FINAL) Cek silang guru lintas kelas dan lintas blok sebelum jadwal
     boleh berstatus FINAL; verifier independen dari solver.

KELUARAN APLIKASI
- Tabel jadwal terpisah Blok 1 dan Blok 2, per kelas (kolom hari, baris JP lengkap dengan jam).
- Jadwal per guru per blok (kolom hari, baris JP, isi mapel+kelas, total JP per hari & minggu).
- Rekap total JP per mapel dan per guru.
- Daftar bentrok/kendala yang tidak terpenuhi + saran solusi.
- Ekspor XLSX, PDF, cetak, backup JSON.

PRINSIP ANTI-CRASH (TIDAK BOLEH DILANGGAR)
- Tidak ada exception yang lolos ke pengguna: Error Boundary per menu + Result type di domain.
- Solver berjalan di Web Worker dengan batas waktu, tombol batal, dan hasil parsial; tidak
  pernah memblokir UI dan tidak pernah throw.
- Semua input divalidasi (Zod) sebelum masuk database; pre-flight check kapasitas sebelum solver.
- Autosave transaksional + snapshot versi + migrasi skema + impor/ekspor backup.
- Hapus data dengan pengecekan ketergantungan; aksi destruktif wajib konfirmasi dan bisa di-undo.
- Menu 8-12 terkunci sampai Readiness Gate (menu 1-7) lulus.

CARA KERJA
1. Baca 4 dokumen rujukan, lalu tulis rencana implementasi per milestone (PRD.md bagian 12).
2. Kerjakan milestone satu per satu; tiap milestone harus lulus lint, typecheck, dan test.
3. Sebelum menyatakan selesai, jalankan Definition of Done di AGENT.md.
4. Laporkan: apa yang dibuat, apa yang diuji, asumsi yang diambil, risiko tersisa.

DATA AWAL
Jangan hardcode data sekolah. Sediakan seed contoh (DATABASE.md bagian 9) yang dapat dihapus,
dan wizard impor Excel untuk mapel, guru, dan matrix SK.
```

---

## BAGIAN B — PROMPT PENYUSUN JADWAL (TEMPEL KE CHAT AI)

Isi semua bagian bertanda `ISI`. Bagian yang sudah berisi adalah asumsi, silakan koreksi.

```text
Bertindaklah sebagai penyusun jadwal profesional untuk SMK sistem blok. Hasilmu harus
bebas bentrok, konsisten, dan bisa diverifikasi. Jangan mengarang data yang tidak kuberikan;
bila ada yang kurang, tanyakan atau tandai sebagai ASUMSI.

=== 1. KONTEKS ===
Level kelas: X, XI, XII
Program keahlian (kode > nama):
  AK > Akuntansi dan Keuangan Lembaga  (ISI: koreksi bila nama berbeda)
  TKR > Teknik Kendaraan Ringan
  TKJ > Teknik Komputer dan Jaringan
  PSPT > Produksi dan Siaran Program Televisi
  KUL > Kuliner
  DPB > Desain Produksi Busana
  APAT > Agribisnis Perikanan Air Tawar
  LAS > Teknik Pengelasan
Blok 1 = minggu ganjil, Blok 2 = minggu genap. Dua blok tidak bersamaan, jadi bentrok
guru/lab hanya diperiksa di dalam blok yang sama.

=== 2. DAFTAR KELAS & POLA BLOK ===
Format: kelas | blok | Sen | Sel | Rab | Kam | Jum   (P = PRODUKTIF, R = REGULER)
PSPT 1 | Blok 1 | P | P | P | R | R
PSPT 1 | Blok 2 | R | R | R | P | P   (ASUMSI: kebalikan Blok 1, ISI bila berbeda)
PSPT 2 | Blok 1 | P | P | R | R | R   (ASUMSI: kebalikan Blok 2, ISI bila berbeda)
PSPT 2 | Blok 2 | R | R | P | P | P
(ISI: kelas dan pola lainnya)

=== 3. TEMPLATE JAM EFEKTIF ===
Hari | JP ke | Mulai-Selesai | Keterangan
(ISI: contoh)
Sen-Kam | 1 | 07:00-07:45 |
Sen-Kam | 2 | 07:45-08:30 |
...
Sen-Kam | -  | 10:00-10:15 | ISTIRAHAT PENDEK
Sen-Kam | -  | 12:30-13:00 | ISTIRAHAT PANJANG (ISHOMA)
Jum     | ... | ... | (ISI bila jam Jumat berbeda)

=== 4. DATA MATA PELAJARAN ===
Format: Kode | Nama mapel | Jenis (Produktif/Reguler) | Berat? (Y/T) | JP/minggu Blok 1 | JP/minggu Blok 2 | Guru | Kelas yang diajar
(ISI semua baris. Bila JP/minggu sama di kedua blok, isi angka yang sama.)
MTK | Matematika | Reguler | Y | 4 | 4 | (ISI) | (ISI)
PJOK | PJOK | Reguler | T | 2 | 2 | (ISI) | (ISI)
...

Catatan: JP per mapel boleh berbeda antar blok karena jumlah hari REGULER/PRODUKTIF
per blok bisa berbeda. Mapel Reguler hanya di hari REGULER, Produktif hanya di hari PRODUKTIF.
Laboratorium bersama: (ISI daftar lab dan mapel yang memakainya)

=== 5. KETERSEDIAAN GURU (opsional) ===
Guru | Blok | Hari/JP tidak tersedia
(ISI bila ada)

=== 6. ATURAN ===
HARD:
 R1 Guru tidak boleh di dua kelas pada jam yang sama (dalam blok yang sama).
 R3 PJOK tidak tepat sebelum atau sesudah istirahat panjang.
 H  Mapel hanya di hari yang jenisnya sama; satu sesi tidak melintasi istirahat;
    lab tidak dipakai dua kelas bersamaan; JP tiap mapel terpenuhi sesuai data.
SOFT (urut prioritas):
 R4 Hindari jeda panjang guru dalam satu hari; usahakan minimal 1 hari bebas per blok
    per guru bila beban memungkinkan.
 R2 Mapel berat (Matematika, dll.) di jam awal bila memungkinkan.
 S  Mapel yang sama tidak muncul di dua sesi terpisah pada hari yang sama.
 S  Posisi JP mapel dibuat mirip antara Blok 1 dan Blok 2 bila memungkinkan.
 R5-R7 (ISI aturan tambahan sekolah, atau tulis "tidak ada")
 R8 Cek silang guru antar kelas dan antar blok sebelum menyatakan FINAL.

=== 7. LANGKAH KERJA YANG HARUS KAMU IKUTI ===
 1. Validasi data: tampilkan data yang ambigu/kurang. Hitung kapasitas per kelas per blok
    (total JP produktif vs slot hari produktif, total JP reguler vs slot hari reguler) dan
    kapasitas per guru. Bila ada yang tidak mungkin, berhenti dan laporkan dulu.
 2. Susun jadwal Blok 1, lalu Blok 2.
 3. Verifikasi mandiri: periksa ulang SEMUA aturan HARD pada hasil akhir, cek silang guru
    lintas kelas dan lintas blok. Jangan menyatakan "tidak ada bentrok" tanpa bukti tabel.
 4. Bila ada yang tidak bisa dipenuhi, jangan disembunyikan: masukkan ke daftar kendala.

=== 8. FORMAT KELUARAN ===
 A. Ringkasan validasi dan asumsi.
 B. Tabel jadwal terpisah Blok 1 dan Blok 2, per kelas (kolom hari, baris JP lengkap dengan jam).
 C. Jadwal per GURU untuk Blok 1 dan Blok 2: kolom hari, baris JP, isi mapel + kelas,
    ditambah total JP per hari dan per minggu.
 D. Rekap total JP per mapel dan per guru (Blok 1, Blok 2, dan total).
 E. Daftar bentrok/kendala yang tidak bisa dipenuhi + saran solusi.
 F. Checklist verifikasi R1-R8 dengan status LULUS / PERINGATAN / GAGAL.
Bila datanya terlalu besar untuk satu jawaban, kerjakan per jurusan dan beri tahu aku
urutannya; jangan memotong tabel secara diam-diam.
```
