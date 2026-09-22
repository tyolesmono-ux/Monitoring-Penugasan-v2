'use server'

import { revalidatePath, revalidateTag, unstable_cache } from 'next/cache'
import { cookies } from 'next/headers'
import type {
  Pegawai,
  Laporan,
  DashboardStats,
  LaporanFormData,
  KegiatanInternal,
  KegiatanInternalFormData,
  UpdateLaporanFormData,
} from './types'
import {
  fetchPegawaiFromAppsScript,
  fetchLaporanFromAppsScript,
  submitLaporanToAppsScript,
  updateEvaluasiInAppsScript,
  updateLaporanInAppsScript,
  normalizePersonName,
  type AppsScriptFilePayload,
  type AppsScriptUpdatePayload,
} from './appscript'
import { getDriveDirectImageUrl } from './print-utils'
import {
  LaporanFormDataSchema,
  EvaluasiPimpinanSchema,
  LoginPimpinanSchema,
  UpdateLaporanSchema,
  type ValidatedUpdateLaporanData,
} from './validations'
import { formatUserFriendlyError, logSystemError, generateErrorCode } from './error-handler'

// ============================================================
// DATA FETCHING (GOOGLE APPS SCRIPT / SPREADSHEET WITH NEXT.JS CACHE)
// ============================================================

// Master data pegawai: TTL 30 menit (1800 detik)
const cachedGetPegawai = unstable_cache(
  async (): Promise<Pegawai[]> => fetchPegawaiFromAppsScript(),
  ['pegawai-list'],
  { tags: ['pegawai'], revalidate: 1800 }
)

export async function getPegawai(): Promise<Pegawai[]> {
  try {
    return await cachedGetPegawai()
  } catch (err: any) {
    if (err?.message?.includes('incrementalCache missing')) {
      return await fetchPegawaiFromAppsScript()
    }
    throw err
  }
}

// Rekap laporan: TTL 60 detik (1 menit)
const cachedGetLaporan = unstable_cache(
  async (namaPegawai?: string): Promise<Laporan[]> => fetchLaporanFromAppsScript(namaPegawai),
  ['laporan-list'],
  { tags: ['laporan'], revalidate: 60 }
)

export async function getLaporan(namaPegawai?: string): Promise<Laporan[]> {
  try {
    return await cachedGetLaporan(namaPegawai)
  } catch (err: any) {
    if (err?.message?.includes('incrementalCache missing')) {
      return await fetchLaporanFromAppsScript(namaPegawai)
    }
    throw err
  }
}

export async function getAllLaporan(): Promise<Laporan[]> {
  const [laporanList, pegawaiList] = await Promise.all([
    getLaporan(),
    getPegawai(),
  ])

  // Sinkronkan data laporan dengan master pegawai (enrichment)
  return laporanList.map((lap) => {
    const rawName = lap.pegawai_id || lap.pegawai?.nama || ''
    const norm = normalizePersonName(rawName)
    const matched = pegawaiList.find((p) => {
      if (p.id === rawName || p.nip === rawName) return true
      return normalizePersonName(p.nama) === norm
    })

    if (matched) {
      return {
        ...lap,
        bidang: lap.bidang || matched.bidang,
        jabatan: lap.jabatan || matched.jabatan,
        pegawai: matched,
      }
    }
    return lap
  })
}

export async function getDashboardStats(laporanData: Laporan[]): Promise<DashboardStats> {
  const totalLaporan = laporanData.length
  const uniqueNames = new Set(
    laporanData
      .map((l) => l.pegawai?.nama || l.pegawai_id)
      .filter(Boolean)
  )
  const totalDievaluasi = laporanData.filter(
    (l) => l.catatan_pimpinan && l.catatan_pimpinan.trim() !== ''
  ).length

  return {
    totalLaporan,
    uniquePegawai: uniqueNames.size,
    totalDievaluasi,
  }
}

