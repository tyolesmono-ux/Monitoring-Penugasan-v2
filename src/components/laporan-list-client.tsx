'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  ClipboardList,
  Search,
  Filter,
  RotateCcw,
  Lock,
  CheckCircle2,
  FileEdit,
  Eye,
  Calendar,
  MapPin,
  Building2,
  User,
  ChevronLeft,
  ChevronRight,
  X,
  ExternalLink,
  ShieldAlert,
  FileText,
} from 'lucide-react'
import Swal from 'sweetalert2'
import { DESIGN_TOKENS } from '@/lib/design-tokens'
import { normalizePersonName } from '@/lib/appscript'
import type { Laporan, Pegawai } from '@/lib/types'
import { EmptyState } from '@/components/ui/empty-state'

interface LaporanListClientProps {
  initialLaporan: Laporan[]
  pegawaiList: Pegawai[]
}

function cleanText(str: string): string {
  return str ? str.toString().toLowerCase().replace(/\s+/g, ' ').trim() : ''
}

function isLaporanLocked(lap: Laporan): boolean {
  const hasCatatan = Boolean(lap.catatan_pimpinan && lap.catatan_pimpinan.trim() !== '')
  const isNotInitialStatus = Boolean(lap.status_tindak_lanjut && lap.status_tindak_lanjut !== 'Untuk Diketahui')
  return hasCatatan || isNotInitialStatus
}

