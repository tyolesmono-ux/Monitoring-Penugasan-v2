# Edit Laporan Penugasan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menambahkan modul daftar dan edit laporan penugasan ASN yang telah diinput dengan proteksi verifikasi NIP dan status locking jika sudah dievaluasi pimpinan.

**Architecture:** Modul terdiri dari halaman daftar laporan (`/laporan`) untuk pencarian & penyaringan, modal verifikasi NIP pegawai pelapor, formulir edit khusus (`/laporan/[id]/edit`) dengan preservasi lampiran lama + upload lampiran baru, Server Action `updateLaporan`, serta pembaruan backend serverless Google Apps Script (`code.gs`).

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript 5, Tailwind CSS 3, Lucide React, SweetAlert2, Zod, Google Apps Script.

**Spec:** [`docs/superpowers/specs/2026-09-22-edit-laporan-design.md`](docs/superpowers/specs/2026-09-22-edit-laporan-design.md)

## Global Constraints

- Wajib mematuhi 5 Aturan Keras UI: 100% ikon `lucide-react`, bebas emoji Unicode di UI, tanpa hardcoded hex, tanpa token usang `navy`/`amber`, tanpa `alert()`/`confirm()` browser.
- Strict TypeScript: Dilarang menggunakan `any` tanpa justifikasi komentar.
- Backend Apps Script: POST ke Apps Script wajib `Content-Type: text/plain;charset=utf-8` dan `redirect: 'follow'`.
- Preservasi Data: Dilarang menimpa atau mengosongkan kolom `Status Tindak Lanjut` dan `Catatan Pimpinan` saat proses edit laporan.
- Status Locking: Laporan yang memiliki `catatan_pimpinan` terisi atau `status_tindak_lanjut !== 'Untuk Diketahui'` dilarang diedit.
- Verifikasi NIP: Akses form edit dan Server Action wajib memvalidasi kecocokan NIP pegawai pelapor langsung terhadap data master pegawai (`getPegawai()`).

---

### Task 1: Type Definitions, Zod Schemas & Backend code.gs Update

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/appscript.ts`
- Modify: `src/lib/validations.ts`
- Modify: `code.gs:38-95`
- Test: `tests/validations.test.ts`

**Interfaces:**
- Consumes: `Pegawai`, `Laporan`, `LaporanFormData`
- Produces: `UpdateLaporanFormData`, `AppsScriptUpdatePayload`, `UpdateLaporanSchema`

- [x] **Step 1: Write the failing test for UpdateLaporanSchema**

Tambahkan pengujian validasi input update laporan di `tests/validations.test.ts`:
```typescript
import { UpdateLaporanSchema } from '../src/lib/validations'

