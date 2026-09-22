# AGENTS.md — Panduan AI Agent untuk SIMPELGAS
> Dibaca oleh: semua AI coding agent (Claude, Gemini, GPT, Cursor, Copilot, dll.)
> Terakhir diperbarui: 2026-09-02

---

## 1. Tentang Proyek Ini

**SIMPELGAS** (v2.0.0) adalah aplikasi web pelaporan penugasan ASN untuk Dinas Tenaga Kerja Kota Surakarta. Stack utama:

| Layer | Teknologi |
|---|---|
| Frontend | Next.js 14 App Router, React 18, TypeScript 5, Tailwind CSS 3 |
| Backend (Serverless) | Google Apps Script (V8) — file `code.gs` di root |
| Database | Google Spreadsheet (`DATA_PEGAWAI`, `REKAP_LAPORAN`) |
| File Storage | Google Drive (foto dokumentasi + materi paparan) |
| AI Feature | Google Gemini 2.5 Flash (text enhancement via `/api/enhance`) |
| Auth | Cookie HTTP-Only session + PIN berbasis peran (env vars) |

**Tidak ada database konvensional (PostgreSQL/MySQL/Supabase).** Semua data via Google Apps Script Web App.

---

## 2. Dokumen Wajib Dibaca Sebelum Mulai

Mulai dari [`ONBOARDING.md`](docs/DOKUMEN_REFERENSI_TEKNIS/ONBOARDING.md) — dokumen itu adalah **entry point** yang merangkum semua hal penting dan mengarahkan ke dokumen yang tepat.

Gunakan tabel berikut sebagai panduan **kapan membaca dokumen mana**:

| Dokumen | Kapan Dibaca Agent |
|---|---|
| [`ONBOARDING.md`](docs/DOKUMEN_REFERENSI_TEKNIS/ONBOARDING.md) | **Selalu** — sesi pertama atau setelah lama tidak menyentuh repo ini. Berisi orientasi cepat, peta kode, alur kerja, dan FAQ arsitektur. |
| [`PRD-SIMPELGAS.md`](docs/DOKUMEN_REFERENSI_TEKNIS/PRD-SIMPELGAS.md) | Ketika ingin memahami **fitur bisnis**, persona pengguna, atau kontrak API Apps Script (`doGet`/`doPost`). |
| [`ARCHITECTURE.md`](docs/DOKUMEN_REFERENSI_TEKNIS/ARCHITECTURE.md) | Ketika mengerjakan integrasi Apps Script, alur cetak, session middleware, atau diagram data flow. |
| [`CODING_STANDARD.md`](docs/DOKUMEN_REFERENSI_TEKNIS/CODING_STANDARD.md) | Sebelum **menulis kode baru** — konvensi TypeScript, naming, Server Actions, token warna. |
| [`UIUX_DESIGN.md`](docs/DOKUMEN_REFERENSI_TEKNIS/UIUX_DESIGN.md) | Sebelum **menyentuh komponen UI** — palet Civic Spectrum, tipografi, spesifikasi komponen. |
| [`DEFINITION_OF_DONE.md`](docs/DOKUMEN_REFERENSI_TEKNIS/DEFINITION_OF_DONE.md) | Sebelum **mengklaim task selesai** — 5 Evidence Gates yang wajib dipenuhi. |
| [`TECH_STACK.md`](docs/DOKUMEN_REFERENSI_TEKNIS/TECH_STACK.md) | Ketika butuh **versi library**, ADR (kenapa pilih teknologi X), atau daftar env vars. |
| [`DEPLOYMENT.md`](docs/DOKUMEN_REFERENSI_TEKNIS/DEPLOYMENT.md) | Ketika mengerjakan **setup produksi**, Vercel, atau Apps Script deployment. |
| [`CHANGELOG.md`](docs/DOKUMEN_REFERENSI_TEKNIS/CHANGELOG.md) | Ketika butuh **konteks riwayat** perubahan arsitektur atau saat akan menambah entri rilis baru. |

---

## 3. Peta File Kritis

