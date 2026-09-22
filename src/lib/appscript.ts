import type { Pegawai, Laporan } from './types'

export interface AppsScriptFilePayload {
  base64: string
  name: string
  mime: string
}

export interface AppsScriptSubmitPayload {
  namaPegawai: string
  bidang: string
  jabatan?: string | null
  jenisPenugasan: string
  tanggalKegiatan: string // YYYY-MM-DD
  namaKegiatan: string
  tempatKegiatan: string
  penyelenggara: string
  tamuUndangan?: string | null
  catatanHasil?: string | null
  dokumentasi?: AppsScriptFilePayload[]
  materi?: AppsScriptFilePayload[]
}

export interface AppsScriptUpdatePayload extends AppsScriptSubmitPayload {
  action: 'updateLaporan'
  rowIndex: number
  existingDokUrls?: string[]
  existingMateriUrls?: string[]
}

/**
 * Konversi format tanggal dari spreadsheet (DD/MM/YYYY) ke standar input/HTML (YYYY-MM-DD)
 */
export function parseSheetDate(dateStr?: string): string {
  if (!dateStr || typeof dateStr !== 'string') return ''
  const trimmed = dateStr.trim()
  const parts = trimmed.split('/')
  if (parts.length === 3) return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
  return /^\d{4}-\d{2}-\d{2}/.test(trimmed) ? trimmed.substring(0, 10) : trimmed
}

/**
 * Normalisasi nama pegawai untuk pencocokan toleran (case-insensitive, abaikan gelar dan tanda baca)
 */
export function normalizePersonName(name?: string | null): string {
  if (!name || typeof name !== 'string') return ''
  return name.split(',')[0].toLowerCase().replace(/[^a-z0-9]/g, '').trim()
}

/**
 * Mapping data mentah baris DATA_PEGAWAI ke interface Pegawai
 */
export function mapPegawaiData(item: Record<string, any>, index: number): Pegawai {
  const nip = item['NIP'] || item['nip'] || null
  const nama = item['Nama Pegawai'] || item['nama_pegawai'] || item['Nama'] || item['nama'] || ''
  const bidang = item['Bidang / Unit Kerja'] || item['bidang'] || item['Bidang'] || ''
  const jabatan = item['Jabatan'] || item['jabatan'] || 'Staff'

  return {
    id: nip ? String(nip) : (nama ? String(nama) : String(index)),
    nama: String(nama).trim(),
    nip: nip ? String(nip).trim() : null,
    bidang: String(bidang).trim(),
    jabatan: String(jabatan).trim(),
    is_active: true,
    created_at: '',
  }
}

/**
 * Mapping data mentah baris REKAP_LAPORAN ke interface Laporan
 */
export function mapLaporanData(item: Record<string, any>): Laporan {
  const rowIndex = item['Row_Index'] !== undefined ? String(item['Row_Index']) : ''
  const namaPegawai = String(item['Nama Pegawai'] || item['namaPegawai'] || '').trim()
  const bidang = String(item['Bidang'] || item['bidang'] || '').trim()
  const jabatan = item['Jabatan'] ? String(item['Jabatan']).trim() : null
  const jenisPenugasan = String(item['Jenis Penugasan'] || item['jenisPenugasan'] || '').trim()
  const rawDate = item['Tanggal Kegiatan'] || item['tanggalKegiatan'] || ''
  const tanggalKegiatan = parseSheetDate(String(rawDate))
  const namaKegiatan = String(item['Nama Kegiatan'] || item['namaKegiatan'] || '').trim()
  const tempatKegiatan = String(item['Tempat Kegiatan'] || item['tempatKegiatan'] || '').trim()
  const penyelenggara = String(item['Penyelenggara Kegiatan'] || item['penyelenggara'] || '').trim()
  const tamuUndangan = item['Tamu Undangan yang Hadir'] || item['tamuUndangan'] || null
  const catatanHasil = item['Catatan Hasil Kegiatan'] || item['catatanHasil'] || null

  const rawDok = item['Dokumentasi Kegiatan'] || item['dokumentasi'] || ''
  const dokumentasiUrls = typeof rawDok === 'string' && rawDok.trim()
    ? rawDok.split('\n').map((u: string) => u.trim()).filter(Boolean)
    : []

  const rawMateri = item['Materi (Jika Ada)'] || item['materi'] || ''
  const materiUrls = typeof rawMateri === 'string' && rawMateri.trim()
    ? rawMateri.split('\n').map((u: string) => u.trim()).filter(Boolean)
    : []

  const statusTindakLanjut = String(item['Status Tindak Lanjut'] || 'Untuk Diketahui').trim()
  const catatanPimpinan = item['Catatan Pimpinan'] ? String(item['Catatan Pimpinan']).trim() : null

  return {
    id: rowIndex,
    pegawai_id: namaPegawai,
    bidang,
    jabatan,
    jenis_penugasan: jenisPenugasan,
    tanggal_kegiatan: tanggalKegiatan,
    nama_kegiatan: namaKegiatan,
    tempat_kegiatan: tempatKegiatan,
    penyelenggara,
    tamu_undangan: tamuUndangan ? String(tamuUndangan).trim() : null,
    catatan_hasil: catatanHasil ? String(catatanHasil).trim() : null,
    dokumentasi_urls: dokumentasiUrls,
    materi_urls: materiUrls,
    status_tindak_lanjut: statusTindakLanjut,
    catatan_pimpinan: catatanPimpinan,
    created_at: tanggalKegiatan ? `${tanggalKegiatan}T00:00:00.000Z` : new Date().toISOString(),
    updated_at: new Date().toISOString(),
    pegawai: {
      id: namaPegawai,
      nama: namaPegawai,
      nip: null,
      bidang,
      jabatan: jabatan || 'Staff',
      is_active: true,
      created_at: '',
    },
  }
}

