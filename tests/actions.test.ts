import { describe, it, expect } from 'vitest'
import { getDashboardStats } from '@/lib/actions'
import type { Laporan } from '@/lib/types'

describe('getDashboardStats', () => {
  it('calculates stats correctly from laporan array', async () => {
    const mockLaporan: Laporan[] = [
      {
        id: '2',
        pegawai_id: 'Budi Santoso',
        bidang: 'BIDANG PPTK',
        jabatan: 'Staff',
        jenis_penugasan: 'Luar Daerah',
        tanggal_kegiatan: '2026-08-25',
        nama_kegiatan: 'Rakor',
        tempat_kegiatan: 'Semarang',
        penyelenggara: 'Disnaker',
        tamu_undangan: null,
        catatan_hasil: null,
        dokumentasi_urls: null,
        materi_urls: null,
        status_tindak_lanjut: 'Selesai',
        catatan_pimpinan: '[Kadis]: OK',
        created_at: '',
        updated_at: '',
        pegawai: {
          id: '1',
          nama: 'Budi Santoso',
          nip: null,
          bidang: 'BIDANG PPTK',
          jabatan: 'Staff',
          is_active: true,
          created_at: '',
        },
      },
      {
        id: '3',
        pegawai_id: 'Budi Santoso',
        bidang: 'BIDANG PPTK',
        jabatan: 'Staff',
        jenis_penugasan: 'Dalam Daerah',
        tanggal_kegiatan: '2026-08-26',
        nama_kegiatan: 'Sosialisasi',
        tempat_kegiatan: 'Solo',
        penyelenggara: 'Disnaker',
        tamu_undangan: null,
        catatan_hasil: null,
        dokumentasi_urls: null,
        materi_urls: null,
        status_tindak_lanjut: 'Untuk Diketahui',
        catatan_pimpinan: null,
        created_at: '',
        updated_at: '',
        pegawai: {
          id: '1',
          nama: 'Budi Santoso',
          nip: null,
          bidang: 'BIDANG PPTK',
          jabatan: 'Staff',
          is_active: true,
          created_at: '',
        },
      },
      {
        id: '4',
        pegawai_id: 'Siti Rahma',
        bidang: 'SEKRETARIAT',
        jabatan: 'Staff',
        jenis_penugasan: 'Dalam Daerah',
        tanggal_kegiatan: '2026-08-27',
        nama_kegiatan: 'Workshop',
        tempat_kegiatan: 'Solo',
        penyelenggara: 'Disnaker',
        tamu_undangan: null,
        catatan_hasil: null,
        dokumentasi_urls: null,
        materi_urls: null,
        status_tindak_lanjut: 'Untuk Diketahui',
        catatan_pimpinan: '   ', // whitespace should not count as evaluated
        created_at: '',
        updated_at: '',
        pegawai: {
          id: '2',
          nama: 'Siti Rahma',
          nip: null,
          bidang: 'SEKRETARIAT',
          jabatan: 'Staff',
          is_active: true,
          created_at: '',
        },
      },
    ]

    const stats = await getDashboardStats(mockLaporan)
    expect(stats.totalLaporan).toBe(3)
    expect(stats.uniquePegawai).toBe(2)
    expect(stats.totalDievaluasi).toBe(1)
  })

  it('handles empty laporan array gracefully', async () => {
    const stats = await getDashboardStats([])
    expect(stats.totalLaporan).toBe(0)
    expect(stats.uniquePegawai).toBe(0)
    expect(stats.totalDievaluasi).toBe(0)
  })
})

describe('normalizePersonName', () => {
  it('normalizes names by stripping gelar and symbols', async () => {
    const { normalizePersonName } = await import('@/lib/appscript')
    expect(normalizePersonName("Nilna Qurrotaa'Yun, A.Md")).toBe('nilnaqurrotaayun')
    expect(normalizePersonName("NILNA QURROTAA'YUN")).toBe('nilnaqurrotaayun')
    expect(normalizePersonName("NILNA QURROTAA'YUN, A.Md")).toBe('nilnaqurrotaayun')
    expect(normalizePersonName('Pramutedy Sukoco, S.E., M.Si., CGRS')).toBe('pramutedysukoco')
  })
})

