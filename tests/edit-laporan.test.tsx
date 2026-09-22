import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => '/laporan/5/edit',
}))

import { EditLaporanClient } from '../src/components/edit-laporan-client'
import type { Laporan, Pegawai } from '../src/lib/types'

describe('EditLaporanClient', () => {
  const mockLaporan: Laporan = {
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
    created_at: '',
    updated_at: '',
    dokumentasi_urls: ['https://drive.google.com/photo1.jpg'],
    materi_urls: ['https://drive.google.com/materi1.pdf'],
    jabatan: 'Staff IT',
  }

  const mockPegawai: Pegawai[] = [
    {
      id: '1',
      nama: 'Budi Santoso, S.Kom',
      nip: '198501012010011001',
      bidang: 'Sekretariat',
      jabatan: 'Staff IT',
      is_active: true,
      created_at: '',
    },
  ]

  it('renders pre-filled data and submit update button', () => {
    const html = renderToString(
      <EditLaporanClient
        laporan={mockLaporan}
        pegawaiList={mockPegawai}
        initialNip="198501012010011001"
      />
    )
    expect(html).toContain('Edit Formulir Laporan Penugasan')
    expect(html).toContain('Rapat Koordinasi Evaluasi')
    expect(html).toContain('Simpan Perubahan Laporan')
    expect(html).toContain('Hotel Solo Paragon')
  })

  it('renders existing attachments section with links or cards', () => {
    const html = renderToString(
      <EditLaporanClient
        laporan={mockLaporan}
        pegawaiList={mockPegawai}
        initialNip="198501012010011001"
      />
    )
    expect(html).toContain('Lampiran Foto Tersimpan')
    expect(html).toContain('Berkas Materi Tersimpan')
  })
})

describe('EditLaporanPage Server Component', () => {
  it('renders locked banner when report has catatan_pimpinan', async () => {
    vi.doMock('@/lib/actions', () => ({
      getAllLaporan: vi.fn().mockResolvedValue([
        {
          id: '10',
          nama_kegiatan: 'Kegiatan Terkunci',
          pegawai_id: 'Budi Santoso',
          bidang: 'Sekretariat',
          status_tindak_lanjut: 'Selesai',
          catatan_pimpinan: 'Sudah disetujui',
        },
      ]),
      getPegawai: vi.fn().mockResolvedValue([]),
    }))

    const EditLaporanPage = (await import('../src/app/laporan/[id]/edit/page')).default
    const jsx = await EditLaporanPage({ params: { id: '10' } })
    const html = renderToString(jsx)

    expect(html).toContain('Laporan Telah Dievaluasi Pimpinan')
    expect(html).toContain('Laporan Terkunci')
    expect(html).toContain('Sudah disetujui')
  })
})
