'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  FileSignature,
  FileText,
  FileSpreadsheet,
  File as FileIcon,
  Loader2,
  Sparkles,
  Building2,
  Mic,
  MicOff,
  Eye,
  Trash2,
  ImagePlus,
  FileUp,
  ArrowLeft,
  Save,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  Calendar,
  MapPin,
  Users,
} from 'lucide-react'
import Swal from 'sweetalert2'
import { updateLaporan } from '@/lib/actions'
import { DESIGN_TOKENS } from '@/lib/design-tokens'
import {
  formatFileSize,
  validateMateriFileSize,
  validateTotalPayloadSize,
  compressImageFile,
  compressPdfFile,
  isPdfFile,
  PDF_COMPRESS_THRESHOLD_BYTES,
  MAX_MATERI_FILE_SIZE_BYTES,
  fileToBase64,
} from '@/lib/file-guard'
import { PhotoThumbnail, MaterialItem } from '@/components/ui/file-items'
import { useSpeechToText } from '@/lib/use-speech-to-text'
import { formatSpeechText, mergeTranscript } from '@/lib/speech-formatter'
import { AiCompareModal } from '@/components/ui/ai-compare-modal'
import { FilePreviewModal } from '@/components/ui/file-preview-modal'
import { getDriveDirectImageUrl } from '@/lib/print-utils'
import { formatUserFriendlyError, logSystemError, generateErrorCode } from '@/lib/error-handler'
import type { Laporan, Pegawai } from '@/lib/types'

interface EditLaporanClientProps {
  laporan: Laporan
  pegawaiList: Pegawai[]
  initialNip?: string
}

function formatDateForInput(dateStr: string): string {
  if (!dateStr) return ''
  const trimmed = dateStr.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  if (trimmed.includes('/')) {
    const parts = trimmed.split('/')
    if (parts.length === 3) {
      const [day, month, year] = parts
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
    }
  }
  return trimmed
}

