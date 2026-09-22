// ============================================================
// TypeScript Interfaces — SIMPELGAS
// ============================================================

export interface Pegawai {
  id: string
  nama: string
  nip: string | null
  bidang: string
  jabatan: string
  is_active: boolean
  created_at: string
}

export interface Laporan {
  id: string
  pegawai_id: string
  bidang: string
  jabatan: string | null
  jenis_penugasan: string
  tanggal_kegiatan: string // DATE stored as string from Supabase
  nama_kegiatan: string
  tempat_kegiatan: string
  penyelenggara: string
  tamu_undangan: string | null
  catatan_hasil: string | null
  dokumentasi_urls: string[] | null
  materi_urls: string[] | null
  status_tindak_lanjut: string
  catatan_pimpinan: string | null
  created_at: string
  updated_at: string
  // Joined fields
  pegawai?: Pegawai
}

export interface PimpinanRole {
  id: string
  user_id: string
  nama: string
  role: string
  scopes: string[]
  created_at: string
}

export interface DashboardStats {
  totalLaporan: number
  uniquePegawai: number
  totalDievaluasi: number
}

export interface LaporanFormData {
  pegawai_id: string
  bidang: string
  jabatan: string
  jenis_penugasan: string
  tanggal_kegiatan: string
  nama_kegiatan: string
  tempat_kegiatan: string
  penyelenggara: string
  tamu_undangan: string
  catatan_hasil: string
}

export interface KegiatanInternal {
  id: string
  jenis_kegiatan: string
  nama_kegiatan: string
  tanggal_kegiatan: string
  waktu_mulai: string | null
  waktu_selesai: string | null
  tempat_kegiatan: string
  bidang: string
  pic_pegawai_id: string | null
  agenda: string | null
  hasil_kegiatan: string | null
  peserta: string | null
  jumlah_peserta: number | null
  daftar_hadir_urls: string[] | null
  undangan_urls: string[] | null
  foto_kegiatan_urls: string[] | null
  notulen_urls: string[] | null
  foto_jamuan_urls: string[] | null
  status_spj: string
  catatan_pimpinan: string | null
  created_at: string
  updated_at: string
  // Joined fields
  pegawai?: Pegawai
}

export interface KegiatanInternalFormData {
  jenis_kegiatan: string
  nama_kegiatan: string
  tanggal_kegiatan: string
  waktu_mulai: string
  waktu_selesai: string
  tempat_kegiatan: string
  bidang: string
  pic_pegawai_id: string
  agenda: string
  hasil_kegiatan: string
  peserta: string
  jumlah_peserta: number | null
}

export interface UpdateLaporanFormData extends LaporanFormData {
  rowIndex: number
  nip: string
  existing_dok_urls?: string[]
  existing_materi_urls?: string[]
}
