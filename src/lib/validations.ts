import { z } from 'zod'

export const LaporanFormDataSchema = z.object({
  pegawai_id: z.string().trim().min(1, 'Pegawai wajib dipilih atau diisi'),
  bidang: z.string().trim().min(1, 'Bidang wajib dipilih'),
  jabatan: z.string().optional().default(''),
  jenis_penugasan: z.string().trim().min(1, 'Jenis penugasan wajib dipilih'),
  tanggal_kegiatan: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD'),
  nama_kegiatan: z.string().trim().min(1, 'Nama kegiatan wajib diisi'),
  tempat_kegiatan: z.string().trim().min(1, 'Tempat kegiatan wajib diisi'),
  penyelenggara: z.string().trim().min(1, 'Penyelenggara wajib diisi'),
  tamu_undangan: z.string().optional().default('-'),
  catatan_hasil: z.string().trim().min(1, 'Catatan hasil kegiatan wajib diisi'),
})

export type ValidatedLaporanFormData = z.infer<typeof LaporanFormDataSchema>

export const EvaluasiPimpinanSchema = z.object({
  rowIndex: z.number().int().positive('Index baris harus berupa bilangan bulat positif'),
  status_tindak_lanjut: z.enum([
    'Selesai (Untuk Diketahui)',
    'Perlu Tindak Lanjut Bidang Teknis'
  ], {
    message: 'Status tindak lanjut harus sesuai kategori resmi'
  }),
  catatan_pimpinan: z.string().trim().min(1, 'Catatan arahan pimpinan wajib diisi')
})

export type EvaluasiPimpinanInput = z.infer<typeof EvaluasiPimpinanSchema>

export const LoginPimpinanSchema = z.object({
  pin: z.string().regex(/^\d{4,6}$/, 'PIN harus terdiri dari 4 sampai 6 digit angka')
})

export const UpdateLaporanSchema = LaporanFormDataSchema.extend({
  rowIndex: z.number().int().positive('Index baris harus berupa bilangan bulat positif'),
  nip: z.string().trim().min(1, 'NIP pegawai wajib diisi untuk verifikasi kepemilikan'),
  existing_dok_urls: z.array(z.string()).optional(),
  existing_materi_urls: z.array(z.string()).optional(),
})

export type ValidatedUpdateLaporanData = z.infer<typeof UpdateLaporanSchema>

export type LoginPimpinanInput = z.infer<typeof LoginPimpinanSchema>
