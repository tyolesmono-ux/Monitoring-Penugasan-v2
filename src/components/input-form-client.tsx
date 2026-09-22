'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import {
  FileSignature,
  Camera,
  FileText,
  FileSpreadsheet,
  File as FileIcon,
  Send,
  Loader2,
  Sparkles,
  Building2,
  CheckCircle2,
  Mic,
  MicOff,
  Eye,
  Trash2,
  ImagePlus,
  FileUp,
  Plus,
} from 'lucide-react'
import Swal from 'sweetalert2'
import { submitLaporan } from '@/lib/actions'
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
import { formatUserFriendlyError, logSystemError, generateErrorCode } from '@/lib/error-handler'
import type { Pegawai } from '@/lib/types'

interface InputFormClientProps {
  pegawaiList: Pegawai[]
}

export function InputFormClient({ pegawaiList }: InputFormClientProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedBidang, setSelectedBidang] = useState('')
  const [catatanText, setCatatanText] = useState('')
  const [isEnhancing, setIsEnhancing] = useState(false)
  const [docFiles, setDocFiles] = useState<File[]>([])
  const [matFiles, setMatFiles] = useState<File[]>([])
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
  const formRef = useRef<HTMLFormElement>(null)
  const fileDokInputRef = useRef<HTMLInputElement>(null)
  const fileMatInputRef = useRef<HTMLInputElement>(null)

  const [isOptimizingFile, setIsOptimizingFile] = useState(false)

  const handleAddDocFiles = async (files: File[]) => {
    const images = files.filter((f) => f && f.type.startsWith('image/'))
    if (images.length === 0) return
    setIsOptimizingFile(true)
    try {
      const compressed = await Promise.all(
        images.map((file) => compressImageFile(file))
      )
      setDocFiles((prev) => [...prev, ...compressed])
    } finally {
      setIsOptimizingFile(false)
    }
  }

  const handleAddMateriFiles = async (files: File[]) => {
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
                text: `Berkas "${file.name}" berukuran ${formatFileSize(file.size)}. Batas maksimal adalah ${formatFileSize(MAX_MATERI_FILE_SIZE_BYTES)} per dokumen agar tidak melampaui batas serverless Vercel (4.5 MB). Silakan kompres berkas PDF terlebih dahulu.`,
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
        setMatFiles((prev) => [...prev, ...validFiles])
      }
    } finally {
      setIsOptimizingFile(false)
    }
  }

  const removeDocFile = (index: number) => {
    setDocFiles((prev) => {
      const updated = prev.filter((_, i) => i !== index)
      if (updated.length === 0 && fileDokInputRef.current) {
        fileDokInputRef.current.value = ''
      }
      return updated
    })
  }

  const removeMatFile = (index: number) => {
    setMatFiles((prev) => {
      const updated = prev.filter((_, i) => i !== index)
      if (updated.length === 0 && fileMatInputRef.current) {
        fileMatInputRef.current.value = ''
      }
      return updated
    })
  }

  const bidangOptions = [...new Set(pegawaiList.map((p) => p.bidang).filter(Boolean))]
  const filteredPegawai = pegawaiList.filter(
    (p) => !selectedBidang || p.bidang === selectedBidang
  )

  const { isListening, interimText, toggleListening } = useSpeechToText({
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
    } catch (error: any) {
      const friendly = formatUserFriendlyError(error, 'Terjadi kendala saat memproses polesan AI.')
      logSystemError(friendly.errorCode, error, 'input-form.enhanceTextWithAI')
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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)

    const formData = new FormData(e.currentTarget)
    const rawData = Object.fromEntries(formData.entries())
    const docFilesToSubmit =
      docFiles.length > 0
        ? docFiles
        : (formData.getAll('file_dok') as File[]).filter((f) => f && f.size > 0)
    const matFilesToSubmit =
      matFiles.length > 0
        ? matFiles
        : (formData.getAll('file_materi') as File[]).filter((f) => f && f.size > 0)

    const payloadValidation = validateTotalPayloadSize(docFilesToSubmit, matFilesToSubmit)
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
        docFilesToSubmit.map(async (file) => ({
          base64: await fileToBase64(file),
          name: file.name,
          mime: file.type || 'image/jpeg',
        }))
      )

      const base64Mats = await Promise.all(
        matFilesToSubmit.map(async (file) => ({
          base64: await fileToBase64(file),
          name: file.name,
          mime: file.type || 'application/octet-stream',
        }))
      )

      const selectedPeg = filteredPegawai.find((p) => p.id === rawData.pegawai_id)

      const formPayload = {
        pegawai_id: selectedPeg?.nama || (rawData.pegawai_id as string),
        bidang: rawData.bidang as string,
        jabatan: selectedPeg?.jabatan || '',
        jenis_penugasan: rawData.jenis as string,
        tanggal_kegiatan: rawData.tanggal as string,
        nama_kegiatan: rawData.kegiatan as string,
        tempat_kegiatan: rawData.tempat as string,
        penyelenggara: rawData.penyelenggara as string,
        tamu_undangan: (rawData.tamu as string) || '',
        catatan_hasil: (rawData.catatan as string) || '',
      }

      const res = await submitLaporan(formPayload, base64Docs, base64Mats)
      if (!res) {
        throw new Error(
          'Server tidak memberikan respons. Kemungkinan koneksi terputus atau ukuran berkas lampiran melebihi kapasitas pengiriman serverless Vercel (4.5 MB).'
        )
      }

      if (res.status === 'success') {
        Swal.fire({
          title: 'Berhasil!',
          text: 'Laporan penugasan berhasil disimpan.',
          icon: 'success',
          confirmButtonColor: DESIGN_TOKENS.sweetAlert.confirmButtonColor,
        })
        formRef.current?.reset()
        setSelectedBidang('')
        setCatatanText('')
        setDocFiles([])
        setMatFiles([])
      } else {
        const errorCode = (res as any).errorCode || generateErrorCode()
        logSystemError(errorCode, res.message, 'input-form.handleSubmit')
        Swal.fire({
          title: 'Gagal Menyimpan',
          html: `<p class="mb-2 text-slate-700">${res.message || 'Gagal menyimpan data ke Spreadsheet.'}</p><p class="text-xs text-slate-500 font-mono">Kode Referensi: <span class="font-bold text-slate-700">${errorCode}</span></p>`,
          icon: 'error',
          confirmButtonColor: DESIGN_TOKENS.sweetAlert.confirmButtonColor,
        })
      }
    } catch (error: any) {
      const friendly = formatUserFriendlyError(
        error,
        'Pastikan koneksi internet stabil atau kurangi ukuran file lampiran.'
      )
      logSystemError(friendly.errorCode, error, 'input-form.handleSubmit')
      Swal.fire({
        title: 'Gagal Menyimpan',
        html: `<p class="mb-2 text-slate-700">${friendly.userMessage}</p><p class="text-xs text-slate-500 font-mono">Kode Referensi: <span class="font-bold text-slate-700">${friendly.errorCode}</span></p>`,
        icon: 'error',
        confirmButtonColor: DESIGN_TOKENS.sweetAlert.confirmButtonColor,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="relative w-full max-w-5xl xl:max-w-6xl mx-auto">
      {/* Loading Overlay */}
      {isSubmitting && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/60 backdrop-blur-sm rounded-2xl">
          <div className="bg-white p-6 rounded-2xl shadow-xl flex flex-col items-center text-center max-w-sm w-11/12 border border-slate-200">
            <Loader2 className="animate-spin text-primary mb-3" size={40} />
            <h3 className="text-base font-bold text-slate-900 mb-1">Menyimpan Laporan</h3>
            <p className="text-slate-500 text-xs sm:text-sm">Mohon tunggu, berkas dan data sedang diunggah...</p>
          </div>
        </div>
      )}

      {/* Optimizing File Overlay */}
      {isOptimizingFile && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/60 backdrop-blur-sm rounded-2xl">
          <div className="bg-white p-6 rounded-2xl shadow-xl flex flex-col items-center text-center max-w-sm w-11/12 border border-slate-200">
            <Loader2 className="animate-spin text-primary mb-3" size={40} />
            <h3 className="text-base font-bold text-slate-900 mb-1">Mengoptimalkan Berkas</h3>
            <p className="text-slate-500 text-xs sm:text-sm">Sedang memproses dan mengompresi lampiran untuk pengiriman aman...</p>
          </div>
        </div>
      )}

      {/* Main Cockpit Card */}
      <div
        className={`bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden w-full transition-all duration-300 ${
          isSubmitting ? 'blur-sm pointer-events-none' : ''
        }`}
      >
        {/* Compact Header Bar */}
        <div className="bg-slate-900 px-4 sm:px-6 py-3.5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-slate-800 rounded-lg text-primary">
              <FileSignature size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white leading-tight">
                Formulir Laporan Penugasan
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 hidden sm:block">
                Pencatatan resmi kegiatan penugasan ASN Dinas Tenaga Kerja Surakarta
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800/80 rounded-full border border-slate-700 text-slate-300 text-xs font-medium">
            <Building2 size={14} className="text-primary" />
            <span>SIMPELGAS</span>
          </div>
        </div>

        {/* 2-Column Responsive Workbench Form (Activates on md: 768px+) */}
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-5 items-stretch"
        >
          {/* LEFT COLUMN: Metadata & Identitas Penugasan (6 cols on md, 5 on xl) */}
          <div className="md:col-span-6 xl:col-span-5 flex flex-col gap-3.5 justify-between">
            {/* Sub-panel 1: Pegawai & Penugasan */}
            <div className="bg-slate-50/80 p-3 sm:p-4 rounded-xl border border-slate-200/80 flex flex-col gap-3">
              <div className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 pb-1.5 border-b border-slate-200">
                <span className="w-1.5 h-3.5 bg-primary rounded-full" />
                Data Pegawai & Penugasan
              </div>

              {/* Row: Bidang & Nama */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="in_bidang" className="block text-sm font-semibold text-slate-700">
                    Bidang / Unit Kerja <span className="text-destructive">*</span>
                  </label>
                  <select
                    name="bidang"
                    id="in_bidang"
                    required
                    value={selectedBidang}
                    onChange={(e) => setSelectedBidang(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-primary focus:border-primary bg-white transition outline-none h-10"
                  >
                    <option value="">-- Pilih Bidang --</option>
                    {bidangOptions.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label htmlFor="in_nama" className="block text-sm font-semibold text-slate-700">
                    Nama Pegawai <span className="text-destructive">*</span>
                  </label>
                  <select
                    name="pegawai_id"
                    id="in_nama"
                    required
                    disabled={!selectedBidang}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-primary focus:border-primary bg-white transition outline-none h-10 disabled:bg-slate-200 disabled:cursor-not-allowed"
                  >
                    <option value="">-- Pilih Nama Pegawai --</option>
                    {filteredPegawai.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nama}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row: Jenis Penugasan & Tanggal */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="in_jenis" className="block text-sm font-semibold text-slate-700">
                    Jenis Penugasan <span className="text-destructive">*</span>
                  </label>
                  <select
                    name="jenis"
                    id="in_jenis"
                    required
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-primary focus:border-primary bg-white transition outline-none h-10"
                  >
                    <option value="">-- Pilih Jenis --</option>
                    <option value="Rapat Koordinasi">Rapat Koordinasi</option>
                    <option value="Sosialisasi / Bimtek">Sosialisasi / Bimtek</option>
                    <option value="Monitoring & Evaluasi">Monitoring & Evaluasi</option>
                    <option value="Kunjungan Kerja">Kunjungan Kerja</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label htmlFor="in_tanggal" className="block text-sm font-semibold text-slate-700">
                    Tanggal Kegiatan <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="date"
                    name="tanggal"
                    id="in_tanggal"
                    required
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-primary focus:border-primary bg-white transition outline-none h-10"
                  />
                </div>
              </div>
            </div>

            {/* Sub-panel 2: Detail Kegiatan & Lokasi */}
            <div className="bg-slate-50/80 p-3 sm:p-4 rounded-xl border border-slate-200/80 flex flex-col gap-3">
              <div className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 pb-1.5 border-b border-slate-200">
                <span className="w-1.5 h-3.5 bg-primary rounded-full" />
                Informasi & Lokasi Acara
              </div>

              {/* Nama Kegiatan */}
              <div className="space-y-1">
                <label htmlFor="in_kegiatan" className="block text-sm font-semibold text-slate-700">
                  Nama Kegiatan <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  name="kegiatan"
                  id="in_kegiatan"
                  placeholder="Contoh: Rapat Evaluasi Kinerja Triwulan III"
                  required
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-primary focus:border-primary bg-white transition outline-none h-10"
                />
              </div>

              {/* Row: Tempat & Penyelenggara */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="in_tempat" className="block text-sm font-semibold text-slate-700">
                    Tempat Kegiatan <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    name="tempat"
                    id="in_tempat"
                    placeholder="Contoh: Hotel Solo Paragon"
                    required
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-primary focus:border-primary bg-white transition outline-none h-10"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="in_penyelenggara" className="block text-sm font-semibold text-slate-700">
                    Penyelenggara <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    name="penyelenggara"
                    id="in_penyelenggara"
                    placeholder="Contoh: Disnaker Prov. Jateng"
                    required
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-primary focus:border-primary bg-white transition outline-none h-10"
                  />
                </div>
              </div>

              {/* Tamu Undangan */}
              <div className="space-y-1">
                <label htmlFor="in_tamu" className="block text-sm font-semibold text-slate-700">
                  Tamu Undangan / Peserta
                </label>
                <input
                  type="text"
                  name="tamu"
                  id="in_tamu"
                  placeholder="Contoh: Perwakilan OPD, Camat se-Surakarta"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-primary focus:border-primary bg-white transition outline-none h-10"
                />
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Catatan AI, Lampiran & Aksi Kirim (6 cols on md, 7 on xl) */}
          <div className="md:col-span-6 xl:col-span-7 flex flex-col gap-3.5 justify-between">
            {/* Catatan + Dikte Suara & AI Enhance Section */}
            <div className="bg-slate-50/80 p-3 sm:p-4 rounded-xl border border-slate-200/80 flex flex-col gap-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-slate-200">
                <div className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-1.5 h-3.5 bg-primary rounded-full" />
                  Catatan Hasil Kegiatan <span className="text-destructive">*</span>
                </div>
                <div className="flex items-center gap-2">
                  {/* Tombol Dikte Suara (STT) */}
                  <button
                    type="button"
                    onClick={toggleListening}
                    disabled={isEnhancing || isSubmitting}
                    className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer active:scale-95 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed ${
                      isListening
                        ? 'bg-rose-600 hover:bg-rose-700 text-white animate-pulse'
                        : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                    }`}
                    title={isListening ? 'Hentikan dikte suara' : 'Mulai dikte suara (Speech-to-Text)'}
                  >
                    {isListening ? (
                      <>
                        <MicOff size={14} className="text-white" />
                        <span>Mendengarkan...</span>
                      </>
                    ) : (
                      <>
                        <Mic size={14} className="text-primary" />
                        <span>Dikte Suara</span>
                      </>
                    )}
                  </button>

                  {/* Tombol Perbaiki Teks dengan AI */}
                  <button
                    type="button"
                    onClick={enhanceTextWithAI}
                    disabled={isEnhancing || isSubmitting || isListening}
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer active:scale-95 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Perbaiki dan kembangkan poin kegiatan dengan AI"
                  >
                    {isEnhancing ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Sparkles size={14} />
                    )}
                    <span>Perbaiki Teks dengan AI</span>
                  </button>
                </div>
              </div>

              {isListening && interimText && (
                <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-600 bg-rose-50/80 border border-rose-100 rounded-lg animate-in fade-in duration-150">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                  <span className="font-semibold text-rose-700">Mendengar:</span>
                  <span className="italic truncate">{interimText}</span>
                </div>
              )}

              <textarea
                name="catatan"
                id="in_catatan"
                rows={4}
                value={catatanText}
                onChange={(e) => setCatatanText(e.target.value)}
                placeholder="Tuliskan ringkasan pokok pembahasan, keputusan, dan tindak lanjut hasil kegiatan di sini (bisa gunakan Dikte Suara)..."
                required
                className={`w-full p-3 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-primary focus:border-primary bg-white transition outline-none resize-none min-h-[130px] sm:min-h-[140px] leading-relaxed ${
                  isEnhancing ? 'opacity-50' : ''
                } ${isListening ? 'border-rose-300 ring-2 ring-rose-200' : ''}`}
                disabled={isEnhancing || isSubmitting}
              />
            </div>

            {/* Lampiran Dual Dropzone Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Foto Upload Card */}
              <div
                onDragOver={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    handleAddDocFiles(Array.from(e.dataTransfer.files))
                  }
                }}
                className="bg-sky-50/60 p-3.5 rounded-xl border border-sky-100 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label
                      htmlFor="in_file_dok"
                      className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Camera size={16} className="text-primary" />
                      <span>Dokumentasi (Foto)</span>
                    </label>
                    {docFiles.length > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-primary/20 text-sky-900 font-bold px-2 py-0.5 rounded flex items-center gap-1">
                          <CheckCircle2 size={12} /> {docFiles.length} foto
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setDocFiles([])
                            if (fileDokInputRef.current) fileDokInputRef.current.value = ''
                          }}
                          className="text-xs text-slate-400 hover:text-destructive transition cursor-pointer"
                          title="Hapus semua foto"
                        >
                          Hapus Semua
                        </button>
                      </div>
                    )}
                  </div>

                  <input
                    ref={fileDokInputRef}
                    multiple
                    type="file"
                    name="file_dok"
                    id="in_file_dok"
                    accept="image/*"
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        handleAddDocFiles(Array.from(e.target.files))
                        e.target.value = ''
                      }
                    }}
                    className="hidden"
                  />

                  {docFiles.length === 0 ? (
                    <button
                      type="button"
                      onClick={() => fileDokInputRef.current?.click()}
                      className="w-full flex flex-col items-center justify-center py-4 px-3 border-2 border-dashed border-sky-200 hover:border-primary hover:bg-sky-100/50 rounded-lg bg-white/80 transition cursor-pointer text-center group"
                    >
                      <div className="p-2 bg-sky-100 rounded-full text-primary group-hover:scale-110 transition mb-1.5">
                        <ImagePlus size={18} />
                      </div>
                      <p className="text-xs sm:text-sm font-semibold text-slate-700 group-hover:text-primary">
                        Pilih / Tarik Foto ke Sini
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Format JPG, PNG, WEBP (Bisa multiple)
                      </p>
                    </button>
                  ) : (
                    <div>
                      {/* Photo Previews Grid */}
                      <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto p-1.5 bg-white/70 rounded-lg border border-sky-100">
                        {docFiles.map((file, idx) => (
                          <PhotoThumbnail
                            key={`${file.name}-${idx}`}
                            file={file}
                            onRemove={() => removeDocFile(idx)}
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
                        {/* Mini Add Button */}
                        <button
                          type="button"
                          onClick={() => fileDokInputRef.current?.click()}
                          className="aspect-square rounded-lg border-2 border-dashed border-sky-300 hover:border-primary bg-white/70 hover:bg-sky-100/70 flex flex-col items-center justify-center text-sky-700 hover:text-primary transition cursor-pointer"
                          title="Tambah foto lagi"
                        >
                          <Plus size={18} />
                          <span className="text-[10px] font-bold mt-0.5">Tambah</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Materi Upload Card */}
              <div
                onDragOver={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    handleAddMateriFiles(Array.from(e.dataTransfer.files))
                  }
                }}
                className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label
                      htmlFor="in_file_materi"
                      className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1.5 cursor-pointer"
                    >
                      <FileText size={16} className="text-slate-600" />
                      <span>Materi (PDF/Docx)</span>
                    </label>
                    {matFiles.length > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-slate-200 text-slate-800 font-bold px-2 py-0.5 rounded flex items-center gap-1">
                          <CheckCircle2 size={12} /> {matFiles.length} file
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setMatFiles([])
                            if (fileMatInputRef.current) fileMatInputRef.current.value = ''
                          }}
                          className="text-xs text-slate-400 hover:text-destructive transition cursor-pointer"
                          title="Hapus semua berkas materi"
                        >
                          Hapus Semua
                        </button>
                      </div>
                    )}
                  </div>

                  <input
                    ref={fileMatInputRef}
                    multiple
                    type="file"
                    name="file_materi"
                    id="in_file_materi"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        handleAddMateriFiles(Array.from(e.target.files))
                        e.target.value = ''
                      }
                    }}
                    className="hidden"
                  />

                  {matFiles.length === 0 ? (
                    <button
                      type="button"
                      onClick={() => fileMatInputRef.current?.click()}
                      className="w-full flex flex-col items-center justify-center py-4 px-3 border-2 border-dashed border-slate-300 hover:border-slate-400 hover:bg-slate-100/60 rounded-lg bg-white/80 transition cursor-pointer text-center group"
                    >
                      <div className="p-2 bg-slate-100 rounded-full text-slate-600 group-hover:scale-110 transition mb-1.5">
                        <FileUp size={18} />
                      </div>
                      <p className="text-xs sm:text-sm font-semibold text-slate-700 group-hover:text-slate-900">
                        Pilih / Tarik Berkas Materi
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        PDF, DOCX, XLSX (Maks. 5MB)
                      </p>
                    </button>
                  ) : (
                    <div>
                      {/* Material Files Preview List */}
                      <div className="space-y-2 max-h-40 overflow-y-auto p-1.5 bg-white/70 rounded-lg border border-slate-200">
                        {matFiles.map((file, idx) => (
                          <MaterialItem
                            key={`${file.name}-${idx}`}
                            file={file}
                            onRemove={() => removeMatFile(idx)}
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
                      <button
                        type="button"
                        onClick={() => fileMatInputRef.current?.click()}
                        className="w-full mt-2 py-1.5 px-3 border border-dashed border-slate-300 hover:border-slate-400 rounded-md bg-white text-slate-700 hover:text-slate-900 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                      >
                        <Plus size={14} />
                        <span>Tambah Berkas Lain</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-primary text-primary-foreground py-3 sm:py-3.5 rounded-xl font-bold text-sm sm:text-base hover:bg-primary-hover disabled:opacity-70 disabled:cursor-not-allowed transition-all duration-150 cursor-pointer active:scale-[0.99] shadow-md hover:shadow-lg flex justify-center items-center gap-2 outline-none focus:ring-4 focus:ring-primary/30"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  <span>Sedang Memproses...</span>
                </>
              ) : (
                <>
                  <Send size={18} />
                  <span>Kirim Laporan Penugasan</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Modal Side-by-Side Comparison AI */}
      <AiCompareModal
        isOpen={compareModal.isOpen}
        originalText={compareModal.originalText}
        enhancedText={compareModal.enhancedText}
        provider={compareModal.provider}
        onClose={() => setCompareModal((prev) => ({ ...prev, isOpen: false }))}
        onApply={(appliedText) => {
          setCatatanText(appliedText)
          Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: 'Teks rekomendasi AI diterapkan ke form',
            showConfirmButton: false,
            timer: 2500,
          })
        }}
      />

      {/* Modal File Preview (Foto & Dokumen) */}
      <FilePreviewModal
        isOpen={filePreview.isOpen}
        fileUrl={filePreview.fileUrl}
        fileName={filePreview.fileName}
        fileType={filePreview.fileType}
        onClose={() =>
          setFilePreview((prev) => ({
            ...prev,
            isOpen: false,
          }))
        }
      />
    </div>
  )
}
