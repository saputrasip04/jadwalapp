# PRD — Aplikasi Penjadwal Blok SMK

Versi: 1.0 | Status: Draft siap implementasi | Bahasa UI: Indonesia

---

## 1. Ringkasan

Aplikasi web offline-first untuk menyusun jadwal pelajaran SMK **sistem blok** (Blok 1 = minggu ganjil, Blok 2 = minggu genap),
dengan pola hari PRODUKTIF/REGULER berbeda per kelas, guru dan laboratorium dipakai bersama, serta jaminan **bebas bentrok** dan **tidak crash**.

## 2. Tujuan & Non-Tujuan

**Tujuan**
- G1: Wakil Kurikulum dapat menyusun jadwal lengkap Blok 1 dan Blok 2 dalam satu sesi kerja.
- G2: Nol bentrok guru/lab/kelas pada jadwal berstatus FINAL, dibuktikan verifier independen.
- G3: Aplikasi tetap hidup dan tidak kehilangan data pada input salah, data korup, atau tab tertutup mendadak.
- G4: Semua kendala yang tidak terpenuhi dilaporkan beserta saran solusi, tidak disembunyikan.
- G5: Keluaran siap cetak: per kelas, per jurusan, per guru, dan jadwal total.

**Non-Tujuan (v1)**
- Login multi-pengguna / sinkronisasi cloud.
- Presensi, nilai, atau modul akademik lain.
- Team teaching (dua guru satu mapel satu kelas pada slot sama). Dicatat sebagai v2.
- Penjadwalan ujian / PKL.

## 3. Pengguna

| Persona | Kebutuhan |
|---------|-----------|
| Wakil Kepala Sekolah Kurikulum (utama) | Input data, jalankan penyusunan, perbaiki manual, finalisasi, cetak |
| Operator/TU | Input & impor data guru, mapel, kelas |
| Guru / Ketua Jurusan (baca saja) | Lihat dan cetak jadwal pribadi / jurusan |

## 4. Konsep Domain

- **Level**: X, XI, XII.
- **Jurusan** (program keahlian): AK, TKR, TKJ, PSPT, KUL, DPB, APAT, LAS (Teknik Pengelasan) — total 8 program keahlian.
- **Kelas/Rombel**: contoh `X PSPT 1`, `XI TKJ 2`.
- **Blok**: 1 (minggu ganjil) dan 2 (minggu genap). Tidak pernah bersamaan.
- **Pola blok kelas**: untuk tiap kelas, tiap blok, tiap hari (Sen-Jum): `PRODUKTIF` atau `REGULER`.
- **Mapel**: jenis `PRODUKTIF`/`REGULER`; atribut: berat, PJOK, butuh lab.
- **JP**: Jam Pelajaran. **Slot**: kombinasi (blok, kelas, hari, JP).
- **Sesi**: kelompok JP berurutan dari satu mapel pada satu hari (mis. 3 JP berturut-turut).
- **Pengampu**: penugasan guru ke (mapel x kelas).
- **Istirahat panjang**: istirahat bertanda `is_long_break` (mis. ISHOMA), dipakai aturan PJOK.

### Contoh pola (dari brief)

| Kelas | Blok | Sen | Sel | Rab | Kam | Jum | Catatan |
|-------|------|-----|-----|-----|-----|-----|---------|
| PSPT 1 | 1 | P | P | P | R | R | dari brief |
| PSPT 1 | 2 | R | R | R | P | P | ASUMSI: kebalikan |
| PSPT 2 | 1 | P | P | R | R | R | ASUMSI: kebalikan |
| PSPT 2 | 2 | R | R | P | P | P | dari brief |

Catatan: pada Blok 1, PSPT 1 dan PSPT 2 sama-sama PRODUKTIF di Senin-Selasa. Jika guru/lab produktif dipakai bersama, di situlah risiko bentrok tertinggi. Solver dan pre-flight wajib memeriksa ini.

## 5. Arsitektur Informasi — 12 Menu Sidebar

Sidebar kiri, bernomor 1-12, tiap item punya **lencana status**: `Belum diisi` / `Lengkap` / `Peringatan (n)` / `Error (n)`.
Bar atas: nama sekolah, tahun ajaran/semester, indikator simpan (`Tersimpan 10:42` / `Menyimpan...` / `Gagal simpan`), Undo/Redo, tombol Backup, pemilih Blok (1/2) di menu jadwal.