export async function getLaporanByPegawaiId(pegawaiIdOrName: string): Promise<Laporan[]> {
  const [allLaporan, pegawaiList] = await Promise.all([
    getAllLaporan(),
    getPegawai(),
  ])

  const targetPegawai = pegawaiList.find(
    (p) =>
      p.id === pegawaiIdOrName ||
      p.nip === pegawaiIdOrName ||
      p.nama === pegawaiIdOrName ||
      normalizePersonName(p.nama) === normalizePersonName(pegawaiIdOrName)
  )

  const targetNorm = targetPegawai
    ? normalizePersonName(targetPegawai.nama)
    : normalizePersonName(pegawaiIdOrName)

  return allLaporan.filter((l) => {
    if (targetPegawai) {
      if (l.pegawai?.id === targetPegawai.id) return true
      if (l.pegawai?.nip && l.pegawai.nip === targetPegawai.nip) return true
    }
    if (l.pegawai_id === pegawaiIdOrName) return true
    const repName = l.pegawai?.nama || l.pegawai_id
    if (targetNorm && normalizePersonName(repName) === targetNorm) return true
    return false
  })
}

// ============================================================
// DATA MUTATION (SUBMIT LAPORAN & GOOGLE DRIVE UPLOAD)
// ============================================================

// Helper untuk membersihkan dan memformat payload file Base64
function sanitizeFilePayloads(
  files: (AppsScriptFilePayload | any)[],
  defaultName: string,
  defaultMime: string
): AppsScriptFilePayload[] {
  return files
    .filter((f) => f && typeof f === 'object' && f.base64)
    .map((f) => ({
      base64: f.base64,
      name: f.name || defaultName,
      mime: f.mime || defaultMime,
    }))
}

export async function submitLaporan(
  formData: LaporanFormData,
  dokFiles: AppsScriptFilePayload[] | any[] = [],
  materiFiles: AppsScriptFilePayload[] | any[] = []
) {
  try {
    // Validasi form data dengan Zod
    const validation = LaporanFormDataSchema.safeParse(formData)
    if (!validation.success) {
      return {
        status: 'error',
        message: validation.error.issues[0]?.message || 'Data formulir tidak valid.',
        errorCode: generateErrorCode(),
      }
    }

    // Pastikan payload file berformat AppsScriptFilePayload
    const dokumentasi = sanitizeFilePayloads(dokFiles, 'dokumentasi.jpg', 'image/jpeg')
    const materi = sanitizeFilePayloads(materiFiles, 'materi.pdf', 'application/pdf')

    // Validasi batas transmisi payload Base64 (Vercel Serverless limit 4.5 MB)
    const totalBase64Length =
      dokumentasi.reduce((acc, f) => acc + (f.base64?.length || 0), 0) +
      materi.reduce((acc, f) => acc + (f.base64?.length || 0), 0)

    if (totalBase64Length > 4.2 * 1024 * 1024) {
      return {
        status: 'error',
        message:
          'Total ukuran berkas lampiran melebihi batas aman transmisi server (4.5 MB). Silakan kompres foto atau berkas materi terlebih dahulu.',
        errorCode: generateErrorCode(),
      }
    }

    // Temukan nama pegawai dari id / nama
    let namaPegawai = formData.pegawai_id
    try {
      const pegawaiList = await getPegawai()
      const matched = pegawaiList.find(
        (p) =>
          p.id === formData.pegawai_id ||
          p.nip === formData.pegawai_id ||
          p.nama.toLowerCase().trim() === formData.pegawai_id.toLowerCase().trim()
      )
      if (matched && matched.nama) {
        namaPegawai = matched.nama
      }
    } catch {
      // fallback tetap menggunakan formData.pegawai_id
    }

    const res = await submitLaporanToAppsScript({
      namaPegawai,
      bidang: formData.bidang,
      jabatan: formData.jabatan,
      jenisPenugasan: formData.jenis_penugasan,
      tanggalKegiatan: formData.tanggal_kegiatan,
      namaKegiatan: formData.nama_kegiatan,
      tempatKegiatan: formData.tempat_kegiatan,
      penyelenggara: formData.penyelenggara,
      tamuUndangan: formData.tamu_undangan,
      catatanHasil: formData.catatan_hasil,
      dokumentasi,
      materi,
    })

    if (res?.status === 'success') {
      try {
        revalidateTag('laporan')
      } catch {
        // safe fallback if called outside Next.js request lifecycle
      }
      revalidatePath('/dashboard')
      revalidatePath('/cetak')
      revalidatePath('/pimpinan')
    } else if (res?.status === 'error') {
      const friendly = formatUserFriendlyError(res.message, 'Gagal menyimpan data ke Spreadsheet.')
      logSystemError(friendly.errorCode, res.message, 'actions.submitLaporan')
      return {
        status: 'error',
        message: friendly.userMessage,
        errorCode: friendly.errorCode,
      }
    }

    return res
  } catch (error: any) {
    const friendly = formatUserFriendlyError(error, 'Gagal menyimpan data ke sistem.')
    logSystemError(friendly.errorCode, error, 'actions.submitLaporan')
    return {
      status: 'error',
      message: friendly.userMessage,
      errorCode: friendly.errorCode,
    }
  }
}

