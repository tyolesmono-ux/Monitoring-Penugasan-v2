import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { InputFormClient } from '../src/components/input-form-client'
import type { Pegawai } from '../src/lib/types'

const mockPegawaiList: Pegawai[] = [
  {
    id: 'peg-1',
    nama: 'Budi Santoso, S.Kom',
    nip: '198501012010011001',
    bidang: 'Sekretariat',
    jabatan: 'Pranata Komputer Ahli Muda',
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'peg-2',
    nama: 'Siti Rahayu, S.E.',
    nip: '198902022012022002',
    bidang: 'Bidang Hubungan Industrial',
    jabatan: 'Pengawas Ketenagakerjaan',
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
  },
]

describe('InputFormClient Redesign & Workbench Layout (TDD)', () => {
  it('renders InputFormClient with SSR without throwing errors', () => {
    const html = renderToString(<InputFormClient pegawaiList={mockPegawaiList} />)
    expect(html).toBeDefined()
    expect(html).toContain('Formulir Laporan Penugasan')
  })

  it('renders required form controls and inputs', () => {
    const html = renderToString(<InputFormClient pegawaiList={mockPegawaiList} />)
    expect(html).toContain('name="bidang"')
    expect(html).toContain('name="pegawai_id"')
    expect(html).toContain('name="jenis"')
    expect(html).toContain('name="tanggal"')
    expect(html).toContain('name="kegiatan"')
    expect(html).toContain('name="tempat"')
    expect(html).toContain('name="penyelenggara"')
    expect(html).toContain('name="tamu"')
    expect(html).toContain('name="catatan"')
    expect(html).toContain('name="file_dok"')
    expect(html).toContain('name="file_materi"')
  })

  it('contains AI enhancement action and submit button', () => {
    const html = renderToString(<InputFormClient pegawaiList={mockPegawaiList} />)
    expect(html).toContain('Perbaiki Teks dengan AI')
    expect(html).toContain('Kirim Laporan Penugasan')
  })

  it('implements responsive workbench grid architecture with balanced columns and tall textarea', () => {
    const html = renderToString(<InputFormClient pegawaiList={mockPegawaiList} />)
    // Redesigned form uses multi-column split grid on md (768px+)
    expect(html).toContain('md:grid-cols-12')
    // Left and right columns use balanced 50:50 layout (6 columns each)
    expect(html).toContain('md:col-span-6 xl:col-span-6')
    // Sub-panel lampiran exists
    expect(html).toContain('Lampiran Berkas &amp; Dokumentasi')
    // Textarea has full-height flex-1 and min-h-380px
    expect(html).toContain('flex-1')
    expect(html).toContain('min-h-[380px]')
  })
})