**Readiness Gate**: menu 8-12 terkunci (read-only, dengan daftar yang kurang) sampai pemeriksaan data menu 1-7 lulus.

---

## 6. Spesifikasi Per Menu

### Menu 1 — SETTING UTAMA GURU DAN JP
Tujuan: parameter global dan beban guru.

Bagian A — Identitas & Kalender: nama sekolah, tahun ajaran, semester, hari aktif (default Sen-Jum), pemetaan Blok 1 = minggu ganjil, Blok 2 = minggu genap.
Bagian B — Parameter JP: durasi JP (menit), maks JP per hari per kelas, apakah sesi boleh melintasi istirahat pendek (default tidak), maks JP per sesi (default 3).
Bagian C — Parameter Guru (default global, bisa di-override per guru di menu 6): beban minimal & maksimal JP/minggu, maks JP per hari, minimal hari bebas per blok (default 1), maks jeda (gap) JP yang ditoleransi (default 1).
Bagian D — Bobot Aturan: slider bobot soft (S1-S8) dan saklar R3 hard/soft, dengan tombol "Kembalikan default".
Bagian E — Aturan R5-R7: tiga slot aturan tambahan (teks + jenis hard/soft + parameter), kosong secara default. Usulan yang bisa diaktifkan: R5 lab maksimal satu kelas per slot; R6 mapel yang sama maksimal satu sesi per hari; R7 guru tidak mengajar lebih dari N JP berturut-turut.
Bagian F — Tabel ringkas guru: kode, nama, status aktif, beban min/maks, total JP terpasang (dihitung dari menu 6), selisih, lencana (kurang/lebih/pas).

Kriteria penerimaan:
- Nilai di luar rentang ditolak dengan pesan jelas.
- Mengubah parameter yang membuat jadwal tersimpan tidak valid menandai jadwal "Perlu diverifikasi ulang", tidak menghapusnya.

### Menu 2 — DAFTAR MATA PELAJARAN DAN KODE
Tujuan: master mapel.

Kolom: kode (unik, huruf besar), nama, kelompok (Umum / Kejuruan C1 / C2 / C3 / Muatan Lokal / lainnya), **jenis** (PRODUKTIF/REGULER), `berat` (Y/T), `pjok` (Y/T), `butuh_lab` (Y/T + pilih lab), `maks_jp_sesi` (opsional), aktif.
Fitur: tambah/ubah/nonaktifkan, impor Excel (template diunduh dari aplikasi), pencarian, filter, deteksi duplikat (kode atau nama mirip).

Kriteria penerimaan:
- Kode duplikat ditolak; nama kemiripan tinggi memunculkan peringatan.
- Mapel yang dipakai di menu 3/5/6 tidak bisa dihapus, hanya dinonaktifkan, dan muncul daftar pemakainya.
- Hanya satu mapel boleh bertanda PJOK per kelompok pola; bila banyak, semua ditandai (aturan R3 berlaku ke semuanya).

### Menu 3 — MATRIX SK (Struktur Kurikulum)
Tujuan: JP standar tiap mapel per level per jurusan.

Tampilan: baris = mapel, kolom = Level (X/XI/XII) dikelompokkan per jurusan; sel = JP per minggu untuk Blok 1 dan Blok 2 (dua sub-kolom, atau satu angka lalu dikembangkan ke dua blok). Baris total JP per kolom; penanda bila total melebihi kapasitas pola.
Fitur: isi massal (salin kolom, isi seragam), impor Excel, ekspor, tampilkan hanya mapel aktif, validasi total.

Kriteria penerimaan:
- Sel hanya menerima bilangan bulat 0-20.
- Total JP PRODUKTIF dan REGULER per (jurusan, level, blok) dibandingkan dengan kapasitas slot hari bertipe sama dari pola kelas. Lebih besar = **Error**; lebih kecil = **Peringatan jam kosong kelas**.
- Perubahan matrix menawarkan "Terapkan ke kelas" (menu 5) tanpa menimpa override manual kecuali dipilih.

### Menu 4 — MENU JURUSAN
Tujuan: jurusan, kelas/rombel, dan pola blok.