export async function updateEvaluasiPimpinan(
  laporanId: string,
  status: string,
  catatanBaru: string,
  roleName: string
) {
  try {
    const row = parseInt(laporanId, 10)
    const validation = EvaluasiPimpinanSchema.safeParse({
      rowIndex: row,
      status_tindak_lanjut: status,
      catatan_pimpinan: catatanBaru,
    })
    if (!validation.success) {
      return {
        status: 'error',
        message: validation.error.issues[0]?.message || 'Input evaluasi tidak valid.',
        errorCode: generateErrorCode(),
      }
    }

    // Ambil laporan saat ini untuk menyambung catatan pimpinan yang sudah ada
    const all = await fetchLaporanFromAppsScript()
    const current = all.find((l) => l.id === laporanId)
    const existingNotes = current?.catatan_pimpinan
      ? current.catatan_pimpinan.trim() + '\n\n'
      : ''
    const appendedNote = existingNotes + `[${roleName}]: ${catatanBaru.trim()}`

    const res = await updateEvaluasiInAppsScript(row, status, appendedNote)

    if (res.status === 'success') {
      try {
        revalidateTag('laporan')
      } catch {
        // safe fallback if called outside Next.js request lifecycle
      }
      revalidatePath('/dashboard')
      revalidatePath('/pimpinan')
      revalidatePath('/cetak')
    } else if (res.status === 'error') {
      const friendly = formatUserFriendlyError(res.message, 'Gagal memperbarui evaluasi di Spreadsheet.')
      logSystemError(friendly.errorCode, res.message, 'actions.updateEvaluasiPimpinan')
      return {
        status: 'error',
        message: friendly.userMessage,
        errorCode: friendly.errorCode,
      }
    }

    return res
  } catch (error: any) {
    const friendly = formatUserFriendlyError(error, 'Gagal memperbarui evaluasi di sistem.')
    logSystemError(friendly.errorCode, error, 'actions.updateEvaluasiPimpinan')
    return {
      status: 'error',
      message: friendly.userMessage,
      errorCode: friendly.errorCode,
    }
  }
}

/**
 * Server action untuk membersihkan cache on-demand dan memaksa sinkronisasi data dari Google Spreadsheet
 */
export async function refreshData(target: 'laporan' | 'pegawai' | 'all' = 'all'): Promise<{ status: string; message: string }> {
  try {
    if (target === 'laporan' || target === 'all') {
      revalidateTag('laporan')
    }
    if (target === 'pegawai' || target === 'all') {
      revalidateTag('pegawai')
    }
    revalidatePath('/dashboard')
    revalidatePath('/cetak')
    revalidatePath('/pimpinan')
  } catch {
    // fallback if outside Next context
  }

  return { status: 'success', message: 'Data berhasil disinkronkan dari server.' }
}

// ============================================================
// STUBS FILE UPLOAD (LEGACY SUPABASE REPLACEMENT)
// ============================================================

// ============================================================
// STUBS KEGIATAN INTERNAL (NON-ACTIVE)
// ============================================================

export async function submitKegiatanInternal(..._args: any[]): Promise<{ status: string; message?: string }> { return { status: 'success' } }
export async function getAllKegiatanInternal(): Promise<KegiatanInternal[]> { return [] }
export async function getKegiatanInternalById(_id: string): Promise<KegiatanInternal | null> { return null }
export async function updateEvaluasiKegiatanInternal(..._args: any[]) { return { status: 'success' } }

// ============================================================
// PIMPINAN AUTHENTICATION (SERVER SIDE + COOKIES)
// ============================================================