describe('UpdateLaporanSchema Validation', () => {
  it('validates a valid update laporan payload with nip', () => {
    const validData = {
      rowIndex: 5,
      pegawai_id: 'Budi Santoso, S.Kom',
      nip: '198501012010011001',
      bidang: 'Sekretariat',
      jenis_penugasan: 'Rapat Koordinasi',
      tanggal_kegiatan: '2026-09-22',
      nama_kegiatan: 'Rapat Evaluasi Triwulan',
      tempat_kegiatan: 'Hotel Solo Paragon',
      penyelenggara: 'Disnaker Surakarta',
      tamu_undangan: 'Seluruh OPD',
      catatan_hasil: 'Hasil rapat disepakati bersama',
      existing_dok_urls: ['https://drive.google.com/file/1'],
      existing_materi_urls: [],
    }
    const result = UpdateLaporanSchema.safeParse(validData)
    expect(result.success).toBe(true)
  })

  it('rejects invalid rowIndex or missing required fields including nip', () => {
    const invalidData = {
      rowIndex: -1,
      nip: '',
      nama_kegiatan: '',
    }
    const result = UpdateLaporanSchema.safeParse(invalidData)
    expect(result.success).toBe(false)
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/validations.test.ts`  
Expected: FAIL with `UpdateLaporanSchema is not defined`.

- [x] **Step 3: Implement types, schema, and code.gs update**

1. Tambahkan interface di `src/lib/types.ts`:
```typescript
export interface UpdateLaporanFormData extends LaporanFormData {
  rowIndex: number
  nip: string
  existing_dok_urls?: string[]
  existing_materi_urls?: string[]
}
```

2. Tambahkan interface di `src/lib/appscript.ts`:
```typescript
export interface AppsScriptUpdatePayload extends AppsScriptSubmitPayload {
  action: 'updateLaporan'
  rowIndex: number
  existingDokUrls?: string[]
  existingMateriUrls?: string[]
}
```

3. Tambahkan schema di `src/lib/validations.ts`:
```typescript
export const UpdateLaporanSchema = LaporanFormDataSchema.extend({
  rowIndex: z.number().int().positive('Index baris harus berupa bilangan bulat positif'),
  nip: z.string().trim().min(1, 'NIP pegawai wajib diisi untuk verifikasi kepemilikan'),
  existing_dok_urls: z.array(z.string()).optional(),
  existing_materi_urls: z.array(z.string()).optional(),
})

export type ValidatedUpdateLaporanData = z.infer<typeof UpdateLaporanSchema>
```

4. Perbarui `code.gs` pada fungsi `doPost(e)` untuk menangani `data.action === 'updateLaporan'` menggunakan batch update (1x `setValues`):
```javascript
    if (data.action === "updateLaporan" && data.rowIndex) {
      var rowIndex = parseInt(data.rowIndex);
      if (rowIndex < 2 || rowIndex > sheet.getLastRow()) {
        output.setContent(JSON.stringify({status: "error", message: "Index baris tidak valid"}));
        return output;
      }
      
      var existingDokUrls = data.existingDokUrls || [];
      var existingMateriUrls = data.existingMateriUrls || [];
      var allDocsUrls = existingDokUrls.concat(docsUrls);
      var allMateriUrls = existingMateriUrls.concat(materiUrls);
      
      var rowRange = sheet.getRange(rowIndex, 1, 1, headers.length);
      var rowValues = rowRange.getValues()[0];
      for (var i = 0; i < headers.length; i++) {
        var h = headers[i];
        if (h == "Nama Pegawai") rowValues[i] = data.namaPegawai;
        else if (h == "Bidang") rowValues[i] = data.bidang;
        else if (h == "Jenis Penugasan") rowValues[i] = data.jenisPenugasan;
        else if (h == "Tanggal Kegiatan") {
          var parts = data.tanggalKegiatan.split("-");
          rowValues[i] = parts[2] + "/" + parts[1] + "/" + parts[0];
        }
        else if (h == "Nama Kegiatan") rowValues[i] = data.namaKegiatan;
        else if (h == "Tempat Kegiatan") rowValues[i] = data.tempatKegiatan;
        else if (h == "Penyelenggara Kegiatan") rowValues[i] = data.penyelenggara;
        else if (h == "Tamu Undangan yang Hadir") rowValues[i] = data.tamuUndangan || "";
        else if (h == "Catatan Hasil Kegiatan") rowValues[i] = data.catatanHasil || "";
        else if (h == "Dokumentasi Kegiatan") rowValues[i] = allDocsUrls.join("\n");
        else if (h == "Materi (Jika Ada)") rowValues[i] = allMateriUrls.join("\n");
        // Status Tindak Lanjut & Catatan Pimpinan SENGAJA TIDAK DIUBAH
      }
      rowRange.setValues([rowValues]);
      
      output.setContent(JSON.stringify({status: "success", message: "Laporan berhasil diperbarui"}));
      return output;
    }
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/validations.test.ts`  
Expected: PASS (all tests pass).

- [x] **Step 5: Commit**

```bash
git add src/lib/types.ts src/lib/validations.ts code.gs tests/validations.test.ts
git commit -m "feat(types): tambahkan UpdateLaporan schema dan handler Apps Script"
```

---

### Task 2: HTTP Adapter & Server Actions (`updateLaporan`)

**Files:**
- Modify: `src/lib/appscript.ts`
- Modify: `src/lib/actions.ts`
- Test: `tests/actions.test.ts`

**Interfaces:**
- Consumes: `UpdateLaporanFormData`, `AppsScriptUpdatePayload`, `getLaporan`
- Produces: `updateLaporanInAppsScript()`, `updateLaporan()`

- [x] **Step 1: Write the tests for updateLaporan action**

Tambahkan test case di `tests/actions.test.ts`:
```typescript
  it('rejects updateLaporan with invalid data or missing nip', async () => {
    const { updateLaporan } = await import('@/lib/actions')
    const res = await updateLaporan({ rowIndex: -1 } as any)
    expect(res.status).toBe('error')
  })

  it('rejects updateLaporan if the report has already been evaluated by pimpinan', async () => {
    const { updateLaporan } = await import('@/lib/actions')
    // Mock getLaporan response yang memiliki catatan_pimpinan atau status bukan 'Untuk Diketahui'
    const res = await updateLaporan(mockEvaluatedPayload as any)
    expect(res.status).toBe('error')
    expect(res.message).toContain('telah dievaluasi oleh Pimpinan')
  })

  it('rejects updateLaporan if nip does not match pelapor master data', async () => {
    const { updateLaporan } = await import('@/lib/actions')
    const res = await updateLaporan(mockWrongNipPayload as any)
    expect(res.status).toBe('error')
    expect(res.message).toContain('NIP yang dimasukkan tidak cocok')
  })
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/actions.test.ts`  
Expected: FAIL with `updateLaporan is not exported/defined`.

- [x] **Step 3: Implement updateLaporanInAppsScript and updateLaporan Server Action**

1. Tambahkan `updateLaporanInAppsScript` di `src/lib/appscript.ts`:
```typescript
export async function updateLaporanInAppsScript(
  payload: AppsScriptUpdatePayload
): Promise<{ status: string; message?: string }> {
  const url = process.env.APPSCRIPT_URL
  if (!url) {
    return {
      status: 'error',
      message: 'APPSCRIPT_URL belum dikonfigurasi di file environment.',
    }
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
      redirect: 'follow',
    })

    if (!res.ok) {
      return {
        status: 'error',
        message: `Google Apps Script mengembalikan HTTP ${res.status}: ${res.statusText}`,
      }
    }

    return await res.json()
  } catch (error: any) {
    console.error('[APPSCRIPT] Error updating laporan in Apps Script:', error)
    return {
      status: 'error',
      message: error?.message || 'Gagal memperbarui data di Google Apps Script.',
    }
  }
}
```

2. Tambahkan Server Action `updateLaporan` di `src/lib/actions.ts`:
- Validasi data menggunakan `UpdateLaporanSchema`.
- Cek batas transmisi Base64 lampiran (4.2 MB).
- Cari laporan target dari `getAllLaporan()`.
- Verifikasi status lock: jika `lap.catatan_pimpinan` terisi atau `lap.status_tindak_lanjut !== 'Untuk Diketahui'`, tolak mutasi.
- Verifikasi NIP: Ambil data master dari `getPegawai()`, cocokkan NIP input dengan NIP pegawai pelapor.
- Upload berkas baru dan panggil `updateLaporanInAppsScript`.
- Panggil `revalidateTag('laporan')`, `revalidatePath('/laporan')`, `revalidatePath('/dashboard')`, `revalidatePath('/cetak')`, dan `revalidatePath('/pimpinan')`.

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/actions.test.ts`  
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/lib/appscript.ts src/lib/actions.ts tests/actions.test.ts
git commit -m "feat(actions): implementasikan Server Action updateLaporan dengan guard status lock"
```

---

### Task 3: Sidebar Navigation Link (`/laporan`)

**Files:**
- Modify: `src/components/sidebar.tsx`
- Test: `tests/ui-states.test.tsx`

**Interfaces:**
- Consumes: `navItems`
- Produces: Sidebar link to `/laporan` dengan label "Daftar Laporan" dan icon `ClipboardList`, mempertahankan `FileDown` untuk `/cetak`

- [x] **Step 1: Write the failing test for sidebar navigation**

Di `tests/ui-states.test.tsx`:
```typescript
it('renders Daftar & Edit Laporan navigation item in Sidebar', () => {
  const html = renderToString(<Sidebar />)
  expect(html).toContain('href="/laporan"')
  expect(html).toContain('Daftar Laporan')
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui-states.test.tsx`  
Expected: FAIL with missing `/laporan`.

- [x] **Step 3: Add nav item to sidebar.tsx**

Perbarui array `navItems` di `src/components/sidebar.tsx`:
```typescript
import {
  LayoutDashboard,
  FileEdit,
  ClipboardList,
  FileDown,
  Building2,
  Menu,
  X,
} from 'lucide-react'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/input', label: 'Input Penugasan', icon: FileEdit },
  { href: '/laporan', label: 'Daftar Laporan', icon: ClipboardList },
  { href: '/cetak', label: 'Download PDF', icon: FileDown },
]
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui-states.test.tsx`  
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/components/sidebar.tsx tests/ui-states.test.tsx
git commit -m "feat(navigation): tambahkan menu Daftar Laporan ke sidebar"
```

---

### Task 4: Halaman Daftar Laporan & Verifikasi NIP SweetAlert2 (`/laporan`)

**Files:**
- Create: `src/app/laporan/page.tsx`
- Create: `src/components/laporan-list-client.tsx`
- Test: `tests/laporan-list.test.tsx`

**Interfaces:**
- Consumes: `getAllLaporan()`, `getPegawai()`, `Laporan`, `Pegawai`
- Produces: Halaman `/laporan` responsif dengan filter pencarian, indikator status lock, dan prompt verifikasi NIP via SweetAlert2 sebelum diarahkan ke `/laporan/[id]/edit`

- [x] **Step 1: Write the failing test for LaporanListClient**

Buat `tests/laporan-list.test.tsx`:
```typescript
import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { LaporanListClient } from '../src/components/laporan-list-client'

describe('LaporanListClient', () => {
  const mockLaporan = [
    {
      id: '2',
      pegawai_id: 'Budi Santoso',
      bidang: 'Sekretariat',
      jenis_penugasan: 'Rapat Koordinasi',
      tanggal_kegiatan: '2026-09-22',
      nama_kegiatan: 'Rapat Anggaran',
      tempat_kegiatan: 'Kantor',
      penyelenggara: 'Disnaker',
      status_tindak_lanjut: 'Untuk Diketahui',
      catatan_pimpinan: null,
      created_at: '',
      updated_at: '',
      dokumentasi_urls: [],
      materi_urls: [],
      jabatan: 'Staff',
      tamu_undangan: null,
      catatan_hasil: 'Hasil rapat',
    }
  ]

  it('renders search filter and list of reports', () => {
    const html = renderToString(<LaporanListClient initialLaporan={mockLaporan as any} pegawaiList={[]} />)
    expect(html).toContain('Daftar Laporan Penugasan')
    expect(html).toContain('Rapat Anggaran')
    expect(html).toContain('Edit Laporan')
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/laporan-list.test.tsx`  
Expected: FAIL with `LaporanListClient is not defined`.

- [x] **Step 3: Implement Page and LaporanListClient with SweetAlert2 NIP Prompt**

1. Buat `src/components/laporan-list-client.tsx`:
- Filter bidang, nama pegawai, dan pencarian teks judul kegiatan.
- Kartu / baris laporan menampilkan metadata, status evaluasi pimpinan (badge emerald untuk "Dapat Diedit", badge slate untuk "Terkunci: Sudah Dievaluasi").
- Tombol "Edit Laporan" aktif jika belum dievaluasi, dan nonaktif dengan tooltip jika terkunci.
- Klik tombol "Edit Laporan" memicu `Swal.fire({ title: 'Verifikasi NIP Pegawai', input: 'password', ... })`. Jika NIP cocok dengan pegawai terkait di `pegawaiList`, arahkan ke `/laporan/${id}/edit?nip=${nip}`. Jika salah, tampilkan pesan SweetAlert2 error.
2. Buat `src/app/laporan/page.tsx`:
```typescript
import { getAllLaporan, getPegawai } from '@/lib/actions'
import { LaporanListClient } from '@/components/laporan-list-client'

export const dynamic = 'force-dynamic'

export default async function LaporanPage() {
  const [laporanList, pegawaiList] = await Promise.all([
    getAllLaporan(),
    getPegawai(),
  ])

  return (
    <div className="pt-16 lg:pt-0 w-full space-y-6">
      <LaporanListClient initialLaporan={laporanList} pegawaiList={pegawaiList} />
    </div>
  )
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/laporan-list.test.tsx`  
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/app/laporan/page.tsx src/components/laporan-list-client.tsx tests/laporan-list.test.tsx
git commit -m "feat(laporan): implementasikan halaman daftar laporan dan prompt verifikasi NIP"
```

---

### Task 5: Formulir Edit Laporan Penugasan (`/laporan/[id]/edit`)

**Files:**
- Create: `src/app/laporan/[id]/edit/page.tsx`
- Create: `src/components/edit-laporan-client.tsx`
- Test: `tests/edit-laporan.test.tsx`

**Interfaces:**
- Consumes: `getAllLaporan()`, `getPegawai()`, `updateLaporan()`
- Produces: Halaman formulir edit interaktif dengan pre-filled values, galeri foto lama yang dapat dihapus per item, dropzone penambahan file baru, STT, AI formatting, dan submit update.

- [x] **Step 1: Write the failing test for EditLaporanClient**

Buat `tests/edit-laporan.test.tsx`:
```typescript
import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { EditLaporanClient } from '../src/components/edit-laporan-client'

describe('EditLaporanClient', () => {
  const mockLaporan = {
    id: '5',
    pegawai_id: 'Budi Santoso, S.Kom',
    bidang: 'Sekretariat',
    jenis_penugasan: 'Rapat Koordinasi',
    tanggal_kegiatan: '2026-09-22',
    nama_kegiatan: 'Rapat Koordinasi Evaluasi',
    tempat_kegiatan: 'Hotel Solo Paragon',
    penyelenggara: 'Disnaker Surakarta',
    tamu_undangan: 'Perwakilan OPD',
    catatan_hasil: 'Hasil rapat koordinasi awal',
    status_tindak_lanjut: 'Untuk Diketahui',
    catatan_pimpinan: null,
    dokumentasi_urls: ['https://drive.google.com/photo1.jpg'],
    materi_urls: [],
  }

  it('renders pre-filled data and submit update button', () => {
    const html = renderToString(
      <EditLaporanClient laporan={mockLaporan as any} pegawaiList={[]} />
    )
    expect(html).toContain('Edit Formulir Laporan Penugasan')
    expect(html).toContain('Rapat Koordinasi Evaluasi')
    expect(html).toContain('Simpan Perubahan Laporan')
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/edit-laporan.test.tsx`  
Expected: FAIL with `EditLaporanClient is not defined`.

- [x] **Step 3: Implement EditLaporanClient and edit page.tsx**

1. Buat `src/components/edit-laporan-client.tsx`:
- Mengadopsi arsitektur workbench yang telah distandardisasi di `InputFormClient` (standar anti-slop, tipografi `text-sm`, tinggi input `h-10`, textarea `min-h-[130px]`, tombol `h-10` / `py-3`).
- Menerima prop `initialNip?: string` (dari verifikasi awal) atau sediakan input NIP pelapor jika diakses langsung.
- Inisialisasi form state dari props `laporan`.
- State `existingDocs: string[]` dan `existingMateri: string[]` yang menampilkan link/preview file yang sudah ada di Google Drive dengan tombol Hapus (`Trash2`) per item.
- Dropzone untuk menambahkan file baru (`docFiles: File[]`, `matFiles: File[]`).
- Fitur Dikte Suara dan AI Enhance tetap tersemat di textarea catatan.
- Handler submit memanggil Server Action `updateLaporan` dengan menyertakan `nip: verifiedNip`.
2. Buat `src/app/laporan/[id]/edit/page.tsx`:
- Mengambil data laporan berdasarkan `params.id` dari `getAllLaporan()`.
- Jika laporan tidak ditemukan, return `notFound()`.
- Jika laporan sudah dievaluasi (`catatan_pimpinan`), tampilkan kartu peringatan bahwa laporan telah terkunci dan redirect / tombol kembali ke `/laporan`.
- Render `<EditLaporanClient laporan={laporan} pegawaiList={pegawaiList} />`.

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/edit-laporan.test.tsx`  
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/app/laporan/[id]/edit/page.tsx src/components/edit-laporan-client.tsx tests/edit-laporan.test.tsx
git commit -m "feat(laporan): implementasikan halaman formulir edit laporan penugasan"
```

---

### Task 6: Verifikasi Kualitas Total (5 Evidence Gates & Local CI)

**Files:**
- Modify: `CHANGELOG.md`
- Run: Suite perintah Gate 1 sampai Gate 5

- [x] **Step 1: Run typecheck and lint (Gate 1)**

Run: `npm run typecheck && npm run lint`  
Expected: 0 errors, 0 warnings.

- [x] **Step 2: Run automated vitest suite (Gate 2)**

Run: `npm test`  
Expected: 100% test suites pass (termasuk `tests/design-tokens.test.ts`).

- [x] **Step 3: Run detector anti-pattern scan**

Run: `.agent/skills/impeccable/scripts/impeccable detect --json src/app/laporan src/components/laporan-list-client.tsx src/components/edit-laporan-client.tsx`  
Expected: `[]` (0 findings).

- [x] **Step 4: Run production build (Gate 4)**

Run: `npm run build`  
Expected: Exit code 0, rute `/laporan` dan `/laporan/[id]/edit` terkompilasi sukses.

- [x] **Step 5: Update CHANGELOG.md and commit**

Perbarui `CHANGELOG.md` dengan entri versi `[2.1.0] - Fitur Edit Laporan Penugasan ASN`.
```bash
git add docs/DOKUMEN_REFERENSI_TEKNIS/CHANGELOG.md
git commit -m "docs: dokumentasikan rilis v2.1.0 fitur edit laporan penugasan"
```
