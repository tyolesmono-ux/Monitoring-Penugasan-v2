import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Lock, ArrowLeft, ShieldAlert, FileText, CheckCircle2 } from 'lucide-react'
import { getAllLaporan, getPegawai } from '@/lib/actions'
import { EditLaporanClient } from '@/components/edit-laporan-client'

export const dynamic = 'force-dynamic'

interface EditLaporanPageProps {
  params: {
    id: string
  }
  searchParams?: {
    nip?: string
  }
}

export default async function EditLaporanPage({
  params,
  searchParams,
}: EditLaporanPageProps) {
  const [allLaporan, pegawaiList] = await Promise.all([
    getAllLaporan(),
    getPegawai(),
  ])

  const laporan = allLaporan.find((l) => l.id === params.id)

  if (!laporan) {
    notFound()
  }

  // Verifikasi status lock: jika memiliki catatan pimpinan atau status bukan 'Untuk Diketahui'
  const isLocked =
    Boolean(laporan.catatan_pimpinan && laporan.catatan_pimpinan.trim() !== '') ||
    (Boolean(laporan.status_tindak_lanjut) && laporan.status_tindak_lanjut !== 'Untuk Diketahui')

  if (isLocked) {
    return (
      <div className="pt-16 lg:pt-0 w-full max-w-2xl mx-auto py-8">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 text-center space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center mx-auto border border-slate-200">
            <Lock size={28} className="text-slate-600" />
          </div>

          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
              <ShieldAlert size={13} />
              Laporan Terkunci
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
              Laporan Telah Dievaluasi Pimpinan
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-lg mx-auto">
              Laporan penugasan ini telah ditindaklanjuti atau memiliki catatan evaluasi resmi dari Pimpinan.
              Demi menjaga integritas dan keabsahan arsip kedinasan, laporan yang telah dievaluasi tidak dapat disunting kembali.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-left text-xs space-y-2.5">
            <div className="flex items-start gap-2">
              <FileText size={15} className="text-primary shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-800">Kegiatan: </span>
                <span className="text-slate-700">{laporan.nama_kegiatan}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-800">Pelapor: </span>
              <span className="text-slate-700">{laporan.pegawai_id} ({laporan.bidang})</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-800">Status Tindak Lanjut: </span>
              <span className="font-medium text-primary">{laporan.status_tindak_lanjut || 'Untuk Diketahui'}</span>
            </div>
            {laporan.catatan_pimpinan && (
              <div className="pt-2 border-t border-slate-200">
                <span className="font-semibold text-slate-800 block mb-0.5">Catatan Evaluasi Pimpinan:</span>
                <p className="text-slate-700 italic bg-white p-2.5 rounded-lg border border-slate-200">
                  &ldquo;{laporan.catatan_pimpinan}&rdquo;
                </p>
              </div>
            )}
          </div>

          <div className="pt-2">
            <Link
              href="/laporan"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-sky-500 text-xs sm:text-sm font-semibold transition"
            >
              <ArrowLeft size={16} />
              Kembali ke Daftar Laporan
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="pt-16 lg:pt-0 w-full">
      <EditLaporanClient
        laporan={laporan}
        pegawaiList={pegawaiList}
        initialNip={searchParams?.nip}
      />
    </div>
  )
}