const PIMPINAN_ROLES_CONFIG = [
  { name: 'Kepala Dinas', pin: process.env.PIN_KEPALA_DINAS, scopes: ['ALL'] },
  { name: 'Sekretaris', pin: process.env.PIN_SEKRETARIS, scopes: ['ALL'] },
  { name: 'Kasubag Perkeu', pin: process.env.PIN_KASUBAG_PERKEU, scopes: ['SEKRETARIAT'] },
  { name: 'Kasubag Ako', pin: process.env.PIN_KASUBAG_AKO, scopes: ['SEKRETARIAT'] },
  { name: 'Kabid PPTK', pin: process.env.PIN_KABID_PPTK, scopes: ['BIDANG PPTK'] },
  { name: 'Kabid Hubungan Industrial', pin: process.env.PIN_KABID_HI, scopes: ['BIDANG HUBUNGAN INDUSTRIAL'] },
]

export async function loginPimpinan(roleName: string, pin: string) {
  // Validasi format PIN menggunakan Zod
  const pinValidation = LoginPimpinanSchema.safeParse({ pin })
  if (!pinValidation.success) {
    return {
      success: false,
      message: pinValidation.error.issues[0]?.message || 'Format PIN tidak valid (harus 4-6 digit angka).',
    }
  }

  const role = PIMPINAN_ROLES_CONFIG.find(
    (r) => r.name.trim().toLowerCase() === roleName.trim().toLowerCase()
  )

  if (!role || !role.pin) {
    console.error(`[AUTH] PIN untuk role "${roleName}" tidak ditemukan di environment variables.`)
    return { success: false, message: 'Konfigurasi server belum lengkap. Hubungi administrator.' }
  }

  if (pin !== role.pin) {
    return { success: false, message: 'PIN Salah atau Jabatan tidak ditemukan.' }
  }

  const cookieStore = await cookies()
  cookieStore.set(
    'pimpinan_session',
    JSON.stringify({
      role: role.name,
      scopes: role.scopes,
      loggedInAt: Date.now(),
    }),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 8, // 8 jam
    }
  )

  return { success: true }
}

export async function logoutPimpinan() {
  const cookieStore = await cookies()
  cookieStore.delete('pimpinan_session')
  return { success: true }
}

export async function getPimpinanSession(): Promise<{
  role: string
  scopes: string[]
} | null> {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('pimpinan_session')

  if (!sessionCookie) return null

  try {
    const session = JSON.parse(sessionCookie.value)
    return {
      role: session.role,
      scopes: session.scopes,
    }
  } catch {
    return null
  }
}

/**
 * Server Action untuk mengunduh gambar Google Drive di level Node.js server
 * dan mengonversinya ke format Base64 Data URL, kebal terhadap blokir CORS/iframe browser
 */
export async function getDirectImageBase64(url: string): Promise<string | null> {
  if (!url) return null
  if (url.startsWith('data:image/')) return url
  const fetchUrl = getDriveDirectImageUrl(url, 800)
  if (!fetchUrl) return null

  try {
    const res = await fetch(fetchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
      signal: AbortSignal.timeout(4000),
      next: { revalidate: 86400 },
    })
    if (!res.ok) return null
    const arrayBuffer = await res.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')
    const contentType = res.headers.get('content-type') || 'image/jpeg'
    return `data:${contentType};base64,${base64}`
  } catch (err) {
    console.error('[getDirectImageBase64] Error fetching image:', err)
    return null
  }
}