Bagian A — Jurusan: kode, nama, status aktif; banner jika jumlah jurusan aktif < 8.
Bagian B — Rombel: jumlah rombel per level per jurusan; nama otomatis (`X PSPT 1`), wali kelas (opsional).
Bagian C — **Editor Pola Blok**: untuk tiap kelas, grid 2 blok x 5 hari; klik sel ganti P/R; tombol "Kebalikan Blok 1", "Salin ke kelas lain", "Terapkan default jurusan". Sel hasil asumsi diberi ikon `asumsi` sampai dikonfirmasi pengguna.
Bagian D — Ringkasan beban hari: hitung jumlah hari P dan R per blok per kelas, dan jumlah slot tersedianya.

Kriteria penerimaan:
- Tiap hari tiap blok bernilai P atau R, tidak boleh kosong.
- Kelas dengan pola tak lengkap tidak lolos Readiness Gate.
- Hapus jurusan/kelas yang sudah punya jadwal hanya bisa nonaktifkan, dengan peringatan dampak.

### Menu 5 — MENU MATA PELAJARAN
Tujuan: mapel yang benar-benar diajarkan per kelas (hasil turunan Matrix SK + override).

Tampilan: pilih kelas -> daftar mapel kelas itu dengan JP Blok 1, JP Blok 2, pola sesi (mis. `3+3`), lab, status (`dari SK` / `override`), pengampu (read-only, ubah di menu 6).
Fitur: "Bangkitkan dari Matrix SK" (tidak menimpa override), override per kelas, tambah mapel khusus kelas, atur pola sesi manual, tandai "kunci posisi" ke slot tertentu (mis. upacara, ekstrakurikuler yang ditetapkan).

Kriteria penerimaan:
- Pola sesi harus berjumlah sama dengan JP blok tersebut; jika tidak, ditolak.
- Mapel tanpa pengampu ditandai merah dan menahan Readiness Gate.
- Menampilkan total JP produktif/reguler kelas vs kapasitas (indikator hijau/kuning/merah).

### Menu 6 — DAFTAR GURU DAN JURUSAN KELAS
Tujuan: master guru, kompetensi, ketersediaan, penugasan pengampu.

Bagian A — Guru: kode, NIP/NIK (opsional), nama, status aktif, override parameter dari menu 1, kompetensi (mapel yang boleh diampu).
Bagian B — Penugasan: grid (mapel x kelas) -> pilih guru. Mendukung penugasan massal ("guru A mengampu mapel M di semua kelas X TKJ").
Bagian C — Ketersediaan: grid per guru, blok x hari x JP, status `bisa` / `tidak bisa` / `hindari` (soft).
Bagian D — Ringkasan beban: per guru, JP Blok 1, JP Blok 2, rata-rata/minggu, jumlah kelas, jurusan yang diajar, hari kerja minimum yang diperlukan.
Bagian E — Peta guru lintas jurusan/kelas (indikator "guru bersama") agar kandidat bentrok terlihat.

Kriteria penerimaan:
- Guru tidak kompeten di mapel itu memunculkan peringatan (bukan blokir) dan dicatat.
- Guru dengan JP terpasang di luar [min, maks] ditandai.
- Pre-flight per guru: JP per blok <= jumlah slot tersedia di hari-hari ketika kelas-kelasnya berhak (lihat 8.3).

### Menu 7 — TEMPLATE JAM EFEKTIF
Tujuan: definisi slot waktu per hari.

Tampilan: tabel per hari (Sen-Jum): urutan baris berisi `JP n` atau `Istirahat`, mulai, selesai; durasi dihitung otomatis. Tiap istirahat punya penanda `panjang` (Y/T). Dukungan template berbeda untuk Jumat (jam lebih pendek) dan hari tertentu.
Fitur: "Bangkitkan otomatis" dari jam mulai, durasi JP, dan posisi istirahat; salin hari; pratinjau.

Kriteria penerimaan:
- Waktu berurutan tanpa tumpang tindih; selisih mulai-selesai JP = durasi (atau penyimpangan diberi peringatan).
- Minimal satu istirahat panjang harus ditandai bila ada PJOK (R3).
- Mengubah template saat sudah ada jadwal: tampilkan dampak (JP yang hilang/bergeser); butuh konfirmasi; snapshot otomatis.