```
SIMPELGAS/
├── code.gs                    ⚠️  Backend serverless. JANGAN ubah tanpa memahami kontrak API.
├── .env                       🔒  JANGAN pernah commit. JANGAN expose ke client.
├── .env.example               ✅  Template aman — salin ini untuk setup lokal.
├── next.config.js             ⚙️  Body size limit 10MB untuk Server Actions.
├── src/
│   ├── middleware.ts           🛡️  Guard rute /pimpinan/*. Jangan hapus/disable.
│   ├── lib/
│   │   ├── actions.ts         🔑  SEMUA Server Actions ('use server'). Inti mutasi data.
│   │   ├── appscript.ts       🔌  HTTP adapter ke Google Apps Script. Jangan ubah CORS headers.
│   │   ├── types.ts           📝  Interface TypeScript domain. Definisikan tipe baru di sini.
│   │   ├── validations.ts     ✅  Skema validasi Zod untuk input.
│   │   ├── print-utils.ts     🖨️  Formatter cetak + proxy Base64 gambar Drive.
│   │   └── utils.ts           🔧  Helper cn() untuk Tailwind class merging.
│   ├── components/            🎨  Client Components UI (semua berakhiran -client.tsx).
│   └── app/
│       ├── api/enhance/       🤖  Proxy Gemini AI. JANGAN expose GEMINI_API_KEY ke client.
│       ├── dashboard/         📊  Analytics & statistik penugasan.
│       ├── input/             📝  Form pelaporan ASN + kompresi foto.
│       ├── cetak/             🖨️  Lembar cetak kedinasan A4.
│       └── pimpinan/          👔  Portal evaluasi pimpinan (protected).
├── tests/                     🧪  Unit tests Vitest. Wajib 100% pass sebelum commit.
└── docs/DOKUMEN_REFERENSI_TEKNIS/  📚  Semua dokumentasi teknis proyek.
```

---

## 4. Perintah NPM yang Tersedia

```bash
npm run dev          # Dev server di http://localhost:3000
npm run build        # Build produksi Next.js
npm run start        # Jalankan build produksi
npm run lint         # ESLint — harus 0 error/warning
npm run typecheck    # TypeScript check (tsc --noEmit) — harus 0 error
npm test             # Vitest — harus 100% test suites pass
npm run ci:local     # lint + typecheck + test + build sekaligus (gunakan ini sebelum push)
```

---

## 5. Konvensi Kode Wajib

### TypeScript
- **Strict mode aktif.** Hindari `any` tanpa komentar justifikasi.
- Definisikan semua tipe domain di `src/lib/types.ts`.
- Gunakan `interface` untuk objek, `type` untuk union/payload.

### Next.js App Router
- `page.tsx` dan `layout.tsx` = **Server Components** secara default.
- File komponen interaktif wajib berakhiran **`-client.tsx`** dan dimulai dengan `'use client'`.
- Gunakan `export const dynamic = 'force-dynamic'` di semua page yang baca data dari Apps Script.
- Setelah mutasi berhasil, panggil `revalidatePath()` untuk semua rute terdampak.

### Google Apps Script Integration
- Semua request ke Apps Script wajib `redirect: 'follow'`.
- POST ke Apps Script wajib `Content-Type: text/plain;charset=utf-8` (bukan `application/json`) — ini untuk menghindari CORS preflight error.
- Tanggal dari Sheets = format `DD/MM/YYYY`. Selalu konversi ke `YYYY-MM-DD` dengan `parseSheetDate()`.

### Warna & Styling (Palet Civic Spectrum — SSoT: `src/lib/design-tokens.ts` & `globals.css`)
- Primary CTA: `bg-primary text-primary-foreground` (atau `bg-sky-400 text-sky-900`)
- Secondary: `bg-secondary text-secondary-foreground` (atau `bg-pink-400 text-pink-950`)
- AI / Accent: `bg-accent text-accent-foreground` (atau `bg-violet-50 text-violet-700`)
- Dark (sidebar/portal): `bg-slate-900 text-white`
- Teks utama: `text-slate-900` (heading), `text-slate-700` (body), `text-slate-500` (caption)
- Status sukses: `bg-emerald-50 text-emerald-700 border-emerald-200`
- Status warning: `bg-amber-50 text-amber-700 border-amber-200`
- Status destructive: `text-destructive bg-destructive/soft`
- Token lama `navy-*` dan `amber-*` **telah dihapus** — DILARANG digunakan lagi.

### 5 Aturan Keras UI & Desain Token (Diverifikasi Otomatis oleh `tests/design-tokens.test.ts`)
1. **Dilarang keras memakai emoticon / emoji Unicode di UI** (tombol, toast, modal, teks). Wajib gunakan ikon dari `lucide-react`.
2. **Dilarang keras memakai hardcoded hex color di className/JSX** (seperti `#[0-9a-fA-F]`, `bg-[#1B3C73]`, `text-[#082F49]`). Wajib gunakan token semantik CSS variables atau konstanta `DESIGN_TOKENS`.
3. **Dilarang menggunakan token usang** (`navy-main`, `navy-dark`, `navy-light`, `amber-main`, `amber-hover`).
4. **Wajib 100% ikonografi menggunakan `lucide-react`** (dilarang paket ikon lain atau inline raw SVG di komponen).
5. **Dilarang dialog popup bawaan browser** (`alert()`, `confirm()`, `prompt()`). Seluruh notifikasi transaksi sukses/gagal wajib menggunakan **SweetAlert2** (`Swal.fire`) atau Toast interaktif.

---

## 6. Alur Kerja TDD + Definition of Done (WAJIB)

Setiap perubahan kode wajib melewati **5 Evidence Gates** sebelum dianggap selesai:

| Gate | Perintah | Kriteria |
|---|---|---|
| **Gate 1** Static Quality | `npm run lint && npm run typecheck` | 0 error/warning |
| **Gate 2** Testing | `npm test` | 100% test suites pass (termasuk `tests/design-tokens.test.ts`) |
| **Gate 3** Local CI | `npm run ci:local` | Exit code 0 |
| **Gate 4** Build | `npm run build` | Bundle sukses |
| **Gate 5** Domain | Manual check | Kontrak Apps Script, format cetak sah & 5 aturan token terpenuhi |

**Alur TDD:**
1. Tulis unit test di `tests/*.test.ts` **sebelum** implementasi.
2. Implementasi hingga test pass.
3. Jalankan `npm run ci:local`.
4. Commit dengan format Conventional Commits.

**Format Commit:**
```
feat(modul): deskripsi singkat
fix(appscript): perbaiki parsing tanggal
refactor(dashboard): pisahkan filter logic ke hook
test(actions): tambah test untuk submitLaporan error handling
docs: perbarui CODING_STANDARD palet warna
```

---

## 7. Peringatan Kritis (Jangan Lakukan Ini)

> **🔴 JANGAN** melakukan hal-hal berikut tanpa persetujuan eksplisit:

1. **Jangan baca atau print isi file kredensial** — file `.env`, `.env.local`, `.env.production`, atau file sejenisnya **DILARANG KERAS dibaca, di-cat, di-print output-nya, atau disertakan dalam log/response apapun**. Jika perlu tahu nama variabel yang dibutuhkan, baca `.env.example` — file itu aman karena tidak berisi nilai rahasia.
2. **Jangan gunakan emoji, hardcoded hex, atau dialog popup bawaan browser (`alert`/`confirm`)** — ikuti 5 aturan keras token UI di §5.
3. **Jangan commit `.env`** — berisi PIN pimpinan dan API key produksi.
4. **Jangan ubah struktur kolom Spreadsheet** (`DATA_PEGAWAI`, `REKAP_LAPORAN`) tanpa memperbarui `code.gs` dan mapper di `appscript.ts` secara bersamaan.
5. **Jangan ubah `Content-Type` POST ke Apps Script** dari `text/plain` ke `application/json` — akan menyebabkan CORS error di produksi.
6. **Jangan hapus `redirect: 'follow'`** di fetch call ke Apps Script — Apps Script selalu return HTTP 302 redirect.
7. **Jangan install library Supabase** — proyek ini telah migrasi penuh ke Apps Script. Supabase sudah dihapus.
8. **Jangan tambah prefix `NEXT_PUBLIC_`** ke variabel `APPSCRIPT_URL`, `GEMINI_API_KEY`, atau `PIN_*` — akan mengekspos kredensial ke browser.
9. **Jangan ubah `src/middleware.ts`** tanpa memahami konsekuensi terhadap keamanan rute `/pimpinan/*`.

---

## 8. Arsitektur Cepat (Quick Reference)

```
Browser (React Client Component)
  ↓ form submit / fetch
Next.js Server Action (actions.ts)  ←  cookie session check via middleware.ts
  ↓ HTTPS POST text/plain + redirect:follow
Google Apps Script Web App (code.gs)
  ↓ read/write
Google Spreadsheet + Google Drive
```

**Untuk fitur AI text enhancement:**
```
Browser → GET /api/enhance → Next.js Route Handler → Gemini API
                              (GEMINI_API_KEY aman di server)
```

---

## 9. Jika Butuh Referensi Lebih Dalam

- Arsitektur detail: [`docs/DOKUMEN_REFERENSI_TEKNIS/ARCHITECTURE.md`](docs/DOKUMEN_REFERENSI_TEKNIS/ARCHITECTURE.md)
- Kontrak API Apps Script (endpoint, payload JSON): [`docs/DOKUMEN_REFERENSI_TEKNIS/PRD-SIMPELGAS.md#52-kontrak-api`](docs/DOKUMEN_REFERENSI_TEKNIS/PRD-SIMPELGAS.md)
- Setup environment & deploy: [`docs/DOKUMEN_REFERENSI_TEKNIS/DEPLOYMENT.md`](docs/DOKUMEN_REFERENSI_TEKNIS/DEPLOYMENT.md)
- Riwayat perubahan: [`docs/DOKUMEN_REFERENSI_TEKNIS/CHANGELOG.md`](docs/DOKUMEN_REFERENSI_TEKNIS/CHANGELOG.md)

<!-- antislop:start -->
## antislop
For UI, copy, people, mobile layout, or code comments work, load the antislop skill for the task:
- Core filter, always on: `antislop`
- UI / visual: `antislop-ui`
- Copy & text: `antislop-copywriting`
- People: `antislop-human`
- Mobile / responsive: `antislop-layoutmobile`
- Code comments: `antislop-code`
Before starting, ask the user when antislop applies: during the work, or after it is done.
<!-- antislop:end -->