export function LaporanListClient({ initialLaporan = [], pegawaiList = [] }: LaporanListClientProps) {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState('')
  const [filterBidang, setFilterBidang] = useState('Semua')
  const [filterStatus, setFilterStatus] = useState<'Semua' | 'Dapat Diedit' | 'Terkunci'>('Semua')
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedDetail, setSelectedDetail] = useState<Laporan | null>(null)

  const itemsPerPage = 8

  // Daftar bidang unik
  const bidangList = useMemo(() => {
    const list = new Set<string>()
    initialLaporan.forEach((l) => {
      if (l.bidang && l.bidang.trim()) list.add(l.bidang.trim())
    })
    return ['Semua', ...Array.from(list)]
  }, [initialLaporan])

  // Metrik KPI
  const stats = useMemo(() => {
    const total = initialLaporan.length
    let locked = 0
    let editable = 0
    initialLaporan.forEach((l) => {
      if (isLaporanLocked(l)) locked++
      else editable++
    })
    return { total, locked, editable }
  }, [initialLaporan])

  // Filter & Search logic
  const filteredLaporan = useMemo(() => {
    const query = cleanText(searchTerm)

    return initialLaporan.filter((lap) => {
      // 1. Filter Bidang
      if (filterBidang !== 'Semua' && lap.bidang !== filterBidang) {
        return false
      }

      // 2. Filter Status Locking
      const locked = isLaporanLocked(lap)
      if (filterStatus === 'Dapat Diedit' && locked) return false
      if (filterStatus === 'Terkunci' && !locked) return false

      // 3. Search Term
      if (query) {
        const inNamaKegiatan = cleanText(lap.nama_kegiatan).includes(query)
        const inTempat = cleanText(lap.tempat_kegiatan).includes(query)
        const inPegawai = cleanText(lap.pegawai_id).includes(query)
        const inCatatan = cleanText(lap.catatan_hasil || '').includes(query)
        const inPenyelenggara = cleanText(lap.penyelenggara).includes(query)
        if (!inNamaKegiatan && !inTempat && !inPegawai && !inCatatan && !inPenyelenggara) {
          return false
        }
      }

      return true
    })
  }, [initialLaporan, filterBidang, filterStatus, searchTerm])

  // Pagination
  const totalPages = Math.ceil(filteredLaporan.length / itemsPerPage) || 1
  const paginatedLaporan = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredLaporan.slice(start, start + itemsPerPage)
  }, [filteredLaporan, currentPage])

  // Handler klik tombol Edit Laporan
  const handleEditClick = async (laporan: Laporan) => {
    if (isLaporanLocked(laporan)) {
      await Swal.fire({
        icon: 'warning',
        title: 'Laporan Terkunci',
        text: 'Laporan ini telah ditindaklanjuti atau dievaluasi oleh Pimpinan sehingga tidak dapat diubah.',
        confirmButtonColor: DESIGN_TOKENS.sweetAlert.cancelButtonColor,
      })
      return
    }

    // Temukan master pegawai pelapor
    const pegawai = pegawaiList.find(
      (p) =>
        normalizePersonName(p.nama) === normalizePersonName(laporan.pegawai_id) ||
        p.id === laporan.pegawai_id
    )

    const result = await Swal.fire({
      title: 'Verifikasi NIP Pegawai',
      text: `Masukkan NIP pegawai pelapor (${laporan.pegawai_id}) untuk melanjutkan penyuntingan.`,
      input: 'password',
      inputPlaceholder: 'Masukkan NIP Anda...',
      inputAttributes: {
        autocapitalize: 'off',
        autocorrect: 'off',
      },
      showCancelButton: true,
      confirmButtonText: 'Verifikasi & Buka Form',
      cancelButtonText: 'Batal',
      confirmButtonColor: DESIGN_TOKENS.sweetAlert.confirmButtonColor,
      cancelButtonColor: DESIGN_TOKENS.sweetAlert.cancelButtonColor,
      inputValidator: (val) => {
        if (!val || !val.trim()) {
          return 'NIP pegawai wajib diisi!'
        }
      },
    })

    if (!result.isConfirmed || !result.value) return

    const inputNip = result.value.trim()

    // Jika pegawai memiliki NIP di data master, validasi kecocokan
    if (pegawai?.nip) {
      const cleanInput = inputNip.replace(/\s+/g, '')
      const cleanTarget = pegawai.nip.replace(/\s+/g, '')
      if (cleanInput !== cleanTarget) {
        await Swal.fire({
          icon: 'error',
          title: 'Verifikasi Gagal',
          text: 'NIP yang Anda masukkan tidak sesuai dengan master data pegawai pelapor.',
          confirmButtonColor: DESIGN_TOKENS.sweetAlert.destructiveConfirmButtonColor,
        })
        return
      }
    }

    // NIP valid -> Arahkan ke rute edit
    router.push(`/laporan/${laporan.id}/edit?nip=${encodeURIComponent(inputNip)}`)
  }

  return (
    <div className="space-y-6">
      {/* Header & KPI Overview */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider mb-1">
            <ClipboardList size={16} />
            <span>Manajemen Data Penugasan</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Daftar Laporan Penugasan
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Pencarian riwayat pelaporan ASN serta akses revisi laporan yang belum dievaluasi Pimpinan.
          </p>
        </div>

        {/* Quick KPI Badges */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-center">
            <div className="text-[10px] uppercase font-bold text-slate-400">Total</div>
            <div className="text-base sm:text-lg font-black text-slate-800">{stats.total}</div>
          </div>
          <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-xl px-3 py-2 text-center">
            <div className="text-[10px] uppercase font-bold text-emerald-600">Dapat Diedit</div>
            <div className="text-base sm:text-lg font-black text-emerald-700">{stats.editable}</div>
          </div>
          <div className="bg-slate-100 border border-slate-300/80 rounded-xl px-3 py-2 text-center">
            <div className="text-[10px] uppercase font-bold text-slate-500">Terkunci</div>
            <div className="text-base sm:text-lg font-black text-slate-700">{stats.locked}</div>
          </div>
        </div>
      </div>

      {/* Control Panel: Filters & Search */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search Input */}
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Cari kegiatan, tempat, pegawai pelapor..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Bidang Dropdown */}
          <div>
            <select
              value={filterBidang}
              onChange={(e) => {
                setFilterBidang(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition cursor-pointer"
            >
              {bidangList.map((bidang) => (
                <option key={bidang} value={bidang}>
                  Bidang: {bidang}
                </option>
              ))}
            </select>
          </div>

          {/* Status Dropdown */}
          <div>
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value as any)
                setCurrentPage(1)
              }}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition cursor-pointer"
            >
              <option value="Semua">Status: Semua</option>
              <option value="Dapat Diedit">Status: Dapat Diedit</option>
              <option value="Terkunci">Status: Terkunci (Evaluasi)</option>
            </select>
          </div>
        </div>

        {/* Reset Filter Action */}
        {(searchTerm || filterBidang !== 'Semua' || filterStatus !== 'Semua') && (
          <div className="flex items-center justify-between pt-1 border-t border-slate-100">
            <span className="text-xs text-slate-500">
              Menampilkan <strong>{filteredLaporan.length}</strong> dari {initialLaporan.length} laporan
            </span>
            <button
              onClick={() => {
                setSearchTerm('')
                setFilterBidang('Semua')
                setFilterStatus('Semua')
                setCurrentPage(1)
              }}
              className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 font-semibold transition"
            >
              <RotateCcw size={12} />
              <span>Reset Filter</span>
            </button>
          </div>
        )}
      </div>

      {/* Laporan Items List */}
      {paginatedLaporan.length === 0 ? (
        <EmptyState
          title="Laporan Tidak Ditemukan"
          description="Tidak ada laporan penugasan yang sesuai dengan parameter pencarian atau filter yang dipilih."
          action={
            <button
              onClick={() => {
                setSearchTerm('')
                setFilterBidang('Semua')
                setFilterStatus('Semua')
              }}
              className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-200 transition"
            >
              Tampilkan Semua Laporan
            </button>
          }
        />
      ) : (
        <div className="space-y-3">
          {paginatedLaporan.map((lap) => {
            const locked = isLaporanLocked(lap)
            return (
              <div
                key={lap.id}
                className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-sm hover:shadow-md transition flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                {/* Information Column */}
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Status Locking Badge */}
                    {locked ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300">
                        <Lock size={12} className="text-slate-500" />
                        <span>Terkunci: Sudah Dievaluasi</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 size={12} className="text-emerald-600" />
                        <span>Dapat Diedit</span>
                      </span>
                    )}

                    {/* Bidang Badge */}
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                      <Building2 size={11} className="text-slate-500" />
                      <span>{lap.bidang || 'Umum'}</span>
                    </span>

                    {/* Jenis Penugasan Badge */}
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-50 text-slate-600 border border-slate-200">
                      {lap.jenis_penugasan}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug break-words">
                    {lap.nama_kegiatan}
                  </h3>

                  {/* Metadata Row */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <User size={13} className="text-slate-400" />
                      <strong className="text-slate-700 font-semibold">{lap.pegawai_id}</strong>
                      {lap.jabatan && <span className="text-slate-400">({lap.jabatan})</span>}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Calendar size={13} className="text-slate-400" />
                      <span>{lap.tanggal_kegiatan}</span>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin size={13} className="text-slate-400" />
                      <span className="truncate max-w-[220px]">{lap.tempat_kegiatan}</span>
                    </span>
                  </div>

                  {/* Arahan Pimpinan Notice if exists */}
                  {lap.catatan_pimpinan && (
                    <div className="mt-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 flex items-start gap-2">
                      <ShieldAlert size={15} className="text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-slate-800">Catatan Pimpinan: </span>
                        <span className="italic">{lap.catatan_pimpinan}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions Column */}
                <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                  {/* Detail Quick View Button */}
                  <button
                    type="button"
                    onClick={() => setSelectedDetail(lap)}
                    className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
                    title="Lihat Rincian Laporan"
                  >
                    <Eye size={16} />
                  </button>

                  {/* Edit Action Button */}
                  {locked ? (
                    <button
                      type="button"
                      disabled
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                      title="Laporan telah dievaluasi oleh Pimpinan dan terkunci"
                    >
                      <Lock size={14} />
                      <span>Terkunci</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleEditClick(lap)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary-hover active:scale-[0.98] transition shadow-sm"
                    >
                      <FileEdit size={14} />
                      <span>Edit Laporan</span>
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm text-xs">
          <span className="text-slate-500">
            Halaman <strong>{currentPage}</strong> dari <strong>{totalPages}</strong> ({filteredLaporan.length} total)
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="px-2 font-bold text-slate-700">{currentPage}</span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Modal Detail Laporan */}
      {selectedDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Rincian Laporan Penugasan
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                  {selectedDetail.nama_kegiatan}
                </h3>
              </div>
              <button
                onClick={() => setSelectedDetail(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs sm:text-sm text-slate-700">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl">
                <div>
                  <span className="text-slate-400 block text-[11px]">Pegawai Pelapor</span>
                  <span className="font-semibold text-slate-800">{selectedDetail.pegawai_id}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Bidang</span>
                  <span className="font-semibold text-slate-800">{selectedDetail.bidang}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Tanggal Kegiatan</span>
                  <span className="font-semibold text-slate-800">{selectedDetail.tanggal_kegiatan}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Tempat</span>
                  <span className="font-semibold text-slate-800">{selectedDetail.tempat_kegiatan}</span>
                </div>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px] font-medium">Catatan / Notulen Hasil</span>
                <p className="mt-1 p-3 bg-slate-50 rounded-xl text-slate-800 whitespace-pre-wrap leading-relaxed text-xs">
                  {selectedDetail.catatan_hasil || 'Tidak ada catatan hasil.'}
                </p>
              </div>

              {selectedDetail.catatan_pimpinan && (
                <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs">
                  <span className="text-amber-800 font-bold block mb-1">Arahan Pimpinan</span>
                  <p className="text-amber-900 italic">{selectedDetail.catatan_pimpinan}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setSelectedDetail(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-200 transition"
              >
                Tutup
              </button>
              {!isLaporanLocked(selectedDetail) && (
                <button
                  onClick={() => {
                    const target = selectedDetail
                    setSelectedDetail(null)
                    handleEditClick(target)
                  }}
                  className="px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-xl hover:bg-primary-hover transition"
                >
                  Lanjut ke Edit Form
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