### Menu 8 — TEMPLATE JADWAL
Tujuan: pusat penyusunan, penguncian, dan perbaikan manual. Satu-satunya menu yang mengubah jadwal.

Bagian A — Panel Pre-flight: hasil validasi kapasitas kelas/guru/lab, daftar masalah beserta tautan perbaikan.
Bagian B — Kontrol Solver: pilih blok (1, 2, atau keduanya), `seed`, batas waktu (default 60 detik), mode (`Susun baru` / `Lanjutkan dari jadwal terkunci` / `Perbaiki konflik`), tombol Mulai/Batal, progres (jumlah sesi terpasang, skor, waktu).
Bagian C — Editor Grid: pilih kelas atau tampilan semua; sel dapat diseret (drag-drop) atau diubah lewat dialog; saat sel dipilih, **sorot sel yang legal** (hijau) dan **sel yang melanggar** (merah + alasan); kunci/lepas kunci sel; undo/redo.
Bagian D — Panel Konflik & Kendala: daftar berurut keparahan, kode aturan, penjelasan, saran, tombol "Loncat ke sel".
Bagian E — Status & Finalisasi: `DRAFT` -> `TERVERIFIKASI` -> `FINAL`. Tombol "Verifikasi Silang (R8)" menjalankan verifier independen. FINAL hanya aktif bila 0 pelanggaran HARD dan semua JP terpenuhi (atau pengecualian dicatat eksplisit).
Bagian F — Versi: simpan sebagai varian (A/B), bandingkan skor dan konflik, pulihkan.

Kriteria penerimaan:
- Solver tidak pernah melempar error ke UI; selalu mengembalikan `entries`, `unplaced`, `conflicts`, `stats`.
- Pemindahan manual yang melanggar HARD ditolak secara default; dapat dipaksa dengan konfirmasi + dicatat sebagai konflik.
- Mengubah data menu 1-7 setelah ada jadwal menandai jadwal "Perlu diverifikasi ulang" dengan penjelasan perubahan.

### Menu 9 — JADWAL TOTAL
Tampilan matriks: baris = kelas (dikelompokkan per level/jurusan), kolom = hari x JP, per blok (toggle Blok 1/Blok 2/berdampingan). Sel = kode mapel + kode guru (mis. `MTK/G07`), warna berdasarkan jenis (P/R) dengan label teks. Filter jurusan/level/guru/mapel, zoom, kolom beku, mode cetak A3 landscape, ekspor XLSX/PDF. Sel konflik berbingkai merah.

### Menu 10 — JADWAL PERJURUSAN
Pilih jurusan, lalu tampil semua kelasnya (X/XI/XII), per blok, kolom hari, baris JP lengkap dengan jam. Ringkasan JP per mapel per kelas. Ekspor/cetak satu jurusan satu dokumen.

### Menu 11 — JADWAL PERKELAS
Pilih kelas dan blok; tabel kolom hari, baris JP (nomor, jam mulai-selesai, istirahat ditampilkan sebagai baris), sel = mapel + guru + lab. Bisa menampilkan Blok 1 dan Blok 2 berurutan di satu halaman. Ekspor/cetak per kelas atau semua kelas sekaligus (satu halaman per kelas).

### Menu 12 — JADWAL PERGURU
Pilih guru dan blok; tabel kolom hari, baris JP, sel = mapel + kelas. Baris bawah: **total JP per hari**, kolom kanan/ujung: **total JP per minggu**. Tampilkan hari bebas, jumlah jeda (gap), rekap per kelas. Ekspor/cetak per guru atau semua guru. Tab **Rekap**: total JP per mapel dan per guru (Blok 1, Blok 2, rata-rata, terhadap [min,maks]).

---

## 7. Aturan Penjadwalan

### 7.1 Aturan HARD (tidak boleh dilanggar pada status FINAL)

| Kode | Aturan |
|------|--------|
| R1 | Guru tidak mengajar di dua kelas pada (blok, hari, JP) yang sama |
| H2 | Satu slot kelas berisi paling banyak satu entri |
| H3 | Laboratorium/ruang tidak dipakai dua kelas pada slot yang sama |
| H4 | Mapel PRODUKTIF hanya di hari PRODUKTIF kelas itu; REGULER hanya di hari REGULER |
| H5 | JP tiap (mapel x kelas x blok) terpenuhi persis sesuai target |
| H6 | Guru tidak ditempatkan di slot `tidak bisa` |
| H7 | Tidak ada entri pada baris istirahat; sesi tidak melintasi istirahat (kecuali diizinkan) |
| H8 | Slot terkunci tidak berubah |
| H9 | Maks JP guru per hari tidak terlampaui |
| R3 | PJOK tidak berada tepat sebelum atau sesudah istirahat panjang (bisa direlaksasi lewat Setting, dengan peringatan) |