export async function updateLaporan(
  formData: UpdateLaporanFormData,
  dokFiles: AppsScriptFilePayload[] | any[] = [],
  materiFiles: AppsScriptFilePayload[] | any[] = []
) {
  try {
    // Validasi data menggunakan UpdateLaporanSchema
    const validation = UpdateLaporanSchema.safeParse(formData)
    if (!validation.success) {
      return {
        status: 'error',
        message: validation.error.issues[0]?.message || 'Data formulir tidak valid.',
        errorCode: generateErrorCode(),
      }
    }

    const validatedData: ValidatedUpdateLaporanData = validation.data

    // Validasi batas transmisi payload Base64 (Vercel Serverless limit 4.5 MB)
    const totalBase64Length = [...dokFiles, ...materiFiles].reduce(
      (acc, f) => acc + (f.base64?.length || 0),
      0
    )

    if (totalBase64Length > 4.2 * 1024 * 1024) {
      return {
        status: 'error',
        message:
          'Total ukuran berkas lampiran melebihi batas aman transmisi server (4.5 MB). Silakan kompres foto atau berkas materi terlebih dahulu.',
        errorCode: generateErrorCode(),
      }
    }

    // Cari laporan yang akan diupdate
    const allLaporan = await getAllLaporan()
    const targetLaporan = allLaporan.find((l) => l.id === formData.rowIndex.toString())
    if (!targetLaporan) {
      return {
        status: 'error',
        message: 'Laporan tidak ditemukan.',
        errorCode: generateErrorCode(),
      }
    }

    // Verifikasi status lock: jika catatan_pimpinan terisi atau status bukan 'Untuk Diketahui', tolak
    const isEvaluated =
      Boolean(targetLaporan.catatan_pimpinan && targetLaporan.catatan_pimpinan.trim() !== '') ||
      (Boolean(targetLaporan.status_tindak_lanjut) && targetLaporan.status_tindak_lanjut !== 'Untuk Diketahui')

    if (isEvaluated) {
      return {
        status: 'error',
        message: 'Laporan telah dievaluasi oleh Pimpinan dan tidak dapat diedit.',
        errorCode: generateErrorCode(),
      }
    }

    // Verifikasi NIP pegawai pelapor cocok dengan master data pegawai
    const allPegawai = await getPegawai()
    const targetPegawai = allPegawai.find(
      (p) =>
        normalizePersonName(p.nama) === normalizePersonName(targetLaporan.pegawai_id) ||
        p.id === targetLaporan.pegawai_id
    )

    if (!targetPegawai) {
      return {
        status: 'error',
        message: 'Data pegawai pelapor tidak terdaftar di sistem.',
        errorCode: generateErrorCode(),
      }
    }

    if (targetPegawai.nip) {
      const cleanInputNip = validatedData.nip.replace(/\s+/g, '')
      const cleanTargetNip = targetPegawai.nip.replace(/\s+/g, '')
      if (cleanInputNip !== cleanTargetNip) {
        return {
          status: 'error',
          message: 'NIP yang dimasukkan tidak cocok dengan data pegawai pelapor.',
          errorCode: generateErrorCode(),
        }
      }
    }

    // Pastikan payload file berformat AppsScriptFilePayload
    const dokumentasi = sanitizeFilePayloads(dokFiles, 'dokumentasi.jpg', 'image/jpeg')
    const materi = sanitizeFilePayloads(materiFiles, 'materi.pdf', 'application/pdf')

    // Siapkan payload untuk Apps Script
    const payload: AppsScriptUpdatePayload = {
      action: 'updateLaporan',
      rowIndex: validatedData.rowIndex,
      namaPegawai: validatedData.pegawai_id,
      bidang: validatedData.bidang,
      jabatan: validatedData.jabatan,
      jenisPenugasan: validatedData.jenis_penugasan,
      tanggalKegiatan: validatedData.tanggal_kegiatan,
      namaKegiatan: validatedData.nama_kegiatan,
      tempatKegiatan: validatedData.tempat_kegiatan,
      penyelenggara: validatedData.penyelenggara,
      tamuUndangan: validatedData.tamu_undangan,
      catatanHasil: validatedData.catatan_hasil,
      dokumentasi,
      materi,
      existingDokUrls: validatedData.existing_dok_urls || [],
      existingMateriUrls: validatedData.existing_materi_urls || [],
    }

    const res = await updateLaporanInAppsScript(payload)

    if (res?.status === 'success') {
      try {
        revalidateTag('laporan')
      } catch {
        // safe fallback if called outside Next.js request lifecycle
      }
      revalidatePath('/laporan')
      revalidatePath('/dashboard')
      revalidatePath('/cetak')
      revalidatePath('/pimpinan')
    } else if (res?.status === 'error') {
      const friendly = formatUserFriendlyError(res.message, 'Gagal memperbarui laporan di Spreadsheet.')
      logSystemError(friendly.errorCode, res.message, 'actions.updateLaporan')
      return {
        status: 'error',
        message: friendly.userMessage,
        errorCode: friendly.errorCode,
      }
    }

    return res
  } catch (error: any) {
    const friendly = formatUserFriendlyError(error, 'Gagal memperbarui laporan.')
    logSystemError(friendly.errorCode, error, 'actions.updateLaporan')
    return {
      status: 'error',
      message: friendly.userMessage,
      errorCode: friendly.errorCode,
    }
  }
}