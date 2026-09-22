import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => '/laporan',
}))

import { LaporanListClient } from '../src/components/laporan-list-client'
import type { Laporan, Pegawai } from '../src/lib/types'

describe('LaporanListClient', () => {
  const mockLaporan: Laporan[] = [
    {
      id: '2',
      pegawai_id: 'Budi Santoso',
      bidang: 'Sekretariat',
      jenis_penugasan: 'Rapat Koordinasi',
      tanggal_kegiatan: '2026-09-22',
      nama_kegiatan: 'Rapat Anggaran',
      tempat_kegiatan: 'Kantor Disnaker',
      penyelenggara: 'Disnaker',
      status_tindak_lanjut: 'Untuk Diketahui',
      catatan_pimpinan: null,
      created_at: '',
      updated_at: '',
      dokumentasi_urls: [],
      materi_urls: [],
      jabatan: 'Staff',
      tamu_undangan: null,
      catatan_hasil: 'Hasil rapat koordinasi awal',
    },
    {
      id: '3',
      pegawai_id: 'Siti Rahma',
      bidang: 'Bidang PPTK',
      jenis_penugasan: 'Sosialisasi',
      tanggal_kegiatan: '2026-09-21',
      nama_kegiatan: 'Sosialisasi Penempatan Tenaga Kerja',
      tempat_kegiatan: 'Hotel Solo',
      penyelenggara: 'Disnaker',
      status_tindak_lanjut: 'Selesai (Untuk Diketahui)',
      catatan_pimpinan: 'Telah disetujui Kepala Dinas',
      created_at: '',
      updated_at: '',
      dokumentasi_urls: [],
      materi_urls: [],
      jabatan: 'Analis',
      tamu_undangan: null,
      catatan_hasil: 'Kegiatan berjalan lancar',
    },
  ]

  const mockPegawai: Pegawai[] = [
    {
      id: '1',
      nama: 'Budi Santoso',
      nip: '198501012010011001',
      bidang: 'Sekretariat',
      jabatan: 'Staff',
      is_active: true,
      created_at: '',
    },
    {
      id: '2',
      nama: 'Siti Rahma',
      nip: '198802022012012002',
      bidang: 'Bidang PPTK',
      jabatan: 'Analis',
      is_active: true,
      created_at: '',
    },
  ]

  it('renders title, search filter, and list of reports', () => {
    const html = renderToString(
      <LaporanListClient initialLaporan={mockLaporan} pegawaiList={mockPegawai} />
    )
    expect(html).toContain('Daftar Laporan Penugasan')
    expect(html).toContain('Rapat Anggaran')
    expect(html).toContain('Sosialisasi Penempatan Tenaga Kerja')
  })

  it('displays status indicators for editable and locked reports', () => {
    const html = renderToString(
      <LaporanListClient initialLaporan={mockLaporan} pegawaiList={mockPegawai} />
    )
    expect(html).toContain('Dapat Diedit')
    expect(html).toContain('Terkunci')
  })

  it('renders action buttons for reports', () => {
    const html = renderToString(
      <LaporanListClient initialLaporan={mockLaporan} pegawaiList={mockPegawai} />
    )
    expect(html).toContain('Edit Laporan')
  })
})