export function EditLaporanClient({
  laporan,
  pegawaiList,
  initialNip = '',
}: EditLaporanClientProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isOptimizingFile, setIsOptimizingFile] = useState(false)

  // Form Fields State prefilled from laporan
  const [selectedBidang, setSelectedBidang] = useState(laporan.bidang || '')
  const [selectedPegawai, setSelectedPegawai] = useState(laporan.pegawai_id || '')
  const [nipPelapor, setNipPelapor] = useState(initialNip)
  const [jenisPenugasan, setJenisPenugasan] = useState(laporan.jenis_penugasan || '')
  const [tanggalKegiatan, setTanggalKegiatan] = useState(
    formatDateForInput(laporan.tanggal_kegiatan)
  )
  const [namaKegiatan, setNamaKegiatan] = useState(laporan.nama_kegiatan || '')
  const [tempatKegiatan, setTempatKegiatan] = useState(laporan.tempat_kegiatan || '')
  const [penyelenggara, setPenyelenggara] = useState(laporan.penyelenggara || '')
  const [tamuUndangan, setTamuUndangan] = useState(laporan.tamu_undangan || '')
  const [catatanText, setCatatanText] = useState(laporan.catatan_hasil || '')

  // Existing drive files state
  const [existingDocs, setExistingDocs] = useState<string[]>(
    laporan.dokumentasi_urls ? [...laporan.dokumentasi_urls] : []
  )
  const [existingMateri, setExistingMateri] = useState<string[]>(
    laporan.materi_urls ? [...laporan.materi_urls] : []
  )

  // New uploaded files state
  const [newDocFiles, setNewDocFiles] = useState<File[]>([])
  const [newMatFiles, setNewMatFiles] = useState<File[]>([])

  // Modal & Preview state
  const [isEnhancing, setIsEnhancing] = useState(false)
  const [filePreview, setFilePreview] = useState<{
    isOpen: boolean
    fileUrl: string | null
    fileName: string
    fileType: 'image' | 'pdf'
  }>({
    isOpen: false,
    fileUrl: null,
    fileName: '',
    fileType: 'image',
  })
  const [compareModal, setCompareModal] = useState<{
    isOpen: boolean
    originalText: string
    enhancedText: string
    provider: 'gemini' | 'openrouter'
  }>({
    isOpen: false,
    originalText: '',
    enhancedText: '',
    provider: 'gemini',
  })

  const fileDokInputRef = useRef<HTMLInputElement>(null)
  const fileMatInputRef = useRef<HTMLInputElement>(null)

  // Bidang & Pegawai Options
  const bidangOptions = useMemo(() => {
    const list = new Set<string>()
    if (laporan.bidang) list.add(laporan.bidang)
    pegawaiList.forEach((p) => {
      if (p.bidang) list.add(p.bidang)
    })
    return Array.from(list)
  }, [pegawaiList, laporan.bidang])

  const filteredPegawai = useMemo(() => {
    return pegawaiList.filter((p) => !selectedBidang || p.bidang === selectedBidang)
  }, [pegawaiList, selectedBidang])

  // Auto-fill NIP if matching pegawai selected and nipPelapor empty
  useEffect(() => {
    if (!nipPelapor) {
      const match = pegawaiList.find(
        (p) => p.nama === selectedPegawai || p.id === selectedPegawai
      )
      if (match?.nip) {
        setNipPelapor(match.nip)
      }
    }
  }, [selectedPegawai, pegawaiList, nipPelapor])

  // New file handlers
  const handleAddNewDocFiles = async (files: File[]) => {
    const images = files.filter((f) => f && f.type.startsWith('image/'))
    if (images.length === 0) return
    setIsOptimizingFile(true)
    try {
      const compressed = await Promise.all(
        images.map((file) => compressImageFile(file))
      )
      setNewDocFiles((prev) => [...prev, ...compressed])
    } finally {
      setIsOptimizingFile(false)
    }
  }

  const handleAddNewMateriFiles = async (files: File[]) => {
    if (!files || files.length === 0) return
    setIsOptimizingFile(true)
    try {
      const validFiles: File[] = []
      for (const file of files) {
        if (isPdfFile(file.name, file.type)) {
          if (file.size > PDF_COMPRESS_THRESHOLD_BYTES) {
            const compressRes = await compressPdfFile(file)
            if (compressRes.file.size > MAX_MATERI_FILE_SIZE_BYTES) {
              Swal.fire({
                icon: 'warning',
                title: 'Ukuran PDF Terlalu Besar',
                text: `Berkas "${file.name}" berukuran ${formatFileSize(file.size)}. Batas maksimal adalah ${formatFileSize(MAX_MATERI_FILE_SIZE_BYTES)} per dokumen.`,
                confirmButtonColor: DESIGN_TOKENS.sweetAlert.confirmButtonColor,
              })
              continue
            }
            validFiles.push(compressRes.file)
          } else {
            validFiles.push(file)
          }
        } else {
          const check = validateMateriFileSize(file)
          if (!check.valid) {
            Swal.fire({
              icon: 'warning',
              title: 'Ukuran Berkas Terlalu Besar',
              text: check.message,
              confirmButtonColor: DESIGN_TOKENS.sweetAlert.confirmButtonColor,
            })
            continue
          }
          validFiles.push(file)
        }
      }
      if (validFiles.length > 0) {
        setNewMatFiles((prev) => [...prev, ...validFiles])
      }
    } finally {
      setIsOptimizingFile(false)
    }
  }

  const removeExistingDoc = (index: number) => {
    setExistingDocs((prev) => prev.filter((_, i) => i !== index))
  }

  const removeExistingMateri = (index: number) => {
    setExistingMateri((prev) => prev.filter((_, i) => i !== index))
  }

  const removeNewDocFile = (index: number) => {
    setNewDocFiles((prev) => {
      const updated = prev.filter((_, i) => i !== index)
      if (updated.length === 0 && fileDokInputRef.current) {
        fileDokInputRef.current.value = ''
      }
      return updated
    })
  }

  const removeNewMatFile = (index: number) => {
    setNewMatFiles((prev) => {
      const updated = prev.filter((_, i) => i !== index)
      if (updated.length === 0 && fileMatInputRef.current) {
        fileMatInputRef.current.value = ''
      }
      return updated
    })
  }

  // Speech-to-Text
  const { isListening, toggleListening } = useSpeechToText({
    lang: 'id-ID',
    onTranscript: (chunk, isFinal) => {
      if (isFinal) {
        const formatted = formatSpeechText(chunk)
        setCatatanText((prev) => mergeTranscript(prev, formatted))
      }
    },
    onError: (err) => {
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'error',
        title: `Mikrofon: ${err}`,
        showConfirmButton: false,
        timer: 3000,
      })
    },
  })

  // AI text enhancer
  const enhanceTextWithAI = async () => {
    if (!catatanText.trim()) {
      Swal.fire({
        icon: 'info',
        title: 'Catatan Masih Kosong',
        text: 'Silakan ketik atau gunakan Dikte Suara pada catatan kegiatan terlebih dahulu sebelum memoles dengan AI.',
        confirmButtonColor: DESIGN_TOKENS.sweetAlert.confirmButtonColor,
      })
      return
    }
    setIsEnhancing(true)

    try {
      const res = await fetch('/api/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: catatanText }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      setCompareModal({
        isOpen: true,
        originalText: catatanText,
        enhancedText: data.enhanced,
        provider: data.provider || 'gemini',
      })
    } catch (error: unknown) {
      const friendly = formatUserFriendlyError(error, 'Terjadi kendala saat memproses polesan AI.')
      logSystemError(friendly.errorCode, error, 'edit-laporan.enhanceTextWithAI')
      Swal.fire({
        icon: 'error',
        title: 'AI Gagal Memproses',
        html: `<p class="mb-2 text-slate-700">${friendly.userMessage}</p><p class="text-xs text-slate-500 font-mono">Kode Referensi: <span class="font-bold text-slate-700">${friendly.errorCode}</span></p>`,
        confirmButtonColor: DESIGN_TOKENS.sweetAlert.confirmButtonColor,
      })
    } finally {
      setIsEnhancing(false)
    }
  }

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!nipPelapor.trim()) {
      Swal.fire({
        title: 'NIP Diperlukan',
        text: 'Harap masukkan NIP pegawai pelapor untuk verifikasi identitas.',
        icon: 'warning',
        confirmButtonColor: DESIGN_TOKENS.sweetAlert.confirmButtonColor,
      })
      return
    }

    setIsSubmitting(true)

    const payloadValidation = validateTotalPayloadSize(newDocFiles, newMatFiles)
    if (!payloadValidation.valid) {
      Swal.fire({
        title: 'Total Lampiran Terlalu Besar',
        text: payloadValidation.message,
        icon: 'warning',
        confirmButtonColor: DESIGN_TOKENS.sweetAlert.confirmButtonColor,
      })
      setIsSubmitting(false)
      return
    }

    try {
      const base64Docs = await Promise.all(
        newDocFiles.map(async (file) => ({
          base64: await fileToBase64(file),
          name: file.name,
          mime: file.type || 'image/jpeg',
        }))
      )

      const base64Mats = await Promise.all(
        newMatFiles.map(async (file) => ({
          base64: await fileToBase64(file),
          name: file.name,
          mime: file.type || 'application/octet-stream',
        }))
      )

      const matchedPegawai = pegawaiList.find(
        (p) => p.nama === selectedPegawai || p.id === selectedPegawai
      )

      const rowIndex = parseInt(laporan.id)

      const updatePayload = {
        rowIndex,
        nip: nipPelapor.trim(),
        pegawai_id: matchedPegawai?.nama || selectedPegawai,
        bidang: selectedBidang,
        jabatan: matchedPegawai?.jabatan || laporan.jabatan || '',
        jenis_penugasan: jenisPenugasan,
        tanggal_kegiatan: tanggalKegiatan,
        nama_kegiatan: namaKegiatan,
        tempat_kegiatan: tempatKegiatan,
        penyelenggara,
        tamu_undangan: tamuUndangan,
        catatan_hasil: catatanText,
        existing_dok_urls: existingDocs,
        existing_materi_urls: existingMateri,
      }

      const res = await updateLaporan(updatePayload, base64Docs, base64Mats)

      if (res?.status === 'success') {
        await Swal.fire({
          title: 'Berhasil Diperbarui!',
          text: 'Perubahan data laporan penugasan berhasil disimpan ke sistem.',
          icon: 'success',
          confirmButtonColor: DESIGN_TOKENS.sweetAlert.confirmButtonColor,
        })
        router.push('/laporan')
        router.refresh()
      } else {
        const errCode = (res as { errorCode?: string })?.errorCode || generateErrorCode()
        logSystemError(errCode, res?.message, 'edit-laporan.handleSubmit')
        Swal.fire({
          title: 'Gagal Menyimpan Perubahan',
          html: `<p class="mb-2 text-slate-700">${res?.message || 'Gagal memperbarui data laporan.'}</p><p class="text-xs text-slate-500 font-mono">Kode Referensi: <span class="font-bold text-slate-700">${errCode}</span></p>`,
          icon: 'error',
          confirmButtonColor: DESIGN_TOKENS.sweetAlert.confirmButtonColor,
        })
      }
    } catch (error: unknown) {
      const friendly = formatUserFriendlyError(error, 'Terjadi kendala saat menyimpan perubahan laporan.')
      logSystemError(friendly.errorCode, error, 'edit-laporan.handleSubmit')
      Swal.fire({
        title: 'Kesalahan Sistem',
        html: `<p class="mb-2 text-slate-700">${friendly.userMessage}</p><p class="text-xs text-slate-500 font-mono">Kode Referensi: <span class="font-bold text-slate-700">${friendly.errorCode}</span></p>`,
        icon: 'error',
        confirmButtonColor: DESIGN_TOKENS.sweetAlert.confirmButtonColor,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/laporan"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-primary transition"
            >
              <ArrowLeft size={14} />
              Kembali ke Daftar Laporan
            </Link>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <FileSignature className="text-primary" size={24} />
            Edit Formulir Laporan Penugasan
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Perbarui data hasil penugasan kegiatan ASN. Nomor Baris #{laporan.id}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 size={13} />
            Status: Dapat Diedit
          </span>
        </div>
      </div>

      {/* Security & Verification Notice */}
      <div className="p-4 rounded-xl bg-sky-50/70 border border-sky-200 text-sky-900 flex items-start gap-3 text-xs sm:text-sm">
        <ShieldCheck size={20} className="text-sky-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold">Verifikasi Kepemilikan & Integritas Data Kedinasan</p>
          <p className="text-sky-800 text-xs leading-relaxed">
            Perubahan ini akan memperbarui catatan laporan di Google Spreadsheet. Catatan evaluasi atau disposisi pimpinan tetap terjaga secara utuh.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* SECTION 1: Identitas Pegawai & Verifikasi NIP */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-sm sm:text-base font-bold text-slate-800 flex items-center gap-2">
              <Building2 size={18} className="text-primary" />
              1. Identitas Pegawai & Verifikasi
            </h2>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Wajib Valid
            </span>
          </div>

          <div className="p-5 sm:p-6 grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Bidang */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Bidang <span className="text-rose-600">*</span>
              </label>
              <select
                value={selectedBidang}
                onChange={(e) => {
                  setSelectedBidang(e.target.value)
                  setSelectedPegawai('')
                }}
                required
                className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
              >
                <option value="">-- Pilih Bidang --</option>
                {bidangOptions.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            {/* Nama Pegawai */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Nama Pegawai Pelapor <span className="text-rose-600">*</span>
              </label>
              <select
                value={selectedPegawai}
                onChange={(e) => setSelectedPegawai(e.target.value)}
                required
                className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
              >
                <option value="">-- Pilih Pegawai --</option>
                {filteredPegawai.length > 0 ? (
                  filteredPegawai.map((p) => (
                    <option key={p.id} value={p.nama}>
                      {p.nama} {p.jabatan ? `— ${p.jabatan}` : ''}
                    </option>
                  ))
                ) : (
                  <option value={laporan.pegawai_id}>{laporan.pegawai_id}</option>
                )}
              </select>
            </div>

            {/* NIP Verifikasi */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                NIP Pegawai Pelapor <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                value={nipPelapor}
                onChange={(e) => setNipPelapor(e.target.value)}
                placeholder="NIP pelapor (misal: 198501...)"
                required
                className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-xs sm:text-sm text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Wajib sama dengan NIP master pegawai untuk otorisasi edit.
              </p>
            </div>
          </div>
        </div>

        {/* SECTION 2: Detail Penugasan & Kegiatan */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-sm sm:text-base font-bold text-slate-800 flex items-center gap-2">
              <Calendar size={18} className="text-primary" />
              2. Informasi & Rincian Penugasan
            </h2>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Data Kegiatan
            </span>
          </div>

          <div className="p-5 sm:p-6 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Jenis Penugasan */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Jenis Penugasan <span className="text-rose-600">*</span>
                </label>
                <select
                  value={jenisPenugasan}
                  onChange={(e) => setJenisPenugasan(e.target.value)}
                  required
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
                >
                  <option value="">-- Pilih Jenis Penugasan --</option>
                  <option value="Rapat Koordinasi">Rapat Koordinasi</option>
                  <option value="Sosialisasi / Bimbingan Teknis">Sosialisasi / Bimbingan Teknis</option>
                  <option value="Monitoring / Verifikasi Lapangan">Monitoring / Verifikasi Lapangan</option>
                  <option value="Kunjungan Kerja / Studi Banding">Kunjungan Kerja / Studi Banding</option>
                  <option value="Pemeriksaan / Sidak">Pemeriksaan / Sidak</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </div>

              {/* Tanggal Kegiatan */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Tanggal Kegiatan <span className="text-rose-600">*</span>
                </label>
                <input
                  type="date"
                  value={tanggalKegiatan}
                  onChange={(e) => setTanggalKegiatan(e.target.value)}
                  required
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
                />
              </div>
            </div>

            {/* Nama Kegiatan */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Nama Kegiatan <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                value={namaKegiatan}
                onChange={(e) => setNamaKegiatan(e.target.value)}
                placeholder="Contoh: Rapat Koordinasi Evaluasi Penempatan Tenaga Kerja..."
                required
                className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Tempat Kegiatan */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Tempat Kegiatan <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <MapPin size={15} className="absolute left-3 top-3 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={tempatKegiatan}
                    onChange={(e) => setTempatKegiatan(e.target.value)}
                    placeholder="Contoh: Hotel Solo Paragon / Ruang Rapat Lt. 2..."
                    required
                    className="w-full h-10 pl-9 pr-3 rounded-lg border border-slate-300 bg-white text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
                  />
                </div>
              </div>

              {/* Penyelenggara */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Penyelenggara <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <Building2 size={15} className="absolute left-3 top-3 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={penyelenggara}
                    onChange={(e) => setPenyelenggara(e.target.value)}
                    placeholder="Contoh: Disnakertrans Prov. Jateng / Kementerian..."
                    required
                    className="w-full h-10 pl-9 pr-3 rounded-lg border border-slate-300 bg-white text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
                  />
                </div>
              </div>
            </div>

            {/* Tamu Undangan */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Tamu Undangan yang Hadir
              </label>
              <div className="relative">
                <Users size={15} className="absolute left-3 top-3 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={tamuUndangan}
                  onChange={(e) => setTamuUndangan(e.target.value)}
                  placeholder="Contoh: Bappeda, Dinas Sosial, Perwakilan Asosiasi Pengusaha..."
                  className="w-full h-10 pl-9 pr-3 rounded-lg border border-slate-300 bg-white text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
                />
              </div>
            </div>

            {/* Catatan Hasil Kegiatan */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Catatan Hasil Kegiatan
                </label>
                <div className="flex items-center gap-1.5">
                  {/* Voice dictation */}
                  <button
                    type="button"
                    onClick={toggleListening}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                      isListening
                        ? 'bg-rose-500 text-white animate-pulse'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                    title="Dikte Suara"
                  >
                    {isListening ? <MicOff size={13} /> : <Mic size={13} />}
                    <span>{isListening ? 'Mendengarkan...' : 'Dikte Suara'}</span>
                  </button>

                  {/* AI enhance */}
                  <button
                    type="button"
                    onClick={enhanceTextWithAI}
                    disabled={isEnhancing}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-accent text-accent-foreground hover:bg-violet-100 transition cursor-pointer disabled:opacity-50"
                  >
                    {isEnhancing ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Sparkles size={13} />
                    )}
                    <span>Poles Catatan (AI)</span>
                  </button>
                </div>
              </div>

              <textarea
                rows={6}
                value={catatanText}
                onChange={(e) => setCatatanText(e.target.value)}
                placeholder="Rincian ringkas hasil kegiatan, poin kesepakatan, tindak lanjut yang diperlukan..."
                className="w-full p-3 rounded-lg border border-slate-300 bg-white text-xs sm:text-sm text-slate-800 min-h-[140px] focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition leading-relaxed"
              />
            </div>
          </div>
        </div>

        {/* SECTION 3: Lampiran & Berkas Kegiatan */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-sm sm:text-base font-bold text-slate-800 flex items-center gap-2">
              <FileUp size={18} className="text-primary" />
              3. Berkas & Lampiran Dokumentasi
            </h2>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Foto & Dokumen
            </span>
          </div>

          <div className="p-5 sm:p-6 space-y-8">
            {/* 3A: FOTO DOKUMENTASI */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <ImagePlus size={16} className="text-primary" />
                  Foto Dokumentasi Kegiatan
                </h3>
                <span className="text-[11px] text-slate-500">Maks. 1200px (otomatis terkompresi)</span>
              </div>

              {/* Existing Drive Photos */}
              <div className="mb-4">
                <p className="text-xs font-semibold text-slate-600 mb-2">
                  Lampiran Foto Tersimpan ({existingDocs.length}):
                </p>
                {existingDocs.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                    {existingDocs.map((url, idx) => {
                      const imageThumb = getDriveDirectImageUrl(url, 300)
                      return (
                        <div
                          key={idx}
                          className="group relative aspect-square rounded-lg overflow-hidden border border-slate-200 bg-slate-100 shadow-2xs flex flex-col items-center justify-center text-center p-1"
                        >
                          {imageThumb ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={imageThumb}
                              alt={`Foto ${idx + 1}`}
                              className="w-full h-full object-cover rounded"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement
                                target.style.display = 'none'
                              }}
                            />
                          ) : (
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex flex-col items-center gap-1 text-slate-600 hover:text-primary transition"
                            >
                              <FileText size={20} className="text-sky-600" />
                              <span className="text-[10px] font-medium truncate max-w-full">
                                Foto #{idx + 1}
                              </span>
                            </a>
                          )}
                          <div className="absolute top-1 right-1 flex items-center gap-1 z-10">
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1 rounded bg-white/90 text-slate-600 hover:text-primary shadow-2xs"
                              title="Buka foto di Google Drive"
                            >
                              <ExternalLink size={12} />
                            </a>
                            <button
                              type="button"
                              onClick={() => removeExistingDoc(idx)}
                              className="p-1 rounded bg-white/90 text-rose-600 hover:text-rose-700 shadow-2xs cursor-pointer"
                              title="Hapus foto ini dari laporan"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">Tidak ada foto dokumentasi tersimpan.</p>
                )}
              </div>

              {/* Upload New Photos Dropzone */}
              <div className="border-2 border-dashed border-slate-300 hover:border-primary/50 rounded-xl p-4 text-center transition bg-slate-50/50">
                <input
                  ref={fileDokInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    if (e.target.files) {
                      handleAddNewDocFiles(Array.from(e.target.files))
                    }
                  }}
                  className="hidden"
                  id="new-foto-upload"
                />
                <label
                  htmlFor="new-foto-upload"
                  className="cursor-pointer flex flex-col items-center gap-1.5"
                >
                  <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                    <ImagePlus size={18} />
                  </div>
                  <span className="text-xs font-semibold text-slate-700">
                    Klik untuk Menambah Foto Baru
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Format JPG / PNG, dapat memilih beberapa foto sekaligus
                  </span>
                </label>
              </div>

              {/* New Photos List */}
              {newDocFiles.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-semibold text-slate-600 mb-2">
                    Foto Baru yang Akan Ditambahkan ({newDocFiles.length}):
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                    {newDocFiles.map((file, idx) => (
                      <PhotoThumbnail
                        key={idx}
                        file={file}
                        onRemove={() => removeNewDocFile(idx)}
                        onPreview={(url) =>
                          setFilePreview({
                            isOpen: true,
                            fileUrl: url,
                            fileName: file.name,
                            fileType: 'image',
                          })
                        }
                        formatSize={formatFileSize}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-slate-200" />

            {/* 3B: MATERI & DOKUMEN PENDUKUNG */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <FileText size={16} className="text-primary" />
                  Berkas Materi & Paparan
                </h3>
                <span className="text-[11px] text-slate-500">Maks. 4.5 MB per dokumen</span>
              </div>

              {/* Existing Drive Materials */}
              <div className="mb-4">
                <p className="text-xs font-semibold text-slate-600 mb-2">
                  Berkas Materi Tersimpan ({existingMateri.length}):
                </p>
                {existingMateri.length > 0 ? (
                  <div className="space-y-2">
                    {existingMateri.map((url, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0 pr-2">
                          <FileText size={16} className="text-rose-600 shrink-0" />
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-800 truncate">
                              Berkas Materi #{idx + 1}
                            </p>
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] text-primary hover:underline flex items-center gap-1"
                            >
                              Buka di Google Drive <ExternalLink size={10} />
                            </a>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeExistingMateri(idx)}
                          className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-slate-200/50 transition cursor-pointer"
                          title="Hapus berkas dari laporan"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">Tidak ada berkas materi tersimpan.</p>
                )}
              </div>

              {/* Upload New Materials Dropzone */}
              <div className="border-2 border-dashed border-slate-300 hover:border-primary/50 rounded-xl p-4 text-center transition bg-slate-50/50">
                <input
                  ref={fileMatInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx"
                  multiple
                  onChange={(e) => {
                    if (e.target.files) {
                      handleAddNewMateriFiles(Array.from(e.target.files))
                    }
                  }}
                  className="hidden"
                  id="new-materi-upload"
                />
                <label
                  htmlFor="new-materi-upload"
                  className="cursor-pointer flex flex-col items-center gap-1.5"
                >
                  <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                    <FileUp size={18} />
                  </div>
                  <span className="text-xs font-semibold text-slate-700">
                    Klik untuk Menambah Dokumen Materi Baru
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Format PDF, Word, atau Excel
                  </span>
                </label>
              </div>

              {/* New Materials List */}
              {newMatFiles.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-semibold text-slate-600">
                    Materi Baru yang Akan Ditambahkan ({newMatFiles.length}):
                  </p>
                  {newMatFiles.map((file, idx) => (
                    <MaterialItem
                      key={idx}
                      file={file}
                      onRemove={() => removeNewMatFile(idx)}
                      onPreview={(url) =>
                        setFilePreview({
                          isOpen: true,
                          fileUrl: url,
                          fileName: file.name,
                          fileType: 'pdf',
                        })
                      }
                      formatSize={formatFileSize}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200">
          <Link
            href="/laporan"
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs sm:text-sm font-semibold transition text-center"
          >
            Batal & Kembali
          </Link>

          <button
            type="submit"
            disabled={isSubmitting || isOptimizingFile}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-primary text-primary-foreground hover:bg-sky-500 font-bold text-xs sm:text-sm shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Menyimpan Perubahan...</span>
              </>
            ) : isOptimizingFile ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Mengoptimalkan Berkas...</span>
              </>
            ) : (
              <>
                <Save size={16} />
                <span>Simpan Perubahan Laporan</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* AI Compare Modal */}
      <AiCompareModal
        isOpen={compareModal.isOpen}
        originalText={compareModal.originalText}
        enhancedText={compareModal.enhancedText}
        provider={compareModal.provider}
        onClose={() => setCompareModal((prev) => ({ ...prev, isOpen: false }))}
        onApply={(text) => {
          setCatatanText(text)
          setCompareModal((prev) => ({ ...prev, isOpen: false }))
        }}
      />

      {/* File Preview Modal */}
      <FilePreviewModal
        isOpen={filePreview.isOpen}
        fileUrl={filePreview.fileUrl}
        fileName={filePreview.fileName}
        fileType={filePreview.fileType}
        onClose={() =>
          setFilePreview({
            isOpen: false,
            fileUrl: null,
            fileName: '',
            fileType: 'image',
          })
        }
      />
    </div>
  )
}