describe('getDirectImageBase64', () => {
  it('returns data url for mocked fetch response', async () => {
    const { getDirectImageBase64 } = await import('@/lib/actions')
    const originalFetch = global.fetch
    global.fetch = async () =>
      new Response(Buffer.from('fake-image-bytes'), {
        status: 200,
        headers: { 'Content-Type': 'image/jpeg' },
      })

    const result = await getDirectImageBase64(
      'https://drive.google.com/open?id=1JR4Gf_yt4jKlsL8SaN_jTWNv_JOp29TT'
    )
    expect(result).toContain('data:image/jpeg;base64,')

    global.fetch = originalFetch
  })

  it('returns null for empty or invalid input', async () => {
    const { getDirectImageBase64 } = await import('@/lib/actions')
    expect(await getDirectImageBase64('')).toBeNull()
  })

  it('fetches real Google Drive image or handles network timeout gracefully', async () => {
    const { getDirectImageBase64 } = await import('@/lib/actions')
    const realUrl = 'https://drive.google.com/open?id=1JR4Gf_yt4jKlsL8SaN_jTWNv_JOp29TT'
    const result = await getDirectImageBase64(realUrl)
    if (result) {
      expect(result).toMatch(/^data:image\/jpeg;base64,[A-Za-z0-9+/=]{100,}/)
    } else {
      expect(result).toBeNull()
    }
  }, 10000)
})

