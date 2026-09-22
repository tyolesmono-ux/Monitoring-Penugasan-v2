# Spesifikasi Desain: Fitur Edit Laporan Penugasan ASN

> Tanggal: 2026-09-22  
> Status: Validated & Approved  
> Target: SIMPELGAS v2.1.0  

---

## 1. Latar Belakang & Masalah
Saat ini, ASN Dinas Tenaga Kerja Kota Surakarta dapat menginput laporan penugasan melalui `/input` dan mencetak lembar dinas melalui `/cetak`. Namun, jika terjadi kesalahan ketik (typo), perubahan notulen hasil rapat, atau penambahan/penggantian foto dokumentasi dan berkas materi kegiatan setelah disubmit, ASN tidak memiliki mekanisme untuk mengedit laporan tersebut secara mandiri. Hal ini menyebabkan laporan ganda atau data yang keliru di Spreadsheet `REKAP_LAPORAN`.

---

## 2. Alur Pengguna (User Flow)

```
[Sidebar Navigasi]
       │
       ▼ Klik "Daftar & Edit Laporan"
[/laporan] (Halaman Daftar Laporan)
  ├── Filter: Pilih Bidang, Nama Pegawai, Rentang Tanggal
  ├── Tabel / Kartu Riwayat Laporan ASN
  │     ├── Kolom Status: "Dapat Diedit" (Hijau) vs "Terkunci: Sudah Dievaluasi" (Abu-abu)
  │     └── Tombol "Edit Laporan"
  │
  ▼ Klik "Edit Laporan" pada baris laporan yang belum dievaluasi
[Modal Verifikasi NIP]
  ├── Muncul dialog SweetAlert2 / Modal custom: "Masukkan NIP Pegawai Pelapor"
  ├── Validasi kecocokan NIP dengan `DATA_PEGAWAI`
  │
  ▼ Jika NIP cocok
[/laporan/[id]/edit] (Formulir Edit Laporan)
  ├── Data lama otomatis terisi (pre-filled)
  ├── Galeri Foto lama (bisa dihapus per foto) + Dropzone tambah foto baru
  ├── Daftar Berkas materi lama (bisa dihapus per file) + Dropzone tambah berkas baru
  ├── Fitur Dikte Suara (STT) + AI Text Enhancement pada catatan hasil
  │
  ▼ Klik "Simpan Perubahan Laporan"
[Server Action: updateLaporan]
  ├── Validasi Zod di server
  ├── Upload foto/berkas baru ke Google Drive
  ├── Gabungkan URL file lama yang dipertahankan + URL file baru
  ├── Kirim update ke Google Apps Script (doPost)
  ├── Revalidasi Next.js cache
  │
  ▼ Sukses
Redirect ke `/laporan` dengan Toast notifikasi sukses
```

---

## 3. Komponen & Arsitektur File

| File | Tipe | Tanggung Jawab |
|---|---|---|
| `code.gs` | Backend (Apps Script) | Menangani `action === 'updateLaporan'` pada `doPost()` untuk memperbarui baris tertentu di Spreadsheet tanpa menimpa evaluasi pimpinan |
| `src/lib/types.ts` | Type Definition | Menambahkan tipe `UpdateLaporanPayload` dan payload edit |
| `src/lib/validations.ts` | Zod Schema | Skema validasi data edit laporan (`UpdateLaporanSchema`) |
| `src/lib/appscript.ts` | HTTP Adapter | Fungsi `updateLaporanInAppsScript()` via HTTP POST text/plain |
| `src/lib/actions.ts` | Server Action | Action `updateLaporan()` dengan proteksi verifikasi NIP dan status lock |
| `src/components/sidebar.tsx` | Navigasi | Menambahkan item menu `Daftar & Edit Laporan` (`/laporan`) |
| `src/app/laporan/page.tsx` | Server Component | Halaman daftar laporan yang memuat data awal laporan dan master pegawai |
| `src/components/laporan-list-client.tsx` | Client Component | Daftar tabel/kartu laporan, filter, status badge, dan trigger modal NIP |
| `src/app/laporan/[id]/edit/page.tsx` | Server Component | Halaman form edit berdasar `params.id` (Row_Index) |
| `src/components/edit-laporan-client.tsx` | Client Component | Form edit interaktif (pre-filled, multi-file retention/addition, STT, AI) |
| `tests/edit-laporan.test.tsx` | Unit/Integration Test | Test suite Vitest untuk alur edit, status lock, dan mutasi data |

---

## 4. Keamanan & Integritas Data

1. **Status Lock (Anti-Tampering)**:
   - Jika laporan sudah memiliki `catatan_pimpinan` (tidak kosong) atau statusnya bukan status awal `"Untuk Diketahui"`, laporan dinyatakan terkunci.
   - Server Action akan menolak request mutasi jika status laporan di server telah dievaluasi.
2. **Proteksi NIP (Ownership Verification)**:
   - Sebelum mengakses form edit, pengguna memvalidasi NIP pegawai yang bersangkutan.
   - Server Action juga memverifikasi bahwa `pegawai_id` / NIP cocok dengan data laporan sebelum commit ke Google Sheets.
3. **Preservasi Catatan Pimpinan**:
   - Skrip `code.gs` secara eksplisit mempertahankan kolom `Status Tindak Lanjut` dan `Catatan Pimpinan` agar tidak pernah terhapus oleh aksi edit pegawai.

---

## 5. Kontrak Data Google Apps Script (`code.gs`)

### Payload `doPost` untuk Edit:
```json
{
  "action": "updateLaporan",
  "rowIndex": 5,
  "namaPegawai": "Budi Santoso, S.Kom",
  "bidang": "Sekretariat",
  "jenisPenugasan": "Rapat Koordinasi",
  "tanggalKegiatan": "2026-09-22",
  "namaKegiatan": "Rapat Koordinasi Anggaran",
  "tempatKegiatan": "Ruang Rapat Disnaker",
  "penyelenggara": "Disnaker Kota Surakarta",
  "tamuUndangan": "Kasubag dan staf",
  "catatanHasil": "Notulen revisi...",
  "existingDokUrls": ["https://drive.google.com/file/d/xxx/view"],
  "existingMateriUrls": [],
  "dokumentasi": [
    { "name": "foto_baru.jpg", "mime": "image/jpeg", "base64": "..." }
  ],
  "materi": []
}
```

### Response:
```json
{ "status": "success", "message": "Laporan berhasil diperbarui" }
```

---

## 6. Standar Desain UI/UX (Anti-Slop & Impeccable)
- Menggunakan palet Civic Spectrum resmi (tanpa hardcoded hex).
- Ikon 100% dari `lucide-react`.
- Tipografi proporsional: Label `text-sm font-semibold`, input `h-10 text-sm`, textarea `min-h-[130px]`.
- Notifikasi menggunakan SweetAlert2 dengan warna token `DESIGN_TOKENS.sweetAlert.confirmButtonColor`.
