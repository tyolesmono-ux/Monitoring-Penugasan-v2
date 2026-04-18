import { useState } from 'react';
import { useAppContext } from '../AppContext';
import { Printer, Search, Calendar, PinIcon, Loader2 } from 'lucide-react';
import Swal from 'sweetalert2';

const Cetak = () => {
  const { pegawaiList, fetchData } = useAppContext();
  const [selectedBidang, setSelectedBidang] = useState('');
  const [selectedPegawai, setSelectedPegawai] = useState('');
  const [laporanList, setLaporanList] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchMsg, setSearchMsg] = useState('');

  const bidangOptions = [...new Set(pegawaiList.map(p => p['Bidang / Unit Kerja'] || p['Bidang']).filter(Boolean))];
  
  const filteredPegawai = pegawaiList.filter(p => {
    const b = p['Bidang / Unit Kerja'] || p['Bidang'];
    return !selectedBidang || b === selectedBidang;
  });

  const cariLaporan = async () => {
    if (!selectedPegawai) {
      Swal.fire({icon: 'warning', title: 'Oops', text: 'Pilih nama pegawai dulu ya!'});
      return;
    }
    setIsLoading(true);
    setSearchMsg('');
    setLaporanList([]);

    const data = await fetchData(`getLaporan&nama=${encodeURIComponent(selectedPegawai)}`);
    if (data.status === 'success' && data.data.length > 0) {
      setLaporanList(data.data);
    } else {
      setSearchMsg('Belum ada riwayat laporan.');
    }
    setIsLoading(false);
  };

  const cleanText = (str) => (str ? str.toString().toLowerCase().replace(/\s+/g, ' ').trim() : "");
  const isPerluTindakLanjut = (str) => cleanText(str).includes('perlu tindak lanjut');

  const generateTemplateLaporan = (lap) => {
    const logoUrl = window.location.origin + '/Pemkot.png';
    return `
      <div style="display: flex; align-items: center; border-bottom: 3px solid black; margin-bottom: 2px; padding-bottom: 10px;">
          <img src="${logoUrl}" style="width: 80px; height: auto; flex-shrink: 0;" />
          <div style="flex-grow: 1; text-align: center;">
              <h3 style="margin: 0; font-size: 16pt; font-weight: normal;">PEMERINTAH KOTA SURAKARTA</h3>
              <h2 style="margin: 2px 0; font-size: 20pt; font-weight: bold; letter-spacing: 1px;">DINAS TENAGA KERJA</h2>
              <p style="margin: 0; font-size: 10pt;">Jalan Slamet Riyadi No. 306, Kota Surakarta, Kodepos 57141</p>
              <p style="margin: 0; font-size: 10pt;">Telepon: (0271) 714902 | Email: disnaker@surakarta.go.id</p>
          </div>
          <div style="width: 80px; flex-shrink: 0;"></div>
      </div>
      <div style="border-top: 1px solid black; margin-bottom: 20px; padding-top: 2px;"></div>

      <h3 style="text-align:center; text-decoration:underline; font-weight:bold;">LAPORAN HASIL PENUGASAN</h3>
      
      <table style="width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 20px; font-size: 14px;">
          <tr><td style="width:28%; padding: 4px 0; vertical-align: top;">Nama Pegawai</td><td style="width:2%; vertical-align: top;">:</td><td><strong>${lap['Nama Pegawai'] || '-'}</strong></td></tr>
          <tr><td style="padding: 4px 0; vertical-align: top;">Bidang / Unit Kerja</td><td style="vertical-align: top;">:</td><td>${lap['Bidang'] || '-'}</td></tr>
          <tr><td>Nama Kegiatan</td><td>:</td><td>${lap['Nama Kegiatan'] || '-'}</td></tr>
          <tr><td>Tanggal Kegiatan</td><td>:</td><td>${lap['Tanggal Kegiatan'] || '-'}</td></tr>
          <tr><td>Tempat Kegiatan</td><td>:</td><td>${lap['Tempat Kegiatan'] || '-'}</td></tr>
          <tr><td>Penyelenggara</td><td>:</td><td>${lap['Penyelenggara Kegiatan'] || '-'}</td></tr>
          <tr><td>Tamu Undangan</td><td>:</td><td>${lap['Tamu Undangan yang Hadir'] || '-'}</td></tr>
      </table>
      <h4 style="margin-bottom: 5px;">A. Hasil Kegiatan:</h4>
      <p style="text-align:justify; white-space: pre-wrap; font-size: 14px;">${lap['Catatan Hasil Kegiatan'] || '-'}</p>
      
      <div class="anti-potong">
          <h4 style="margin-bottom: 5px;">B. Tindak Lanjut:</h4>
          <p style="text-align:justify; font-size: 14px;">${lap['Status Tindak Lanjut'] || '-'}</p>
          <h4 style="margin-bottom: 5px;">C. Catatan Pimpinan:</h4>
          <p style="text-align:justify; white-space: pre-wrap; font-size: 14px;">${lap['Catatan Pimpinan'] || '-'}</p>
          <div style="float: right; width: 250px; text-align: center; margin-top: 40px;">
              <p>Surakarta, ${new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
              <p>Pegawai yang ditugaskan,</p><br><br><br><br><p><strong><u>${lap['Nama Pegawai'] || '-'}</u></strong></p>
          </div><div style="clear:both;"></div>
      </div>
    `;
  };

  const prosesCetak = (lap) => {
    // Hapus iframe print lama jika masih ada
    const oldIframe = document.getElementById('print-iframe');
    if (oldIframe) {
      document.body.removeChild(oldIframe);
    }

    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.id = 'print-iframe';
    document.body.appendChild(iframe);

    // Kirim data dan perintahkan iframe untuk print saat semua aset (terutama gambar) selesai dimuat
    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Cetak Laporan</title>
          <style>
            @media print {
              @page { size: A4 portrait; margin: 20mm; }
              body { margin: 0; padding: 0; }
              .anti-potong { page-break-inside: avoid; break-inside: avoid; }
            }
            body { font-family: 'Times New Roman', Times, serif; font-size: 14px; padding: 20mm; background: white; color: black; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 20px; }
            td { padding: 4px 0; vertical-align: top; }
          </style>
        </head>
        <body onload="setTimeout(function() { window.focus(); window.print(); }, 500);">
          ${generateTemplateLaporan(lap)}
        </body>
      </html>
    `);
    doc.close();
  };


  return (
    <div className="pt-16 lg:pt-0">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8 max-w-4xl mx-auto">
        <div className="flex items-center mb-6 border-b pb-4">
          <Printer className="text-2xl text-[#1B3C73] mr-3" size={32} />
          <div>
            <h2 className="text-xl font-bold text-[#1B3C73]">Cetak Laporan</h2>
            <p className="text-sm text-gray-500">Pilih nama Anda untuk melihat dan mencetak riwayat penugasan.</p>
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="w-full md:w-2/5">
            <label htmlFor="select-bidang-cetak" className="block text-sm font-semibold text-gray-700 mb-2">Bidang / Unit Kerja</label>
            <select 
              id="select-bidang-cetak" 
              value={selectedBidang} 
              onChange={e => {
                setSelectedBidang(e.target.value);
                setSelectedPegawai(''); 
              }}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#2A5499] outline-none bg-gray-50"
            >
              <option value="">-- Semua Bidang --</option>
              {bidangOptions.map((b, i) => <option key={i} value={b}>{b}</option>)}
            </select>
          </div>
          <div className="w-full md:w-2/5">
            <label htmlFor="select-pegawai-cetak" className="block text-sm font-semibold text-gray-700 mb-2">Nama Pegawai</label>
            <select 
              id="select-pegawai-cetak" 
              value={selectedPegawai} 
              onChange={e => setSelectedPegawai(e.target.value)}
              disabled={!selectedBidang}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#2A5499] outline-none bg-gray-50 disabled:bg-gray-200 disabled:cursor-not-allowed"
            >
              <option value="">-- Pilih Pegawai --</option>
              {filteredPegawai.map((p, i) => <option key={i} value={p['Nama Pegawai']}>{p['Nama Pegawai']}</option>)}
            </select>
          </div>
          <div className="flex items-end w-full md:w-1/5">
            <button 
              onClick={cariLaporan} 
              disabled={isLoading || !selectedPegawai}
              className="w-full md:w-auto bg-[#1B3C73] hover:bg-[#0A2647] text-white font-semibold py-3 px-8 rounded-xl transition shadow-md flex items-center justify-center disabled:opacity-75"
            >
              {isLoading ? <Loader2 className="animate-spin mr-2" /> : <Search className="mr-2" size={18} />} Cari Riwayat
            </button>
          </div>
        </div>
        
        {searchMsg && <div className="text-center font-medium text-red-500 my-4">{searchMsg}</div>}

        <div className="space-y-4">
          {laporanList.map((lap, idx) => {
            const isPerlu = isPerluTindakLanjut(lap['Status Tindak Lanjut']);
            return (
              <div key={idx} className="bg-white border border-gray-200 p-5 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:shadow-md transition">
                <div>
                  <h3 className="font-bold text-[#0A2647] text-lg">{lap['Nama Kegiatan'] || '-'}</h3>
                  <div className="flex flex-wrap items-center gap-2 mt-2 text-sm text-gray-500">
                    <span className="flex items-center"><Calendar size={14} className="mr-1" /> {lap['Tanggal Kegiatan'] || '-'}</span>
                    <span className="px-2 py-1 bg-gray-100 rounded-md border text-xs font-medium flex items-center"><PinIcon size={12} className="mr-1"/> {lap['Jenis Penugasan'] || '-'}</span>
                    <span className={`px-2 py-1 rounded-md border text-xs font-bold ${isPerlu ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-green-100 text-green-700 border-green-200'}`}>
                      {isPerlu ? 'Perlu Tindak Lanjut' : 'Untuk Diketahui'}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                  <button onClick={() => prosesCetak(lap)} className="flex-1 md:flex-none px-4 py-2 bg-[#1B3C73] text-white rounded-lg text-sm font-semibold hover:bg-[#0A2647] transition flex items-center justify-center shadow-md">
                    <Printer size={16} className="mr-2"/> Cetak Laporan
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Cetak;