describe('Server Actions Zod Validation', () => {
  it('rejects submitLaporan with invalid data', async () => {
    const { submitLaporan } = await import('@/lib/actions')
    const invalidForm = {
      pegawai_id: '',
      bidang: '',
      jabatan: '',
      jenis_penugasan: '',
      tanggal_kegiatan: '02-09-2026', // invalid date
      nama_kegiatan: '',
      tempat_kegiatan: '',
      penyelenggara: '',
      tamu_undangan: '',
      catatan_hasil: '',
    }
    const res = await submitLaporan(invalidForm)
    expect(res.status).toBe('error')
    expect(res.message).toBeDefined()
  })

  it('rejects submitLaporan when attachment base64 payload exceeds 4.2 MB', async () => {
    const { submitLaporan } = await import('@/lib/actions')
    const validForm = {
      pegawai_id: 'Budi Santoso',
      bidang: 'BIDANG PPTK',
      jabatan: 'Staff',
      jenis_penugasan: 'Dalam Daerah',
      tanggal_kegiatan: '2026-08-26',
      nama_kegiatan: 'Sosialisasi',
      tempat_kegiatan: 'Solo',
      penyelenggara: 'Disnaker',
      tamu_undangan: 'DPRD',
      catatan_hasil: 'Koordinasi pembahasan kegiatan.',
    }
    // 4.5 MB Base64 string
    const oversizedBase64 = 'A'.repeat(4.5 * 1024 * 1024)
    const res = await submitLaporan(validForm, [], [{ base64: oversizedBase64, name: 'big.pdf', mime: 'application/pdf' }])
    expect(res.status).toBe('error')
    expect(res.message).toContain('Total ukuran')
  })

  it('rejects updateEvaluasiPimpinan with invalid status or invalid row', async () => {
    const { updateEvaluasiPimpinan } = await import('@/lib/actions')
    const resInvalidRow = await updateEvaluasiPimpinan('-5', 'Selesai (Untuk Diketahui)', 'Catatan', 'Kadis')
    expect(resInvalidRow.status).toBe('error')

    const resInvalidStatus = await updateEvaluasiPimpinan('2', 'Status Non-Dinas', 'Catatan', 'Kadis')
    expect(resInvalidStatus.status).toBe('error')
  })

  it('rejects loginPimpinan with invalid PIN format', async () => {
    const { loginPimpinan } = await import('@/lib/actions')
    const res = await loginPimpinan('Kepala Dinas', '12') // too short
    expect(res.success).toBe(false)
    expect(res.message).toContain('PIN')
  })

  it('sanitizes unexpected internal errors in submitLaporan', async () => {
    const { submitLaporan } = await import('@/lib/actions')
    const originalFetch = global.fetch
    // Mock fetch to reject with internal TypeError
    global.fetch = async () => {
      throw new TypeError("Cannot read properties of undefined (reading 'status')")
    }

    const validForm = {
      pegawai_id: 'Budi Santoso',
      bidang: 'BIDANG PPTK',
      jabatan: 'Staff',
      jenis_penugasan: 'Dalam Daerah',
      tanggal_kegiatan: '2026-08-26',
      nama_kegiatan: 'Sosialisasi',
      tempat_kegiatan: 'Solo',
      penyelenggara: 'Disnaker',
      tamu_undangan: 'DPRD',
      catatan_hasil: 'Koordinasi pembahasan kegiatan.',
    }

    const res = await submitLaporan(validForm)
    expect(res.status).toBe('error')
    expect(res.message).not.toContain('TypeError')
    expect(res.message).not.toContain('undefined')
    expect((res as any).errorCode).toMatch(/^ERR-SPG-[A-HJ-NP-Z2-9]{4,5}$/)

    global.fetch = originalFetch
  })

  it('rejects updateLaporan with invalid data or missing nip', async () => {
    const { updateLaporan } = await import('@/lib/actions')
    const invalidData = {
      rowIndex: -1,
      pegawai_id: '',
      nip: '',
      bidang: '',
      jabatan: '',
      jenis_penugasan: '',
      tanggal_kegiatan: 'invalid-date',
      nama_kegiatan: '',
      tempat_kegiatan: '',
      penyelenggara: '',
    }
    const res = await updateLaporan(invalidData as any)
    expect(res.status).toBe('error')
    expect(res.message).toBeDefined()
  })

  it('rejects updateLaporan if the report has already been evaluated by pimpinan', async () => {
    const { updateLaporan } = await import('@/lib/actions')
    const originalFetch = global.fetch
    process.env.APPSCRIPT_URL = 'https://script.google.com/mock'

    // Mock laporan yang sudah memiliki catatan pimpinan
    global.fetch = async (url: any) => {
      const urlStr = String(url)
      if (urlStr.includes('action=getLaporan')) {
        return new Response(
          JSON.stringify({
            status: 'success',
            data: [
              {
                Row_Index: 3,
                'Nama Pegawai': 'Budi Santoso',
                Bidang: 'Sekretariat',
                'Jenis Penugasan': 'Rapat',
                'Tanggal Kegiatan': '20/09/2026',
                'Nama Kegiatan': 'Rapat Lama',
                'Tempat Kegiatan': 'Solo',
                'Penyelenggara Kegiatan': 'Disnaker',
                'Catatan Hasil Kegiatan': 'Hasil',
                'Status Tindak Lanjut': 'Selesai (Untuk Diketahui)',
                'Catatan Pimpinan': 'Sudah disetujui Kepala Dinas',
              },
            ],
          }),
          { status: 200 }
        )
      }
      return new Response(JSON.stringify({ status: 'success', data: [] }), { status: 200 })
    }

    const payload = {
      rowIndex: 3,
      pegawai_id: 'Budi Santoso',
      nip: '198501012010011001',
      bidang: 'Sekretariat',
      jabatan: 'Staff',
      jenis_penugasan: 'Rapat',
      tanggal_kegiatan: '2026-09-20',
      nama_kegiatan: 'Revisi Rapat',
      tempat_kegiatan: 'Solo',
      penyelenggara: 'Disnaker',
      catatan_hasil: 'Hasil baru',
    }

    const res = await updateLaporan(payload as any)
    expect(res.status).toBe('error')
    expect(res.message).toContain('telah dievaluasi oleh Pimpinan')

    global.fetch = originalFetch
  })

  it('rejects updateLaporan if nip does not match pelapor master data', async () => {
    const { updateLaporan } = await import('@/lib/actions')
    const originalFetch = global.fetch
    process.env.APPSCRIPT_URL = 'https://script.google.com/mock'

    global.fetch = async (url: any) => {
      const urlStr = String(url)
      if (urlStr.includes('action=getLaporan')) {
        return new Response(
          JSON.stringify({
            status: 'success',
            data: [
              {
                Row_Index: 5,
                'Nama Pegawai': 'Budi Santoso',
                Bidang: 'Sekretariat',
                'Jenis Penugasan': 'Rapat',
                'Tanggal Kegiatan': '20/09/2026',
                'Nama Kegiatan': 'Rapat Belum Dievaluasi',
                'Tempat Kegiatan': 'Solo',
                'Penyelenggara Kegiatan': 'Disnaker',
                'Catatan Hasil Kegiatan': 'Hasil',
                'Status Tindak Lanjut': 'Untuk Diketahui',
                'Catatan Pimpinan': '',
              },
            ],
          }),
          { status: 200 }
        )
      }
      if (urlStr.includes('action=getPegawai')) {
        return new Response(
          JSON.stringify({
            status: 'success',
            data: [
              {
                id: '1',
                nama: 'Budi Santoso',
                nip: '198501012010011001',
                bidang: 'Sekretariat',
                jabatan: 'Staff',
              },
            ],
          }),
          { status: 200 }
        )
      }
      return new Response(JSON.stringify({ status: 'success', data: [] }), { status: 200 })
    }

    const payloadWithWrongNip = {
      rowIndex: 5,
      pegawai_id: 'Budi Santoso',
      nip: '199999999999999999', // NIP salah
      bidang: 'Sekretariat',
      jabatan: 'Staff',
      jenis_penugasan: 'Rapat',
      tanggal_kegiatan: '2026-09-20',
      nama_kegiatan: 'Revisi Rapat',
      tempat_kegiatan: 'Solo',
      penyelenggara: 'Disnaker',
      catatan_hasil: 'Hasil baru',
    }

    const res = await updateLaporan(payloadWithWrongNip as any)
    expect(res.status).toBe('error')
    expect(res.message).toContain('NIP yang dimasukkan tidak cocok')

    global.fetch = originalFetch
  })

  it('rejects updateLaporan if target pegawai is not registered in master data', async () => {
    const { updateLaporan } = await import('@/lib/actions')
    const originalFetch = global.fetch
    process.env.APPSCRIPT_URL = 'https://script.google.com/mock'

    global.fetch = async (url: any) => {
      const urlStr = String(url)
      if (urlStr.includes('action=getLaporan')) {
        return new Response(
          JSON.stringify({
            status: 'success',
            data: [
              {
                Row_Index: 6,
                'Nama Pegawai': 'Pegawai Tidak Terdaftar',
                Bidang: 'Sekretariat',
                'Jenis Penugasan': 'Rapat',
                'Tanggal Kegiatan': '20/09/2026',
                'Nama Kegiatan': 'Rapat',
                'Tempat Kegiatan': 'Solo',
                'Penyelenggara Kegiatan': 'Disnaker',
                'Catatan Hasil Kegiatan': 'Hasil',
                'Status Tindak Lanjut': 'Untuk Diketahui',
                'Catatan Pimpinan': '',
              },
            ],
          }),
          { status: 200 }
        )
      }
      if (urlStr.includes('action=getPegawai')) {
        return new Response(
          JSON.stringify({
            status: 'success',
            data: [
              {
                id: '1',
                nama: 'Budi Santoso',
                nip: '198501012010011001',
                bidang: 'Sekretariat',
                jabatan: 'Staff',
              },
            ],
          }),
          { status: 200 }
        )
      }
      return new Response(JSON.stringify({ status: 'success', data: [] }), { status: 200 })
    }

    const payload = {
      rowIndex: 6,
      pegawai_id: 'Pegawai Tidak Terdaftar',
      nip: '198501012010011001',
      bidang: 'Sekretariat',
      jabatan: 'Staff',
      jenis_penugasan: 'Rapat',
      tanggal_kegiatan: '2026-09-20',
      nama_kegiatan: 'Revisi Rapat',
      tempat_kegiatan: 'Solo',
      penyelenggara: 'Disnaker',
      catatan_hasil: 'Hasil baru',
    }

    const res = await updateLaporan(payload as any)
    expect(res.status).toBe('error')
    expect(res.message).toContain('tidak terdaftar di sistem')

    global.fetch = originalFetch
  })
})

describe('refreshData action', () => {
  it('returns success status and message when revalidating cache', async () => {
    const { refreshData } = await import('@/lib/actions')
    const res = await refreshData('all')
    expect(res).toBeDefined()
    expect(res.status).toBe('success')
    expect(res.message).toContain('Data berhasil disinkronkan')
  })

  it('supports revalidating specific tags (laporan or pegawai)', async () => {
    const { refreshData } = await import('@/lib/actions')
    const resLaporan = await refreshData('laporan')
    expect(resLaporan.status).toBe('success')

    const resPegawai = await refreshData('pegawai')
    expect(resPegawai.status).toBe('success')
  })
})

