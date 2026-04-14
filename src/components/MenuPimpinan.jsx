import { useState, useRef, useEffect } from 'react';
import { useAppContext } from '../AppContext';
import { UserCheck, Lock, Eye, Save, Calendar, Check, Loader2, Image as ImageIcon, FileText } from 'lucide-react';
import Swal from 'sweetalert2';

const MenuPimpinan = () => {
  const { pegawaiList, fetchData, loadDashboardData } = useAppContext();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pin, setPin] = useState('');
  const [selectedPegawai, setSelectedPegawai] = useState('');
  const [laporanList, setLaporanList] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchMsg, setSearchMsg] = useState('');
  const [savingRow, setSavingRow] = useState(null);
  
  const pinInputRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated && pinInputRef.current) {
      pinInputRef.current.focus();
    }
  }, [isAuthenticated]);

  const handlePinSubmit = (e) => {
    e.preventDefault();
    if (pin === "123456") {
      setIsAuthenticated(true);
      setPin('');
    } else {
      Swal.fire({icon: 'error', title: 'Akses Ditolak', text: 'PIN Salah!'});
      setPin('');
    }
  };

  const cariLaporan = async () => {
    if (!selectedPegawai) {
      Swal.fire('Pilih nama pegawai dulu!');
      return;
    }
    setIsLoading(true);
    setSearchMsg('');
    setLaporanList([]);

    const data = await fetchData(`getLaporan&nama=${encodeURIComponent(selectedPegawai)}`);
    if (data.status === 'success' && data.data.length > 0) {
      // Manage local state for form inputs per row
      const enhancedData = data.data.map(lap => ({
        ...lap,
        _status: lap['Status Tindak Lanjut'] || 'Untuk Diketahui',
        _catatan: lap['Catatan Pimpinan'] || ''
      }));
      setLaporanList(enhancedData);
    } else {
      setSearchMsg('Belum ada data.');
    }
    setIsLoading(false);
  };

  const handleSelectChange = (rowIndex, value) => {
    setLaporanList(prev => prev.map(lap => lap.Row_Index === rowIndex ? { ...lap, _status: value } : lap));
  };

  const handleTextChange = (rowIndex, value) => {
    setLaporanList(prev => prev.map(lap => lap.Row_Index === rowIndex ? { ...lap, _catatan: value } : lap));
  };

  const simpanCatatan = async (rowIndex) => {
    const lap = laporanList.find(l => l.Row_Index === rowIndex);
    if(!lap) return;

    setSavingRow(rowIndex);
    
    const res = await fetchData(`updatePimpinan&row=${rowIndex}&status=${encodeURIComponent(lap._status)}&catatan=${encodeURIComponent(lap._catatan)}`);
    
    if (res.status === 'success') {
      Swal.fire({ title: 'Tersimpan!', icon: 'success', timer: 1500, showConfirmButton: false });
      loadDashboardData(); // update background data silently
    } else {
      Swal.fire('Error', 'Terjadi kesalahan koneksi.', 'error');
    }
    
    setSavingRow(null);
  };

  // Helper Component for Drive Thumbnails
  const DriveThumbnail = ({ url, index, isMultiple }) => {
    const [hasError, setHasError] = useState(false);
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

    return (
      <a href={url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-gray-200 hover:shadow-lg transition group outline-none focus:ring-2 focus:ring-[#1B3C73]">
        {!hasError ? (
          <img 
            src={imgSrc} 
            className="w-full h-40 object-cover group-hover:scale-105 transition duration-300" 
            onError={() => setHasError(true)}
            alt={`Dokumentasi ${index + 1}`}
          />
        ) : (
          <div className="flex flex-col items-center justify-center w-full h-40 bg-blue-50 text-blue-600">
            <ImageIcon size={32} className="mb-2"/>
            <span className="font-semibold text-sm text-center px-2">Buka Gambar {isMultiple ? index + 1 : ''}</span>
          </div>
        )}
      </a>
    );
  };

  const formatFileLink = (urlStr, type) => {
    if (!urlStr || urlStr === '-' || urlStr.trim() === '') return <span className="text-gray-400 text-sm italic">Tidak ada file</span>;
    
    // Support for multiple URLs separated by space, newline or comma
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

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] pt-16 lg:pt-0">
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-200 w-[90%] max-w-sm text-center transform transition-all scale-100">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4 text-[#F59E0B] text-3xl">
            <Lock />
          </div>
          <h3 className="text-2xl font-bold text-[#1B3C73] mb-2">Akses Pimpinan</h3>
          <p className="text-gray-500 text-sm mb-6">Masukkan PIN otorisasi Anda</p>
          <form onSubmit={handlePinSubmit}>
            <input 
              ref={pinInputRef}
              type="password" 
              value={pin}
              onChange={e => setPin(e.target.value)}
              className="w-full px-4 py-4 mb-6 border-2 border-gray-200 rounded-xl text-center text-2xl tracking-[0.5em] bg-gray-50 text-[#0A2647] focus:border-[#F59E0B] focus:ring-0 outline-none transition" 
              placeholder="••••••" 
            />
            <button type="submit" className="w-full py-3 bg-[#F59E0B] hover:bg-[#D97706] text-[#0A2647] font-bold rounded-xl transition shadow-md outline-none focus:ring-4 focus:ring-amber-200">
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
        <div className="flex items-center mb-6 border-b pb-4">
          <UserCheck className="text-2xl text-[#F59E0B] mr-3" size={32} />
          <div>
            <h2 className="text-xl font-bold text-[#1B3C73]">Panel Evaluasi Pimpinan</h2>
            <p className="text-sm text-gray-500">Tinjau kegiatan dan berikan evaluasi akhir untuk pegawai.</p>
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="flex-grow">
            <label htmlFor="select-pegawai-pim" className="block text-sm font-semibold text-gray-700 mb-2">Pilih Pegawai</label>
            <select 
              id="select-pegawai-pim" 
              value={selectedPegawai} 
              onChange={e => setSelectedPegawai(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#F59E0B] outline-none bg-gray-50"
            >
              <option value="">-- Pilih Pegawai --</option>
              {pegawaiList.map((p, i) => <option key={i} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <button 
              onClick={cariLaporan} 
              disabled={isLoading}
              className="w-full md:w-auto bg-[#F59E0B] hover:bg-[#D97706] text-[#0A2647] font-bold py-3 px-8 rounded-xl transition shadow-md flex items-center justify-center disabled:opacity-75"
            >
              {isLoading ? <Loader2 className="animate-spin mr-2" /> : <Eye className="mr-2" size={18} />} Tampilkan Data
            </button>
          </div>
        </div>
        
        {searchMsg && <div className="text-center font-medium text-amber-600 my-4">{searchMsg}</div>}

        <div className="space-y-6">
          {laporanList.map((lap) => {
            const isNeedAction = cleanText(lap._status).includes('perlu tindak lanjut');
            return (
              <div key={lap.Row_Index} className="bg-gray-50 border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-amber-300 transition-shadow">
                <div className="bg-white px-5 py-4 border-b border-gray-200 flex flex-col md:flex-row justify-between md:items-center gap-2">
                  <div>
                    <h3 className="font-bold text-[#0A2647] text-lg">{lap['Nama Kegiatan'] || '-'}</h3>
                    <div className="text-sm text-gray-500 mt-1 flex items-center gap-2">
                      <Calendar size={14} /> {lap['Tanggal Kegiatan'] || '-'} | <strong className="font-semibold">{lap['Jenis Penugasan']}</strong>
                    </div>
                  </div>
                </div>
                
                <div className="p-5 space-y-4">
                  <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100">
                    <h4 className="font-bold text-[#1B3C73] text-sm mb-2">Hasil Kegiatan:</h4>
                    <p className="text-gray-700 text-sm whitespace-pre-wrap">{lap['Catatan Hasil Kegiatan'] || '-'}</p>
                  </div>
                  
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
                      <label htmlFor={`catatan-${lap.Row_Index}`} className="block text-sm font-bold text-[#0A2647] mb-1">Catatan Pimpinan:</label>
                      <textarea 
                        id={`catatan-${lap.Row_Index}`} 
                        rows="2" 
                        value={lap._catatan}
                        onChange={e => handleTextChange(lap.Row_Index, e.target.value)}
                        className="w-full p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#F59E0B] outline-none text-sm" 
                        placeholder="Ketik arahan di sini..."
                      />
                    </div>
                  </div>
                  
                  <div className="text-right mt-2">
                    <button 
                      className={`font-bold py-2.5 px-6 rounded-lg transition shadow-sm text-sm flex items-center justify-center ml-auto ${
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