### 7.2 Aturan SOFT (diminimalkan; bobot di Setting)

| Kode | Aturan | Bobot default |
|------|--------|---------------|
| R2 | Mapel berat di JP awal (sebelum istirahat pertama) | 5 per JP di luar zona |
| R4a | Jeda (gap) guru dalam hari yang sama | 8 per JP kosong; kuadratik bila > maks jeda |
| R4b | Hari bebas guru per blok (target min. 1) | 30 per hari kurang |
| S5 | Mapel sama tampil di dua sesi terpisah pada hari yang sama | 10 |
| S6 | Distribusi mapel merata sepanjang hari-hari sejenis | 3 |
| S7 | Konsistensi posisi JP antar Blok 1 dan Blok 2 untuk (mapel, kelas) yang sama | 2 |
| S8 | Slot `hindari` ketersediaan guru | 15 |
| R5-R7 | Aturan tambahan sekolah (opsional) | diisi pengguna |

### 7.3 R8 — Verifikasi Silang (gerbang FINAL)

Verifier independen menghitung ulang dari data mentah dan menghasilkan laporan:
1. Matriks guru x (blok, hari, JP): tidak ada sel dengan > 1 kelas.
2. Matriks lab x (blok, hari, JP): sama.
3. Untuk tiap guru: gabungan jadwal Blok 1 dan Blok 2 ditampilkan berdampingan; hitung hari bebas, jeda, total JP; bandingkan dengan Setting.
4. Untuk tiap kelas: JP terpasang vs target per mapel per blok.
5. Untuk tiap kelas: jenis mapel vs jenis hari.
6. Keluaran: checklist R1-R8 dengan `LULUS` / `PERINGATAN` / `GAGAL` dan daftar pelanggaran.

## 8. Pre-flight (Sebelum Solver)

Dijalankan otomatis di Menu 8 dan sebagai bagian Readiness Gate.

8.1 **Kapasitas kelas**: untuk (kelas, blok), jumlah JP PRODUKTIF <= jumlah slot di hari PRODUKTIF, dan sama untuk REGULER. Lebih = ERROR (tidak mungkin). Kurang = PERINGATAN (jam kosong).
8.2 **Kelengkapan**: mapel tanpa pengampu, guru tanpa kompetensi, kelas tanpa pola, pola sesi tidak sesuai JP.
8.3 **Kapasitas guru**: untuk (guru, blok), JP total <= jumlah slot unik pada hari-hari yang dimiliki gabungan kelasnya sesuai jenis hari mapel dikurangi slot `tidak bisa`. Tambahan: periksa pasangan kelas yang pola produktifnya identik dan berbagi guru (tekanan bentrok).
8.4 **Kapasitas lab**: JP butuh-lab total per (lab, blok) <= slot tersedia; periksa kelas yang berbagi lab pada hari produktif yang sama.
8.5 **Konsistensi template**: ada istirahat panjang jika ada PJOK; tidak ada JP kurang dari yang dibutuhkan pola hari.
Hasil: daftar masalah dengan tingkat (`ERROR`/`PERINGATAN`/`INFO`), penjelasan, dan saran (mis. "Tambah satu guru produktif", "Ubah pola PSPT 2 Blok 1 agar hari produktif tidak identik dengan PSPT 1", "Pecah lab ke dua ruang", "Kurangi JP X").

## 9. Keluaran & Ekspor

- Tabel jadwal terpisah Blok 1 dan Blok 2, per kelas (kolom hari, baris JP + jam).
- Jadwal per guru, per blok, dengan total JP per hari dan per minggu.
- Rekap total JP per mapel dan per guru.
- Daftar bentrok/kendala + saran.
- Format: tampilan layar, cetak (CSS print), PDF, XLSX (satu sheet per kelas/guru + sheet rekap), CSV, backup JSON penuh.

## 10. Kebutuhan Non-Fungsional

