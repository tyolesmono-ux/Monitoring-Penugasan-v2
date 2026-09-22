# Riwayat Perubahan (Changelog)
# SIMPELGAS — Sistem Monitoring Penugasan & Laporan Kegiatan ASN
### Dinas Tenaga Kerja Kota Surakarta

---

Semua perubahan signifikan pada proyek ini didokumentasikan dalam file ini.

Format mengacu pada [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), dan proyek ini mengikuti [Semantic Versioning](https://semver.org/lang/id/).

---

## [Unreleased]

### Planned (P1 — Sprint Berikutnya)
- Re-aktivasi Modul Monitoring Internal (rapat dinas, sosialisasi internal, daftar hadir).

### Planned (P2 — Setelah P1)
- Integrasi notifikasi WhatsApp / Telegram untuk laporan mendesak.

### Planned (P3 — Jangka Panjang)
- Tanda tangan digital (e-Signature) dan QR Code validasi pada lembar cetak.

---

## [2.1.0] — 2026-09-22

### Ditambahkan
- **Modul Daftar Laporan Penugasan (`/laporan`)**: Halaman penjelajahan laporan dengan kartu KPI, penyaringan bidang & status lock, pencarian teks, dan dialog verifikasi NIP via SweetAlert2.
- **Modul Formulir Edit Laporan (`/laporan/[id]/edit`)**: Antarmuka penyuntingan laporan penugasan ASN dengan preservasi dokumen Drive yang sudah ada, galeri hapus berkas, upload berkas baru terkompresi otomatis, fitur Dikte Suara (STT), dan AI text enhancement.
- **Server Action `updateLaporan()`**: Mutasi aman dengan validasi Zod `UpdateLaporanSchema`, pembatasan Base64 (4.2 MB), verifikasi kecocokan NIP terhadap master pegawai (`getPegawai()`), serta guard locking status evaluasi pimpinan.
- **Backend Google Apps Script Batch Update**: Handler `updateLaporan` di `code.gs` menggunakan batch array update (`getValues()` / `setValues()`) 1 kali transaksi untuk performa tinggi tanpa mengubah kolom evaluasi pimpinan (`Catatan Pimpinan` & `Status Tindak Lanjut`).
- **Navigasi Sidebar Baru**: Tautan navigasi "Daftar Laporan" (`/laporan`, icon `ClipboardList`) tersemat pada bilah navigasi utama.
- **Pengujian Otomatis Komprehensif**: Penambahan pengujian unit di `tests/validations.test.ts`, `tests/actions.test.ts`, `tests/laporan-list.test.tsx`, `tests/edit-laporan.test.tsx`, dan `tests/ui-states.test.tsx` (100% lulus).

---

## [2.0.0] — 2026-09-02

### Migrasi Arsitektur Besar (Breaking Change dari v1.x)
- **Migrasi dari Supabase ke Google Apps Script + Google Spreadsheet** sebagai backend engine utama, menghilangkan biaya berlangganan server basis data bulanan.
- Seluruh logika CRUD data kini dieksekusi via Google Apps Script Web App (`code.gs`) yang ter-deploy di akun Google Workspace resmi dinas.

### Ditambahkan
- **Modul AI Text Enhancement**: Integrasi Google Gemini 2.5 Flash melalui endpoint proxy `/api/enhance/route.ts` untuk menyempurnakan catatan kegiatan menjadi format bahasa kedinasan formal.
- **Portal Pimpinan Berjenjang** (`/pimpinan`): Otentikasi PIN berbasis peran (Kepala Dinas, Sekretaris, Kabid, Kasubag) dengan sesi Cookie HTTP-Only berdurasi 8 jam.
- **RBAC (Role-Based Access Control)**: Filtering data berbasis scope jabatan (ALL / BIDANG PPTK / BIDANG HUBUNGAN INDUSTRIAL / SEKRETARIAT).
- **Ekspor Excel & PDF**: Fitur ekspor rekapitulasi evaluasi ke `.xlsx` (SheetJS) dan `.pdf` (jsPDF + AutoTable) dari Portal Pimpinan.
- **Bypass CORS Media Cetak**: Server Action `getDirectImageBase64()` men-proxy gambar Google Drive ke Data URL Base64 agar foto muncul 100% pada dialog cetak browser.
- **Kompresi Gambar Klien**: HTML5 Canvas 2D mengompres foto kamera (5–15 MB) menjadi ~200–400 KB (JPEG 70%, max 1200px) sebelum dikirim.
- **Next.js Middleware Guard**: `src/middleware.ts` mengamankan seluruh rute `/pimpinan/*` di edge level.
- **Design System Civic Spectrum**: Palet warna baru Sky Blue + Pink + Violet menggantikan palet Navy + Amber lama (`tailwind.config.ts` dalam proses migrasi bertahap).
- **Unit Testing dengan Vitest**: Rangkaian tes di `tests/` mencakup `actions.test.ts`, `appscript.test.ts`, `excel-validation.test.ts`, dan `print-utils.test.ts`.
- **Definition of Done berbasis 5 Evidence Gates**: Standar kelulusan kode yang dapat diverifikasi mesin (`npm run ci:local`).

### Diubah
- `src/lib/appscript.ts`: Adapter HTTP tangguh dengan `redirect: 'follow'`, normalisasi tanggal `DD/MM/YYYY` → `YYYY-MM-DD`, dan `normalizePersonName()` untuk toleransi variasi gelar pegawai.
- `next.config.js`: Body size limit Server Action ditingkatkan dari default 1 MB menjadi 10 MB untuk akomodasi lampiran foto dan dokumen.
- Konvensi penamaan file komponen: sufiks `-client.tsx` untuk Client Components interaktif.

### Dihapus
- Ketergantungan pada Supabase (PostgreSQL cloud): seluruh import dan konfigurasi Supabase dihapus dari kode aktif.

---

## [1.0.0] — 2025 (Estimasi)

### Rilis Pertama (Legacy)
- Implementasi awal menggunakan Next.js + Supabase sebagai backend.
- Form input laporan penugasan dasar.
- Dashboard statistik sederhana.
- Halaman cetak lembar laporan kedinasan.

---

## Panduan Penulisan Changelog

Setiap rilis baru, tambahkan seksi di atas seksi `[Unreleased]` dengan format:

```markdown
## [X.Y.Z] — YYYY-MM-DD

### Ditambahkan
- Fitur baru yang ditambahkan.

### Diubah
- Perubahan pada fitur yang sudah ada.

### Diperbaiki
- Bug yang diperbaiki.

### Dihapus
- Fitur yang dihapus.

### Keamanan
- Perbaikan celah keamanan.
```

Gunakan format *Conventional Commits* sebagai referensi saat menulis entri changelog.
