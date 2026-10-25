# Log Asumsi & Keputusan Domain (ASSUMPTIONS.md)

Dokumen ini mencatat konfirmasi pengguna, asumsi domain yang diambil, dan justifikasi desain sesuai aturan `AGENT.md`.
Format pencatatan: `[YYYY-MM-DD] konteks | pilihan | alasan`.

---

## Log Keputusan & Konfirmasi

- **[2026-10-24] Q1: Program Keahlian ke-8** | **Pilihan**: `LAS` (Teknik Pengelasan). | **Alasan**: Dikonfirmasi langsung oleh pengguna bahwa SMK ini memiliki 8 program keahlian lengkap: `AK`, `TKR`, `TKJ`, `PSPT`, `KUL`, `DPB`, `APAT`, dan `LAS`.
- **[2026-10-24] Q2: Kode Jurusan AK** | **Pilihan**: Disimpan apa adanya sesuai input ("Akuntansi dan Keahlian Lembaga" atau "Akuntansi dan Keuangan Lembaga"). | **Alasan**: Menghindari salah tafsir data administratif sekolah.
- **[2026-10-24] Q3: Pola PSPT 1 & 2** | **Pilihan**: Blok 2 diasumsikan kebalikan simetris dari Blok 1, ditandai `is_assumed = true` di UI hingga dikonfirmasi pengguna di Menu 4. | **Alasan**: Data brief awal baru mencantumkan PSPT 1 Blok 1 dan PSPT 2 Blok 2.
- **[2026-10-24] Q4: JP per Minggu Dua Blok** | **Pilihan**: Disimpan terpisah `jp_blok1` dan `jp_blok2`; bila input 1 angka, diduplikasi ke keduanya. | **Alasan**: Mengantisipasi perbedaan jumlah hari produktif/reguler antar blok.
- **[2026-10-24] Q6: Template Jam Efektif** | **Pilihan**: Durasi 45 menit/JP, 10 JP (Senin-Kamis), 7 JP (Jumat), 2 istirahat dengan istirahat kedua sebagai ISHOMA (`is_long_break=1`). | **Alasan**: Standar durasi jam SMK Indonesia dan prasyarat aturan PJOK R3.
- **[2026-10-24] Q8: Team Teaching Awal** | **Pilihan**: 1 guru per mapel-kelas pada v1 awal. | **Alasan**: Mengacu pada batasan non-tujuan PRD.md awal.
- **[2026-10-25] Team Teaching Produktif (Matrix SK & sync-mapel-matrix)** | **Pilihan**: Pembagian jam mengajar mapel produktif antar guru serombel (contoh: 12 JP dibagi 9 JP & 3 JP untuk 1 rombel, atau 18 JP & 6 JP untuk 2 rombel) didukung langsung di Matrix SK dengan validasi otomatis agar total JP per rombel tidak melebihi kuota beban standar mapel. Sinkronisasi otomatis mengupdate cell rombel, badge guru, dan daftar mapel & kode (`guruJp`). | **Alasan**: Permintaan pengguna untuk kebutuhan pembelajaran produktif SMK dengan sistem blok dan team teaching tanpa membuat admin bingung.