/**
 * Fetch daftar pegawai dari Google Apps Script Web App
 */
export async function fetchPegawaiFromAppsScript(): Promise<Pegawai[]> {
  const url = process.env.APPSCRIPT_URL
  if (!url) {
    console.warn('[APPSCRIPT] APPSCRIPT_URL belum disetel di environment variables.')
    return []
  }

  try {
    const res = await fetch(`${url}?action=getPegawai`, {
      method: 'GET',
      redirect: 'follow',
      cache: 'no-store',
    })

    if (!res.ok) {
      console.error(`[APPSCRIPT] getPegawai HTTP error: ${res.status}`)
      return []
    }

    const json = await res.json()
    if (json.status === 'success' && Array.isArray(json.data)) {
      return json.data.map(mapPegawaiData)
    }

    console.warn('[APPSCRIPT] Format respons getPegawai tidak sesuai:', json)
    return []
  } catch (error) {
    console.error('[APPSCRIPT] Error fetching pegawai:', error)
    return []
  }
}

/**
 * Update existing laporan di Google Spreadsheet melalui Google Apps Script Web App
 */
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

/**
 * Fetch rekap laporan dari Google Apps Script Web App
 */
export async function fetchLaporanFromAppsScript(namaPegawai?: string): Promise<Laporan[]> {
  const url = process.env.APPSCRIPT_URL
  if (!url) {
    console.warn('[APPSCRIPT] APPSCRIPT_URL belum disetel di environment variables.')
    return []
  }

  try {
    let endpoint = `${url}?action=getLaporan`
    if (namaPegawai) {
      endpoint += `&nama=${encodeURIComponent(namaPegawai)}`
    }

    const res = await fetch(endpoint, {
      method: 'GET',
      redirect: 'follow',
      cache: 'no-store',
    })

    if (!res.ok) {
      console.error(`[APPSCRIPT] getLaporan HTTP error: ${res.status}`)
      return []
    }

    const json = await res.json()
    if (json.status === 'success' && Array.isArray(json.data)) {
      return json.data.map(mapLaporanData)
    }

    console.warn('[APPSCRIPT] Format respons getLaporan tidak sesuai:', json)
    return []
  } catch (error) {
    console.error('[APPSCRIPT] Error fetching laporan:', error)
    return []
  }
}

/**
 * Submit laporan baru dan unggah file ke Google Drive melalui Google Apps Script Web App
 */
export async function submitLaporanToAppsScript(
  payload: AppsScriptSubmitPayload
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

    const data = await res.json()
    return data
  } catch (error: any) {
    console.error('[APPSCRIPT] Error submitting laporan to Apps Script:', error)
    return {
      status: 'error',
      message: error?.message || 'Gagal terhubung ke Google Apps Script.',
    }
  }
}

/**
 * Update evaluasi tindak lanjut dan catatan pimpinan di Google Spreadsheet
 */
export async function updateEvaluasiInAppsScript(
  row: number,
  status: string,
  catatan: string
): Promise<{ status: string; message?: string }> {
  const url = process.env.APPSCRIPT_URL
  if (!url) {
    return {
      status: 'error',
      message: 'APPSCRIPT_URL belum dikonfigurasi di file environment.',
    }
  }

  try {
    const endpoint = `${url}?action=updatePimpinan&row=${encodeURIComponent(
      row
    )}&status=${encodeURIComponent(status)}&catatan=${encodeURIComponent(catatan)}`

    const res = await fetch(endpoint, {
      method: 'GET',
      redirect: 'follow',
      cache: 'no-store',
    })

    return res.json()
  } catch (error: any) {
    console.error('[APPSCRIPT] Error updating evaluasi pimpinan:', error)
    return {
      status: 'error',
      message: error?.message || 'Gagal memperbarui data di Google Apps Script.',
    }
  }
}
