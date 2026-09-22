'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { UserCheck, Lock, Save, Calendar, Check, CheckCircle2, Loader2, Inbox, FileSpreadsheet, FileDown, RefreshCw } from 'lucide-react'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import Swal from 'sweetalert2'
import { logoutPimpinan, updateEvaluasiPimpinan, refreshData } from '@/lib/actions'
import type { Laporan, Pegawai } from '@/lib/types'
import { EmptyState } from '@/components/ui/empty-state'
import { DESIGN_TOKENS } from '@/lib/design-tokens'
import { formatUserFriendlyError, logSystemError, generateErrorCode } from '@/lib/error-handler'

import { getDriveDirectImageUrl } from '@/lib/print-utils'

interface PimpinanClientProps {
  initialLaporan: Laporan[]
  pegawaiList: Pegawai[]
  session: { role: string; scopes: string[] }
}

interface LaporanWithEdit extends Laporan {
  _status: string
  _catatan_baru: string
}

function cleanTextHelper(str: string) {
  if (!str) return ''
  return str.toString().toLowerCase().replace(/\s+/g, ' ').trim()
}

export function PimpinanClient({ initialLaporan, pegawaiList, session }: PimpinanClientProps) {
  const router = useRouter()
  const [activeRole] = useState(session.role)
  const [activeScopes] = useState(session.scopes)
  const [laporanList, setLaporanList] = useState<LaporanWithEdit[]>([])
  const [isExporting, setIsExporting] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleSync = async () => {
    setIsRefreshing(true)
    try {
      await refreshData('all')
      router.refresh()
      Swal.fire({
        icon: 'success',
        title: 'Tersinkronisasi',
        text: 'Data laporan terbaru berhasil disinkronkan dari server.',
        timer: 1500,
        showConfirmButton: false,
      })
    } catch (error: any) {
      Swal.fire({
        icon: 'error',
        title: 'Gagal Sinkronisasi',
        text: error?.message || 'Terjadi kesalahan saat menyinkronkan data.',
      })
    } finally {
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    if (initialLaporan) {
      const filtered = initialLaporan.filter((lap) => {
        const lapBidangUpper = (lap.bidang || '').toUpperCase()
        if (!activeScopes.includes('ALL')) {
          if (!activeScopes.includes(lapBidangUpper)) return false
        }
        if (lapBidangUpper === 'KEPALA DINAS') return false

        const pegawaiJabatanUpper = (lap.jabatan || '').toUpperCase()
        if (activeRole.includes('Kasubag')) {
          if (pegawaiJabatanUpper !== 'STAFF') return false
        }

        const catatan = cleanTextHelper(lap.catatan_pimpinan || '')
        const hasEvaluated = catatan.includes(`[${activeRole.toLowerCase()}]`)
        return !hasEvaluated
      })

      setLaporanList(
        filtered.map((lap) => ({
          ...lap,
          _status: lap.status_tindak_lanjut || 'Untuk Diketahui',
          _catatan_baru: '',
        }))
      )
    }
  }, [initialLaporan, activeRole, activeScopes])

  const handleLogout = async () => {
    await logoutPimpinan()
    router.push('/pimpinan/login')
  }

  const handleSelectChange = (laporanId: string, value: string) => {
    setLaporanList((prev) =>
      prev.map((lap) => (lap.id === laporanId ? { ...lap, _status: value } : lap))
    )
  }

  const handleTextChange = (laporanId: string, value: string) => {
    setLaporanList((prev) =>
      prev.map((lap) => (lap.id === laporanId ? { ...lap, _catatan_baru: value } : lap))
    )
  }

  const simpanCatatan = async (laporanId: string) => {
    const lap = laporanList.find((l) => l.id === laporanId)
    if (!lap) return

    if (!lap._catatan_baru.trim()) {
      Swal.fire({ icon: 'warning', title: 'Catatan Kosong', text: 'Mohon isi catatan evaluasi Anda!' })
      return
    }

    const { isConfirmed } = await Swal.fire({
      title: 'Simpan Evaluasi?',
      text: 'Laporan ini akan dianggap telah Anda evaluasi.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: DESIGN_TOKENS.sweetAlert.secondaryConfirmButtonColor,
      cancelButtonColor: DESIGN_TOKENS.sweetAlert.cancelButtonColor,
      confirmButtonText: 'Ya, Simpan!',
      cancelButtonText: 'Batal',
    })

    if (!isConfirmed) return

    // Optimistic removal: kartu langsung dihilangkan seketika dari UI
    const previousList = [...laporanList]
    setLaporanList((prev) => prev.filter((l) => l.id !== laporanId))

    // Tampilkan notifikasi instan non-blocking
    Swal.fire({
      title: 'Menyimpan Evaluasi...',
      text: 'Sinkronisasi spreadsheet berjalan di latar belakang.',
      icon: 'info',
      timer: 1500,
      showConfirmButton: false,
      toast: true,
      position: 'top-end',
    })

    try {
      const res = await updateEvaluasiPimpinan(laporanId, lap._status, lap._catatan_baru, activeRole)

      if (res.status === 'success') {
        Swal.fire({
          title: 'Tersimpan!',
          text: 'Evaluasi telah berhasil dicatat.',
          icon: 'success',
          timer: 1500,
          showConfirmButton: false,
          toast: true,
          position: 'top-end',
        })
        router.refresh()
      } else {
        // Rollback jika server action gagal
        setLaporanList(previousList)
        const errorCode = (res as any).errorCode || generateErrorCode()
        logSystemError(errorCode, res.message, 'pimpinan-client.saveEvaluasi')
        Swal.fire({
          title: 'Gagal Menyimpan',
          html: `<p class="mb-2 text-slate-700">${res.message || 'Terjadi kesalahan saat menyimpan evaluasi.'}</p><p class="text-xs text-slate-500 font-mono">Kode Referensi: <span class="font-bold text-slate-700">${errorCode}</span></p>`,
          icon: 'error',
          confirmButtonColor: DESIGN_TOKENS.sweetAlert.confirmButtonColor,
        })
      }
    } catch (err: any) {
      // Rollback jika error jaringan
      setLaporanList(previousList)
      const friendly = formatUserFriendlyError(err, 'Terjadi kesalahan koneksi ke server.')
      logSystemError(friendly.errorCode, err, 'pimpinan-client.saveEvaluasi')
      Swal.fire({
        title: 'Gagal Menyimpan',
        html: `<p class="mb-2 text-slate-700">${friendly.userMessage}</p><p class="text-xs text-slate-500 font-mono">Kode Referensi: <span class="font-bold text-slate-700">${friendly.errorCode}</span></p>`,
        icon: 'error',
        confirmButtonColor: DESIGN_TOKENS.sweetAlert.confirmButtonColor,
      })
    }
  }

  const exportRecap = async (format: 'xlsx' | 'pdf') => {
    if (!initialLaporan || initialLaporan.length === 0) return

    setIsExporting(true)
    Swal.fire({ title: 'Menyiapkan Data...', allowOutsideClick: false, didOpen: () => Swal.showLoading() })

    try {
      const dataForRecap = initialLaporan.filter((lap) => {
        const lapBidangUpper = (lap.bidang || '').toUpperCase()
        if (!activeScopes.includes('ALL') && !activeScopes.includes(lapBidangUpper)) return false
        if (lapBidangUpper === 'KEPALA DINAS') return false
        if (activeRole.includes('Kasubag') && (lap.jabatan || '').toUpperCase() !== 'STAFF') return false
        return true
      })

      if (dataForRecap.length === 0) {
        Swal.fire('Info', 'Tidak ada data untuk diekspor.', 'info')
        setIsExporting(false)
        return
      }

      const mappedData = dataForRecap.map((lap, index) => ({
        No: index + 1,
        Tanggal: lap.tanggal_kegiatan ? new Date(lap.tanggal_kegiatan).toLocaleDateString('id-ID') : '-',
        'Nama Pegawai': lap.pegawai?.nama || '-',
        Bidang: lap.bidang || '-',
        'Nama Kegiatan': lap.nama_kegiatan || '-',
        'Hasil Kegiatan': lap.catatan_hasil || '-',
        Status: lap.status_tindak_lanjut || '-',
        'Catatan Pimpinan': lap.catatan_pimpinan || '-',
      }))

      await new Promise((resolve) => setTimeout(resolve, 500))

      if (format === 'xlsx') {
        const ws = XLSX.utils.json_to_sheet(mappedData)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Rekap Laporan')
        XLSX.writeFile(wb, `Rekap_${activeRole.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`)
      } else {
        const doc = new jsPDF('l', 'mm', 'a4')
        doc.setFontSize(16)
        doc.text(`Rekap Laporan — ${activeRole}`, 14, 15)
        doc.setFontSize(10)
        doc.text(`Dicetak: ${new Date().toLocaleString('id-ID')}`, 14, 22)

        autoTable(doc, {
          head: [Object.keys(mappedData[0])],
          body: mappedData.map((item) => Object.values(item)),
          startY: 28,
          theme: 'grid',
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [27, 60, 115], textColor: 255 },
        })
        doc.save(`Rekap_${activeRole.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`)
      }

      Swal.close()
      Swal.fire({ icon: 'success', title: 'Berhasil!', text: `File ${format.toUpperCase()} telah diunduh.`, timer: 2000, showConfirmButton: false })
    } catch (error: any) {
      const friendly = formatUserFriendlyError(error, 'Gagal memproses ekspor berkas rekap.')
      logSystemError(friendly.errorCode, error, 'pimpinan-client.exportRecap')
      Swal.fire({
        title: 'Gagal Ekspor',
        html: `<p class="mb-2 text-slate-700">${friendly.userMessage}</p><p class="text-xs text-slate-500 font-mono">Kode Referensi: <span class="font-bold text-slate-700">${friendly.errorCode}</span></p>`,
        icon: 'error',
        confirmButtonColor: DESIGN_TOKENS.sweetAlert.confirmButtonColor,
      })
    } finally {
      setIsExporting(false)
    }
  }

  // ==================== EVALUATION PANEL ====================
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8 border-t-4 border-t-secondary max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 border-b border-slate-100 pb-4 gap-4">
        <div className="flex items-center">
          <div className="bg-slate-900 p-2 rounded-xl mr-3 shadow-md">
            <UserCheck className="text-secondary" size={28} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Panel Evaluasi Pimpinan</h2>
            <p className="text-sm text-slate-500">Jabatan: <span className="text-secondary font-bold">{activeRole}</span></p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
          <button
            onClick={handleSync}
            disabled={isRefreshing || isExporting}
            title="Sinkronkan data terbaru dari spreadsheet"
            className="flex items-center gap-1.5 px-3 py-2 bg-sky-50 text-sky-700 border border-sky-200 rounded-lg text-xs font-bold hover:bg-sky-100 transition-all duration-150 cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            <span>{isRefreshing ? 'Sinkronisasi...' : 'Sinkronkan'}</span>
          </button>
          <button
            onClick={() => exportRecap('xlsx')}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold hover:bg-emerald-100 transition-all duration-150 cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExporting ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />} XLSX
          </button>
          <button
            onClick={() => exportRecap('pdf')}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold hover:bg-rose-100 transition-all duration-150 cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExporting ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />} PDF
          </button>
          <div className="hidden md:block w-px h-6 bg-slate-200 mx-1" />
          <button
            onClick={handleLogout}
            className="text-xs text-slate-400 hover:text-destructive font-bold flex items-center gap-1 transition-all duration-150 cursor-pointer active:scale-95 px-2 py-2"
          >
            <Lock size={12} /> Keluar
          </button>
        </div>
      </div>

      {laporanList.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Semua Laporan Selesai Dievaluasi!"
          description="Tidak ada laporan penugasan yang perlu dievaluasi untuk saat ini. Seluruh kegiatan telah ditindaklanjuti."
          className="bg-emerald-50/50 border-emerald-200 py-12 text-emerald-900"
        />
      ) : (
        <div className="space-y-6">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center gap-3">
            <div className="bg-slate-900 text-white p-1.5 rounded-lg">
              <Inbox size={18} />
            </div>
            <span className="font-bold text-slate-900">Terdapat {laporanList.length} laporan menanti evaluasi Anda.</span>
          </div>

          {laporanList.map((lap) => {
            const tanggal = lap.tanggal_kegiatan ? new Date(lap.tanggal_kegiatan).toLocaleDateString('id-ID', {
              day: 'numeric',
              month: 'long',
              year: 'numeric'
            }) : '-'
            return (
              <div key={lap.id} className="bg-white border-2 border-slate-100 rounded-2xl overflow-hidden hover:border-secondary/40 transition-all shadow-sm">
                <div className="bg-slate-50/50 px-6 py-4 border-b border-slate-100 flex flex-col md:flex-row justify-between md:items-center gap-2">
                  <div>
                    <h3 className="font-bold text-slate-900 text-lg leading-tight">{lap.nama_kegiatan || '-'}</h3>
                    <div className="text-sm text-slate-500 mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="flex items-center font-bold text-slate-700">
                        <UserCheck size={14} className="mr-1 text-secondary" /> {lap.pegawai?.nama || '-'}
                      </span>
                      <span className="text-slate-300">|</span>
                      <span className="font-semibold text-slate-700 px-2 py-0.5 bg-slate-100 rounded text-xs">
                        {lap.bidang || '-'}
                      </span>
                      <span className="text-slate-300">|</span>
                      <span className="flex items-center text-xs font-medium">
                        <Calendar size={13} className="mr-1 opacity-60" /> {tanggal}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-5">
                  <div className="bg-sky-50/30 p-5 rounded-2xl border border-sky-100/50">
                    <h4 className="font-bold text-slate-900 text-sm mb-2 flex items-center">
                      <div className="w-1.5 h-4 bg-primary rounded-full mr-2" />
                      Hasil Kegiatan:
                    </h4>
                    <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">{lap.catatan_hasil || '-'}</p>
                  </div>

                  {lap.catatan_pimpinan && (
                    <div className="bg-amber-50/30 p-5 rounded-2xl border border-amber-100/50">
                      <h4 className="font-bold text-amber-800 text-sm mb-2 flex items-center">
                        <div className="w-1.5 h-4 bg-secondary rounded-full mr-2" />
                        Riwayat Evaluasi:
                      </h4>
                      <div className="text-slate-700 text-sm whitespace-pre-wrap font-mono bg-white/80 p-4 border border-amber-100 rounded-xl">
                        {lap.catatan_pimpinan}
                      </div>
                    </div>
                  )}

                  {/* Dokumentasi & Materi Display */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-5 bg-slate-50/50 rounded-2xl border border-slate-100">
                    <div>
                      <h4 className="font-bold text-slate-500 text-[10px] uppercase tracking-widest mb-3">DOKUMENTASI KEGIATAN</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {lap.dokumentasi_urls && lap.dokumentasi_urls.length > 0 ? (
                          lap.dokumentasi_urls.map((url, i) => {
                            const imageSrc = getDriveDirectImageUrl(url, 600)
                            if (imageSrc) {
                              return (
                                <a key={i} href={url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-slate-200 hover:shadow-lg transition group relative bg-white aspect-video">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={imageSrc}
                                    className="w-full h-full object-cover group-hover:scale-110 transition duration-500"
                                    alt={`Dokumentasi ${i + 1}`}
                                    onError={(e) => {
                                      // Jika thumbnail gagal, ganti src ke icon placeholder agar tidak merusak layout
                                      const img = e.target as HTMLImageElement
                                      img.style.display = 'none'
                                      const parent = img.parentElement
                                      if (parent) {
                                        const fallback = document.createElement('div')
                                        fallback.className = 'absolute inset-0 flex flex-col items-center justify-center bg-slate-50 text-slate-400 text-[10px]'
                                        fallback.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mb-1"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Buka Manual'
                                        parent.appendChild(fallback)
                                      }
                                    }}
                                  />
                                  <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <span className="text-primary-foreground text-[10px] font-bold bg-primary px-3 py-1.5 rounded-full shadow-lg">BUKA FOTO</span>
                                  </div>
                                </a>
                              )
                            }
                            return (
                              <a key={i} href={url} target="_blank" rel="noreferrer" className="flex items-center justify-center p-3 bg-sky-50 text-sky-600 border border-sky-100 rounded-xl text-xs font-bold hover:bg-sky-100 transition shadow-sm aspect-video">
                                <FileDown size={16} className="mr-1.5" /> Lihat Dokumen
                              </a>
                            )
                          })
                        ) : (
                          <div className="col-span-2 py-8 text-center bg-white rounded-xl border border-dashed border-slate-200">
                            <span className="text-slate-400 text-xs font-medium italic">Tidak ada foto dokumentasi</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-500 text-[10px] uppercase tracking-widest mb-3">MATERI PENDUKUNG</h4>
                      <div className="flex flex-col gap-2">
                        {lap.materi_urls && lap.materi_urls.length > 0 ? (
                          lap.materi_urls.map((url, i) => (
                            <a key={i} href={url} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 p-3 bg-rose-50 text-rose-600 border border-rose-100 rounded-xl text-xs font-bold hover:bg-rose-100 transition shadow-sm">
                              <FileDown size={16} /> Buka Materi {lap.materi_urls!.length > 1 ? i + 1 : ''}
                            </a>
                          ))
                        ) : (
                          <div className="py-8 text-center bg-white rounded-xl border border-dashed border-slate-200">
                            <span className="text-slate-400 text-xs font-medium italic">Tidak ada materi terlampir</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                    <div className="md:col-span-1">
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-widest mb-2">Tindak Lanjut:</label>
                      <select
                        value={lap._status}
                        onChange={(e) => handleSelectChange(lap.id, e.target.value)}
                        className="w-full p-3.5 rounded-xl border-2 border-slate-200 bg-slate-50 focus:border-primary focus:bg-white outline-none text-sm font-bold text-slate-900 appearance-none cursor-pointer transition"
                      >
                        <option value="Untuk Diketahui">Untuk Diketahui</option>
                        <option value="Perlu Tindak Lanjut Bidang Teknis">Perlu Tindak Lanjut</option>
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-widest mb-2">Evaluasi Anda:</label>
                      <textarea
                        rows={2}
                        value={lap._catatan_baru}
                        onChange={(e) => handleTextChange(lap.id, e.target.value)}
                        className="w-full p-3.5 rounded-xl border-2 border-slate-200 bg-slate-50 focus:border-primary focus:bg-white outline-none text-sm font-medium text-slate-900 transition-all"
                        placeholder="Ketik catatan pimpinan di sini..."
                      />
                    </div>
                  </div>

                  <div className="pt-4 flex justify-end">
                    <button
                      className="font-bold py-3.5 px-8 rounded-xl transition-all duration-150 shadow-md text-sm flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] bg-secondary hover:bg-secondary-hover text-secondary-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={() => simpanCatatan(lap.id)}
                    >
                      <Save size={18} /> Simpan Evaluasi
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}