| Aspek | Target |
|-------|--------|
| Stabilitas | Tidak ada crash tak tertangani pada skenario di AGENT.md bagian 8; Error Boundary per menu |
| Integritas data | Autosave maksimal 2 detik setelah perubahan; snapshot bergulir 20; pemulihan otomatis setelah tab ditutup paksa |
| Performa | Fixture 48 kelas / 80 guru: hasil layak dalam <= 60 detik; UI tetap responsif (<100 ms interaksi) |
| Determinisme | Seed sama + input sama = hasil sama |
| Offline | Seluruh fitur jalan tanpa internet setelah dimuat (PWA) |
| Kompatibilitas | Chrome/Edge/Firefox terbaru, layar >= 1280 px (tablet baca saja) |
| Aksesibilitas | Navigasi keyboard, kontras WCAG AA, warna tidak menjadi satu-satunya penanda |
| Privasi | Data tetap di perangkat; tidak ada pengiriman keluar |
| Audit | Log perubahan (siapa tidak ada, tetapi kapan dan apa) + log solver tersimpan per run |

## 11. Metrik Keberhasilan

- 100% jadwal FINAL lulus verifier (0 pelanggaran HARD).
- >= 95% JP terpasang otomatis tanpa edit manual pada data realistis.
- 0 kasus kehilangan data pada uji tutup-paksa 50 kali.
- Waktu dari data lengkap ke jadwal FINAL: kurang dari 30 menit (di luar input data).

## 12. Milestone

| M | Isi | Selesai bila |
|---|-----|--------------|
| M0 | Fondasi: repo, lint, test, DB + migrasi, Error Boundary, logger, Result | Skenario kosong/korup lulus |
| M1 | Menu 1-3 (setting, mapel, matrix SK) + impor Excel | Validasi dan CRUD lulus test |
| M2 | Menu 4-7 (jurusan+pola, mapel kelas, guru, jam efektif) + Readiness Gate + Pre-flight | Fixture contoh lolos gate |
| M3 | Verifier independen + property test | Mutasi pelanggaran selalu terdeteksi |
| M4 | Solver (Web Worker) + Menu 8 | Fixture realistis menghasilkan jadwal tanpa pelanggaran HARD |
| M5 | Menu 9-12 + ekspor XLSX/PDF/cetak | Cetak sesuai format keluaran |
| M6 | Hardening: stres, PWA, backup/pulih, polishing, dokumentasi pengguna | Semua DoD terpenuhi |

## 13. Asumsi & Pertanyaan Terbuka

| # | Hal | Asumsi sementara | Perlu dikonfirmasi |
|---|-----|------------------|--------------------|
| Q1 | Program keahlian ke-8 | LAS (Teknik Pengelasan) | Terkonfirmasi: 8 program keahlian lengkap |
| Q2 | Nama kode `AK` ("Akuntansi dan Keahlian Lembaga") | Disimpan apa adanya | Apakah maksudnya "Akuntansi dan Keuangan Lembaga"? |
| Q3 | Pola PSPT 1 Blok 2 dan PSPT 2 Blok 1 | Kebalikan blok lainnya | Pola sebenarnya? |
| Q4 | Arti "JP per minggu" untuk mapel pada dua blok berbeda | Dua angka terpisah per blok; satu angka berlaku di keduanya | Apakah JP dihitung per minggu blok atau per siklus 2 minggu? |
| Q5 | Jumlah rombel per jurusan per level | Input di Menu 4 | Data sebenarnya |
| Q6 | Template jam (JP/hari, durasi, posisi istirahat, jam Jumat) | Seed contoh di DATABASE.md bagian 9 | Data sebenarnya |
| Q7 | Aturan nomor 5-7 pada brief tidak ada (loncat dari 4 ke 8) | Slot kosong; usulan di Menu 1 bagian E | Apakah ada aturan yang terlewat? |
| Q8 | Satu guru satu mapel satu kelas | Ya (tanpa team teaching) | Perlu team teaching? |
| Q9 | Sesi praktik produktif harus berurutan (blok 2-4 JP) | Maks 3 JP/sesi, dapat diubah per mapel | Kebutuhan sebenarnya? |
| Q10 | Hari bebas guru "minimal 1" | Per blok, soft | Per blok atau lintas blok? |
