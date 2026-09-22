import { getAllLaporan, getPegawai } from '@/lib/actions'
import { LaporanListClient } from '@/components/laporan-list-client'

export const dynamic = 'force-dynamic'

export default async function LaporanPage() {
  const [laporanList, pegawaiList] = await Promise.all([
    getAllLaporan(),
    getPegawai(),
  ])

  return (
    <div className="pt-16 lg:pt-0 w-full space-y-6">
      <LaporanListClient initialLaporan={laporanList} pegawaiList={pegawaiList} />
    </div>
  )
}
