import { useState, useRef, useEffect } from 'react';
import { useAppContext } from '../AppContext';
import { UserCheck, Lock, Save, Calendar, Check, Loader2, Image as ImageIcon, FileText, Inbox, FileSpreadsheet, FileDown } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Swal from 'sweetalert2';

const PIMPINAN_ROLES = [
  { name: 'Kepala Dinas', pin: '123456', scopes: ['ALL'] },
  { name: 'Sekretaris', pin: '123456', scopes: ['ALL'] },
  { name: 'Kasubag Perkeu', pin: '123456', scopes: ['SEKRETARIAT'] },
  { name: 'Kasubag Ako', pin: '123456', scopes: ['SEKRETARIAT'] },
  { name: 'Kabid PPTK', pin: '123456', scopes: ['BIDANG PPTK'] },
  { name: 'Kabid Hubungan Industrial', pin: '123456', scopes: ['BIDANG HUBUNGAN INDUSTRIAL'] }
];

// Helper Components
const DriveThumbnail = ({ url, index, isMultiple }) => {
  const match = url.match(/[-\w]{25,}/);
  const fileId = match ? match[0] : null;

  if (!fileId) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-semibold transition outline-none focus:ring-2 focus:ring-[#1B3C73] text-blue-600 bg-blue-50 border-blue-200 hover:bg-blue-100">
        <ImageIcon size={16} /> Buka Gambar {isMultiple ? index + 1 : ''}
      </a>
    );
  }

  const imgSrc = `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`;

  // We mirror the index_old.html approach using a wrapper and standard image
  return (
    <a href={url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-gray-200 hover:shadow-lg transition group outline-none focus:ring-2 focus:ring-[#1B3C73] relative bg-blue-50">
      <div className="absolute inset-0 flex flex-col items-center justify-center text-blue-600 -z-10">
         <ImageIcon size={32} className="mb-2 opacity-50"/>
         <span className="font-semibold text-sm text-center px-2 opacity-80">Memuat / Buka File</span>
      </div>
      <img 
        src={imgSrc} 
        className="w-full h-40 object-cover group-hover:scale-105 transition duration-300 relative z-10 bg-white" 
        onError={(e) => {
          e.target.style.display = 'none';
        }}
        alt={`Dokumentasi ${index + 1}`}
      />
    </a>
  );
};

const formatFileLink = (urlStr, type) => {
  if (!urlStr || urlStr === '-' || urlStr.trim() === '') return <span className="text-gray-400 text-sm italic">Tidak ada file</span>;
  
  const urls = urlStr.split(/[\n,\s]+/).map(u => u.trim()).filter(u => u !== '');
  
  if (type === 'img') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3">
        {urls.map((url, i) => (
          <DriveThumbnail key={i} url={url} index={i} isMultiple={urls.length > 1} />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {urls.map((url, i) => (
        <a key={i} href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-3 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm font-semibold hover:bg-red-100 transition outline-none focus:ring-2 focus:ring-[#1B3C73]">
          <FileText size={16} /> Buka Materi {urls.length > 1 ? i + 1 : ''}
        </a>
      ))}
    </div>
  );
};

const MenuPimpinan = () => {
  const { dashboardData, fetchData, loadDashboardData, isDataLoading } = useAppContext();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeRole, setActiveRole] = useState('');
  const [pin, setPin] = useState('');
  
  const [laporanList, setLaporanList] = useState([]);
  const [savingRow, setSavingRow] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  
  const pinInputRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated && pinInputRef.current) {
      pinInputRef.current.focus();
    }
  }, [isAuthenticated, activeRole]);

  useEffect(() => {
    if (isAuthenticated && activeRole && dashboardData) {
      const roleSetup = PIMPINAN_ROLES.find(r => r.name === activeRole);
      if (!roleSetup) return;

      const filtered = dashboardData.filter(lap => {
        const lapBidang = lap['Bidang'] || lap['Bidang / Unit Kerja'];
        const lapBidangUpper = lapBidang ? lapBidang.toUpperCase() : '';

        // 1. Check Scope
        if (!roleSetup.scopes.includes('ALL')) {
           if (!roleSetup.scopes.includes(lapBidangUpper)) return false;
        }

        // 2. Exclude Kepala Dinas items from inbox entirely
        if (lapBidangUpper === 'KEPALA DINAS') return false;

        // 2b. Exclude superior roles from subordinate inbox using the new Jabatan column
        const pegawaiJabatanUpper = (lap['Jabatan'] || '').toUpperCase();
        if (activeRole.includes('Kasubag')) {
           // Kasubag should only evaluate their STAFF, not other Kasubags, not Sekretaris, not Kepala Dinas
           if (pegawaiJabatanUpper !== 'STAFF') return false;
        }

        // 3. Signature checking (Appended notes)
        const catatan = cleanText(lap['Catatan Pimpinan'] || '');
        const hasEvaluated = catatan.toLowerCase().includes(`[${activeRole.toLowerCase()}]`);
        
        return !hasEvaluated;
      });

      setLaporanList(filtered.map(lap => ({
        ...lap,
        _status: lap['Status Tindak Lanjut'] || 'Untuk Diketahui',
        _catatan_baru: ''
      })));
    }
  }, [dashboardData, isAuthenticated, activeRole]);

  const handlePinSubmit = (e) => {
    e.preventDefault();
    if (!activeRole) {
      Swal.fire({icon: 'warning', title: 'Pilih Jabatan', text: 'Tentukan jabatan Anda terlebih dahulu.'});
      return;
    }
    const roleSetup = PIMPINAN_ROLES.find(r => r.name === activeRole);
    if (roleSetup && pin === roleSetup.pin) {
      setIsAuthenticated(true);
      setPin('');
    } else {
      Swal.fire({icon: 'error', title: 'Akses Ditolak', text: 'PIN Salah!'});
      setPin('');
    }
  };

  const handleSelectChange = (rowIndex, value) => {
    setLaporanList(prev => prev.map(lap => lap.Row_Index === rowIndex ? { ...lap, _status: value } : lap));
  };

  const handleTextChange = (rowIndex, value) => {
    setLaporanList(prev => prev.map(lap => lap.Row_Index === rowIndex ? { ...lap, _catatan_baru: value } : lap));
  };

  const simpanCatatan = async (rowIndex) => {
    const lap = laporanList.find(l => l.Row_Index === rowIndex);
    if(!lap) return;

    if(!lap._catatan_baru.trim()) {
      Swal.fire({icon: 'warning', title: 'Catatan Kosong', text: 'Mohon isi catatan evaluasi Anda terlebih dahulu!'});
      return;
    }

    const { isConfirmed } = await Swal.fire({
      title: 'Simpan Evaluasi?',
      text: "Laporan ini akan dianggap telah Anda evaluasi dan akan hilang dari daftar tunggu Anda.",
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#F59E0B',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Ya, Simpan!',
      cancelButtonText: 'Batal'
    });

    if (!isConfirmed) return;

    setSavingRow(rowIndex);
    
    const existingNotes = lap['Catatan Pimpinan'] ? lap['Catatan Pimpinan'].trim() + "\n\n" : "";
    const appendedNote = existingNotes + `[${activeRole}]: ${lap._catatan_baru.trim()}`;
    
    const res = await fetchData(`updatePimpinan&row=${rowIndex}&status=${encodeURIComponent(lap._status)}&catatan=${encodeURIComponent(appendedNote)}`);
    
    if (res.status === 'success') {
      Swal.fire({ title: 'Tersimpan!', icon: 'success', timer: 1500, showConfirmButton: false });
      loadDashboardData(); 
    } else {
      Swal.fire('Error', 'Terjadi kesalahan koneksi.', 'error');
    }
    
    setSavingRow(null);
  };

  const exportRecap = async (format) => {
    if (!dashboardData || dashboardData.length === 0) return;

    const roleSetup = PIMPINAN_ROLES.find(r => r.name === activeRole);
    if (!roleSetup) return;

    setIsExporting(true);
    Swal.fire({
      title: 'Menyiapkan Data...',
      text: 'Mohon tunggu sebentar',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    try {
      // Filter data logic
      const dataForRecap = dashboardData.filter(lap => {
        const lapBidang = lap['Bidang'] || lap['Bidang / Unit Kerja'];
        const lapBidangUpper = lapBidang ? lapBidang.toUpperCase() : '';

        if (!roleSetup.scopes.includes('ALL')) {
          if (!roleSetup.scopes.includes(lapBidangUpper)) return false;
        }
        if (lapBidangUpper === 'KEPALA DINAS') return false;

        const pegawaiJabatanUpper = (lap['Jabatan'] || '').toUpperCase();
        if (activeRole.includes('Kasubag')) {
          if (pegawaiJabatanUpper !== 'STAFF') return false;
        }
        return true;
      });

      if (dataForRecap.length === 0) {
        Swal.fire('Info', 'Tidak ada data laporan untuk diekspor.', 'info');
        setIsExporting(false);
        return;
      }

      // Mapping columns for export
      const mappedData = dataForRecap.map((lap, index) => ({
        'No': index + 1,
        'Tanggal': lap['Tanggal Kegiatan'] || '-',
        'Nama Pegawai': lap['Nama Pegawai'] || '-',
        'Bidang': lap['Bidang'] || lap['Bidang / Unit Kerja'] || '-',
        'Nama Kegiatan': lap['Nama Kegiatan'] || '-',
        'Hasil Kegiatan': lap['Catatan Hasil Kegiatan'] || '-',
        'Status': lap['Status Tindak Lanjut'] || '-',
        'Catatan Pimpinan': lap['Catatan Pimpinan'] || '-'
      }));

      // Beri sedikit delay agar user melihat proses (opsional)
      await new Promise(resolve => setTimeout(resolve, 800));

      if (format === 'xlsx') {
        const ws = XLSX.utils.json_to_sheet(mappedData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Rekap Laporan");
        XLSX.writeFile(wb, `Rekap_Laporan_${activeRole.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`);
      } else if (format === 'pdf') {
        const doc = new jsPDF('l', 'mm', 'a4');
        const title = `Rekap Laporan Kegiatan - ${activeRole}`;
        
        doc.setFontSize(16);
        doc.text(title, 14, 15);
        doc.setFontSize(10);
        doc.text(`Dicetak pada: ${new Date().toLocaleString('id-ID')}`, 14, 22);

        const tableColumn = Object.keys(mappedData[0]);
        const tableRows = mappedData.map(item => Object.values(item));

        autoTable(doc, {
          head: [tableColumn],
          body: tableRows,
          startY: 28,
          theme: 'grid',
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [27, 60, 115], textColor: 255 },
          columnStyles: {
            0: { cellWidth: 10 },
            1: { cellWidth: 25 },
            2: { cellWidth: 35 },
            3: { cellWidth: 35 },
            4: { cellWidth: 50 },
            5: { cellWidth: 60 },
            6: { cellWidth: 25 },
            7: { cellWidth: 40 },
          }
        });
        doc.save(`Rekap_Laporan_${activeRole.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
      }

      Swal.close();
      Swal.fire({
        icon: 'success',
        title: 'Berhasil!',
        text: `File ${format.toUpperCase()} telah berhasil diunduh.`,
        timer: 2000,
        showConfirmButton: false
      });
    } catch (error) {
      console.error('Export Error:', error);
      Swal.fire('Error', 'Gagal memproses ekspor data: ' + error.message, 'error');
    } finally {
      setIsExporting(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] pt-16 lg:pt-0">
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-200 w-[90%] max-w-sm text-center transform transition-all scale-100">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4 text-[#F59E0B] text-3xl">
            <Lock />
          </div>
          <h3 className="text-2xl font-bold text-[#1B3C73] mb-2">Akses Pimpinan</h3>
          <p className="text-gray-500 text-sm mb-6">Pilih jabatan dan masukkan PIN Anda</p>
          <form onSubmit={handlePinSubmit}>
            <select 
              value={activeRole} 
              onChange={(e) => {setActiveRole(e.target.value); setPin('');}}
              className="w-full px-4 py-3 mb-4 rounded-xl border-2 border-gray-200 bg-gray-50 focus:border-[#F59E0B] outline-none font-semibold text-[#1B3C73]"
            >
              <option value="">-- Pilih Jabatan --</option>
              {PIMPINAN_ROLES.map((r, i) => <option key={i} value={r.name}>{r.name}</option>)}
            </select>
            
            <input 
              ref={pinInputRef}
              type="password" 
              value={pin}
              disabled={!activeRole}
              onChange={e => setPin(e.target.value)}
              className="w-full px-4 py-4 mb-6 border-2 border-gray-200 rounded-xl text-center text-2xl tracking-[0.5em] bg-gray-50 text-[#0A2647] focus:border-[#F59E0B] focus:ring-0 outline-none transition disabled:opacity-50 disabled:cursor-not-allowed" 
              placeholder="••••••" 
            />
            <button type="submit" disabled={!activeRole} className="w-full py-3 bg-[#F59E0B] hover:bg-[#D97706] text-[#0A2647] font-bold rounded-xl transition shadow-md outline-none focus:ring-4 focus:ring-amber-200 disabled:opacity-50 disabled:cursor-not-allowed">
              Masuk
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-16 lg:pt-0">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8 border-t-4 border-t-[#F59E0B] max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6 border-b pb-4">
          <div className="flex items-center">
            <UserCheck className="text-2xl text-[#F59E0B] mr-3" size={32} />
            <div>
              <h2 className="text-xl font-bold text-[#1B3C73]">Panel Evaluasi Pimpinan</h2>
              <p className="text-sm text-gray-500">Anda login sebagai: <strong className="text-[#F59E0B]">{activeRole}</strong></p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => exportRecap('xlsx')} 
              disabled={isExporting}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg text-xs font-bold hover:bg-green-100 transition shadow-sm disabled:opacity-50"
              title="Ekspor ke Excel"
            >
              {isExporting ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />} XLSX
            </button>
            <button 
              onClick={() => exportRecap('pdf')} 
              disabled={isExporting}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs font-bold hover:bg-red-100 transition shadow-sm disabled:opacity-50"
              title="Ekspor ke PDF"
            >
              {isExporting ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />} PDF
            </button>
            <div className="w-px h-6 bg-gray-200 mx-1"></div>
            <button onClick={() => {setIsAuthenticated(false); setActiveRole(''); setPin('');}} className="text-sm text-gray-400 hover:text-red-600 font-semibold underline transition">
              Keluar
            </button>
          </div>
        </div>
        
        {isDataLoading ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <Loader2 className="animate-spin mb-4" size={32} />
            Memuat tugas evaluasi...
          </div>
        ) : laporanList.length === 0 ? (
          <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center text-green-700">
            <Check size={48} className="mx-auto mb-3 text-green-500" />
            <h3 className="text-xl font-bold mb-1">Semua Selesai!</h3>
            <p>Tidak ada laporan aktivitas yang perlu dievaluasi saat ini.</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 flex items-center gap-3">
              <Inbox className="text-blue-500" size={24} />
              <span className="font-semibold text-[#1B3C73]">Terdapat {laporanList.length} laporan menanti evaluasi Anda.</span>
            </div>

            {laporanList.map((lap) => {
              return (
                <div key={lap.Row_Index} className="bg-gray-50 border-2 border-gray-200 rounded-xl overflow-hidden focus-within:border-amber-300 transition-colors shadow-sm">
                  <div className="bg-white px-5 py-4 border-b border-gray-200 flex flex-col md:flex-row justify-between md:items-center gap-2">
                    <div>
                      <h3 className="font-bold text-[#0A2647] text-lg">{lap['Nama Kegiatan'] || '-'}</h3>
                      <div className="text-sm text-gray-500 mt-1 flex flex-wrap items-center gap-2">
                        <span className="flex items-center"><UserCheck size={14} className="mr-1"/> {lap['Nama Pegawai']}</span> | 
                        <span className="flex items-center font-semibold text-[#1B3C73]">{lap['Bidang / Unit Kerja'] || lap['Bidang']}</span>
                      </div>
                      <div className="text-xs text-gray-400 mt-1 flex items-center gap-2">
                        <Calendar size={12} /> {lap['Tanggal Kegiatan'] || '-'}
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-5 space-y-4">
                    <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100">
                      <h4 className="font-bold text-[#1B3C73] text-sm mb-2">Hasil Kegiatan:</h4>
                      <p className="text-gray-700 text-sm whitespace-pre-wrap">{lap['Catatan Hasil Kegiatan'] || '-'}</p>
                    </div>
                    
                    {lap['Catatan Pimpinan'] && (
                      <div className="bg-amber-50/50 p-4 rounded-lg border border-amber-100">
                        <h4 className="font-bold text-amber-800 text-sm mb-2">Riwayat Evaluasi Pimpinan Lainnya:</h4>
                        <div className="text-gray-700 text-sm whitespace-pre-wrap font-mono bg-white p-3 border border-amber-200 rounded">
                          {lap['Catatan Pimpinan']}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col md:flex-row gap-4 p-4 bg-white rounded-lg border border-gray-100">
                      <div className="flex-1">
                        <h4 className="font-bold text-gray-700 text-xs mb-2 uppercase tracking-wide">Dokumentasi</h4>
                        {formatFileLink(lap['Dokumentasi Kegiatan'], 'img')}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-gray-700 text-xs mb-2 uppercase tracking-wide">Materi</h4>
                        {formatFileLink(lap['Materi (Jika Ada)'], 'pdf')}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                      <div className="md:col-span-1">
                        <label htmlFor={`status-${lap.Row_Index}`} className="block text-sm font-bold text-[#0A2647] mb-1">Status Tindak Lanjut:</label>
                        <select 
                          id={`status-${lap.Row_Index}`} 
                          value={lap._status}
                          onChange={e => handleSelectChange(lap.Row_Index, e.target.value)}
                          className="w-full p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#F59E0B] outline-none text-sm"
                        >
                          <option value="Untuk Diketahui">Untuk Diketahui</option>
                          <option value="Perlu Tindak Lanjut Bidang Teknis">Perlu Tindak Lanjut Bidang Teknis</option>
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label htmlFor={`catatan-${lap.Row_Index}`} className="block text-sm font-bold text-[#0A2647] mb-1">Catatan Anda [{activeRole}]:</label>
                        <textarea 
                          id={`catatan-${lap.Row_Index}`} 
                          rows="2" 
                          value={lap._catatan_baru}
                          onChange={e => handleTextChange(lap.Row_Index, e.target.value)}
                          className="w-full p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#F59E0B] outline-none text-sm" 
                          placeholder="Ketik evaluasi spesifik dari Anda di sini..."
                        />
                      </div>
                    </div>
                    
                    <div className="text-right mt-2 border-t pt-4">
                      <button 
                        className={`font-bold py-2.5 px-6 rounded-lg transition shadow text-sm flex items-center justify-center ml-auto ${
                          savingRow === lap.Row_Index 
                            ? 'bg-amber-300 text-navy-dark cursor-not-allowed' 
                            : 'bg-[#F59E0B] hover:bg-[#D97706] text-[#0A2647]'
                        }`}
                        onClick={() => simpanCatatan(lap.Row_Index)}
                        disabled={savingRow !== null}
                      >
                        {savingRow === lap.Row_Index ? <><Loader2 className="animate-spin mr-2" size={16}/> Menyimpan...</> : <><Save className="mr-2" size={16}/> Simpan Evaluasi</>}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// Helper inside the component
function cleanText(str) {
  if (!str) return "";
  return str.toString().toLowerCase().replace(/\s+/g, ' ').trim();
}

export default MenuPimpinan;
