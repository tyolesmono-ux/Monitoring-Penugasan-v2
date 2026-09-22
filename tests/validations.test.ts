import { describe, it, expect } from 'vitest'
import {
  LaporanFormDataSchema,
  EvaluasiPimpinanSchema,
  LoginPimpinanSchema,
  UpdateLaporanSchema,
} from '../src/lib/validations'

describe('Zod Validation Schemas', () => {
  it('validates correct LaporanFormData', () => {
    const validData = {
      pegawai_id: 'Ahmad Dahlan',
      bidang: 'Sekretariat',
      jabatan: 'Staff',
      jenis_penugasan: 'Rapat Koordinasi',
      tanggal_kegiatan: '2026-09-02',
      nama_kegiatan: 'Rapat Koordinasi Evaluasi',
      tempat_kegiatan: 'Ruang Rapat Disnaker',
      penyelenggara: 'Disnaker Surakarta',
      tamu_undangan: 'Sekretaris Dinas',
      catatan_hasil: 'Telah dilaksanakan koordinasi penyusunan anggaran.',
    }
    const result = LaporanFormDataSchema.safeParse(validData)
    expect(result.success).toBe(true)
  })

  it('rejects LaporanFormData with invalid date or empty required fields', () => {
    const invalidDate = {
      pegawai_id: 'Ahmad Dahlan',
      bidang: 'Sekretariat',
      jabatan: 'Staff',
      jenis_penugasan: 'Rapat Koordinasi',
      tanggal_kegiatan: '02-09-2026', // wrong format
      nama_kegiatan: 'Rapat',
      tempat_kegiatan: 'Disnaker',
      penyelenggara: 'Disnaker',
      tamu_undangan: '-',
      catatan_hasil: 'Catatan',
    }
    expect(LaporanFormDataSchema.safeParse(invalidDate).success).toBe(false)

    const emptyPegawai = {
      ...invalidDate,
      tanggal_kegiatan: '2026-09-02',
      pegawai_id: '   ', // whitespace only
    }
    expect(LaporanFormDataSchema.safeParse(emptyPegawai).success).toBe(false)
  })

  it('validates EvaluasiPimpinan with official status enum', () => {
    const valid = {
      rowIndex: 2,
      status_tindak_lanjut: 'Selesai (Untuk Diketahui)',
      catatan_pimpinan: 'Lanjutkan koordinasi.',
    }
    expect(EvaluasiPimpinanSchema.safeParse(valid).success).toBe(true)

    const invalidStatus = {
      rowIndex: 2,
      status_tindak_lanjut: 'Status Sembarangan',
      catatan_pimpinan: 'Catatan',
    }
    expect(EvaluasiPimpinanSchema.safeParse(invalidStatus).success).toBe(false)

    const invalidRowIndex = {
      rowIndex: -1,
      status_tindak_lanjut: 'Selesai (Untuk Diketahui)',
      catatan_pimpinan: 'Catatan',
    }
    expect(EvaluasiPimpinanSchema.safeParse(invalidRowIndex).success).toBe(false)
  })

  it('validates LoginPimpinan PIN numeric length (4-6 digits)', () => {
    expect(LoginPimpinanSchema.safeParse({ pin: '1234' }).success).toBe(true)
    expect(LoginPimpinanSchema.safeParse({ pin: '123456' }).success).toBe(true)
    expect(LoginPimpinanSchema.safeParse({ pin: '12' }).success).toBe(false)
    expect(LoginPimpinanSchema.safeParse({ pin: '12345678' }).success).toBe(false)
    expect(LoginPimpinanSchema.safeParse({ pin: 'abcd' }).success).toBe(false)
  })


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

  it('rejects update when nip is missing', () => {
    const dataWithoutNip = {
      rowIndex: 5,
      pegawai_id: 'Budi Santoso, S.Kom',
      bidang: 'Sekretariat',
      jenis_penugasan: 'Rapat Koordinasi',
      tanggal_kegiatan: '2026-09-22',
      nama_kegiatan: 'Rapat Evaluasi Triwulan',
      tempat_kegiatan: 'Hotel Solo Paragon',
      penyelenggara: 'Disnaker Surakarta',
      tamu_undangan: 'Seluruh OPD',
      catatan_hasil: 'Hasil rapat disepakati bersama',
    }
    const result = UpdateLaporanSchema.safeParse(dataWithoutNip)
    expect(result.success).toBe(false)
  })
})
})
