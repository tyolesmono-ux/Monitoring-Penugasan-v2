import { useState, useRef } from 'react';
import { useAppContext, API_URL } from '../AppContext';
import { FileSignature, Camera, FileText, Send, Loader2 } from 'lucide-react';
import Swal from 'sweetalert2';
import LoaderOverlay from './LoaderOverlay';

const InputData = () => {
  const { pegawaiList, loadDashboardData } = useAppContext();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedBidang, setSelectedBidang] = useState('');
  const formRef = useRef(null);

  // Get unique bidang from pegawaiList dynamically, fallback if none
  const bidangOptions = [...new Set(pegawaiList.map(p => p['Bidang / Unit Kerja'] || p['Bidang']).filter(Boolean))];
  if (bidangOptions.length === 0) {
    bidangOptions.push("Sekretariat", "Bidang PPTK", "Bidang Hubungan Industrial");
  }

  // Filter pegawai based on selectedBidang
  const filteredPegawai = pegawaiList.filter(p => !selectedBidang || (p['Bidang / Unit Kerja'] || p['Bidang']) === selectedBidang);

  // Helper: Read a single file as Base64 string
  const getBase64 = (file) => {
    return new Promise((resolve, reject) => {
      if(!file) resolve(null);
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        let encoded = reader.result.toString().replace(/^data:(.*,)?/, '');
        if ((encoded.length % 4) > 0) {
          encoded += '='.repeat(4 - (encoded.length % 4));
        }
        resolve(encoded);
      };
      reader.onerror = error => reject(error);
    });
  };

  // Helper: Resize and compress image
  const compressImage = (file, maxSizeMB = 1) => {
    return new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith('image/')) { resolve(file); return; }
      if (file.size / 1024 / 1024 < maxSizeMB) { resolve(file); return; }

      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = event => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1200; 
          const MAX_HEIGHT = 1200;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
          } else {
            if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob((blob) => {
            const newFile = new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() });
            resolve(newFile);
          }, 'image/jpeg', 0.7); 
        };
        img.onerror = error => reject(error);
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    // Get all files from Documentation and Materi inputs
    const docsFileList = Array.from(e.target.file_dok.files);
    const materiFileList = Array.from(e.target.file_materi.files);

    setIsSubmitting(true);

    try {
      // Process Documentation (Images) with compression
      const docsPayload = await Promise.all(docsFileList.map(async (file) => {
        let processed = file;
        if (file.type.startsWith('image/')) {
          processed = await compressImage(file, 1);
        }
        const b64 = await getBase64(processed);
        return {
          base64: b64,
          name: processed.name,
          mime: processed.type
        };
      }));

      // Process Materi (PDF/Docx)
      const materiPayload = await Promise.all(materiFileList.map(async (file) => {
        const b64 = await getBase64(file);
        return {
          base64: b64,
          name: file.name,
          mime: file.type
        };
      }));

      const targetPegawai = pegawaiList.find(p => p['Nama Pegawai'] === formData.get('nama'));
      const jabatanPegawai = targetPegawai ? (targetPegawai['Jabatan'] || targetPegawai['Posisi'] || "") : "";

      const payload = {
        namaPegawai: formData.get('nama'),
        jabatan: jabatanPegawai,
        bidang: formData.get('bidang'),
        jenisPenugasan: formData.get('jenis'),
        tanggalKegiatan: formData.get('tanggal'),
        namaKegiatan: formData.get('kegiatan'),
        tempatKegiatan: formData.get('tempat'),
        penyelenggara: formData.get('penyelenggara'),
        tamuUndangan: formData.get('tamu'),
        catatanHasil: formData.get('catatan'),
        dokumentasi: docsPayload,
        materi: materiPayload
      };

      const response = await fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) });
      const result = await response.json();

      if (result.status === 'success') {
        Swal.fire({title: 'Berhasil!', text: 'Laporan tersimpan.', icon: 'success', confirmButtonColor: '#1B3C73'});
        formRef.current.reset();
        loadDashboardData(); 
      } else { throw new Error(result.message); }

    } catch (error) {
      console.error("Submission Error:", error);
      Swal.fire({title: 'Gagal Menyimpan', text: 'Pastikan koneksi internet stabil atau kurangi ukuran file.', icon: 'error', confirmButtonColor: '#1B3C73'});
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="pt-16 lg:pt-0 relative">
      {isSubmitting && <LoaderOverlay />}
      
      <div className={`bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden max-w-4xl mx-auto transition-all duration-300 ${isSubmitting ? 'blur-sm pointer-events-none' : ''}`}>
        <div className="bg-[#1B3C73] px-6 py-4 border-b border-gray-100">
          <h2 className="text-xl font-bold text-white flex items-center">
            <FileSignature className="mr-3 text-[#F59E0B]" size={24} /> Formulir Laporan Penugasan
          </h2>
        </div>
        
        <form ref={formRef} onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label htmlFor="in_bidang" className="block text-sm font-semibold text-gray-700">Bidang / Unit Kerja <span className="text-red-500">*</span></label>
              <select 
                name="bidang" 
                id="in_bidang" 
                required 
                value={selectedBidang}
                onChange={(e) => setSelectedBidang(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#2A5499] bg-gray-50 focus:bg-white transition outline-none"
              >
                <option value="">-- Pilih Bidang --</option>
                {bidangOptions.map((b, i) => <option key={i} value={b}>{b}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="in_nama" className="block text-sm font-semibold text-gray-700">Nama Pegawai <span className="text-red-500">*</span></label>
              <select name="nama" id="in_nama" required disabled={!selectedBidang} className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#2A5499] bg-gray-50 focus:bg-white transition outline-none disabled:bg-gray-200 disabled:cursor-not-allowed">
                <option value="">-- Pilih Nama Pegawai --</option>
                {filteredPegawai.map((p, i) => <option key={i} value={p['Nama Pegawai']}>{p['Nama Pegawai']}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label htmlFor="in_jenis" className="block text-sm font-semibold text-gray-700">Jenis Penugasan <span className="text-red-500">*</span></label>
              <select name="jenis" id="in_jenis" required className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#2A5499] bg-gray-50 focus:bg-white transition outline-none">
                <option value="">-- Pilih Jenis --</option>
                <option value="Rapat Koordinasi">Rapat Koordinasi</option>
                <option value="Sosialisasi / Bimtek">Sosialisasi / Bimtek</option>
                <option value="Monitoring & Evaluasi">Monitoring & Evaluasi</option>
                <option value="Kunjungan Kerja">Kunjungan Kerja</option>
                <option value="Lainnya">Lainnya</option>
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="in_tanggal" className="block text-sm font-semibold text-gray-700">Tanggal Kegiatan <span className="text-red-500">*</span></label>
              <input type="date" name="tanggal" id="in_tanggal" required className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#2A5499] bg-gray-50 focus:bg-white transition outline-none" />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="in_kegiatan" className="block text-sm font-semibold text-gray-700">Nama Kegiatan <span className="text-red-500">*</span></label>
            <input type="text" name="kegiatan" id="in_kegiatan" placeholder="Contoh: Rapat Evaluasi Kinerja Triwulan III" required className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#2A5499] bg-gray-50 focus:bg-white transition outline-none" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label htmlFor="in_tempat" className="block text-sm font-semibold text-gray-700">Tempat Kegiatan <span className="text-red-500">*</span></label>
              <input type="text" name="tempat" id="in_tempat" placeholder="Contoh: Hotel Solo Paragon" required className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#2A5499] bg-gray-50 focus:bg-white transition outline-none" />
            </div>
            <div className="space-y-2">
              <label htmlFor="in_penyelenggara" className="block text-sm font-semibold text-gray-700">Penyelenggara Kegiatan <span className="text-red-500">*</span></label>
              <input type="text" name="penyelenggara" id="in_penyelenggara" placeholder="Contoh: Disnaker Prov. Jateng" required className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#2A5499] bg-gray-50 focus:bg-white transition outline-none" />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="in_tamu" className="block text-sm font-semibold text-gray-700">Tamu Undangan / Peserta yang Hadir</label>
            <input type="text" name="tamu" id="in_tamu" placeholder="Contoh: Perwakilan OPD, Camat se-Surakarta" className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#2A5499] bg-gray-50 focus:bg-white transition outline-none" />
          </div>

          <div className="space-y-2">
            <label htmlFor="in_catatan" className="block text-sm font-semibold text-gray-700">Catatan Hasil Kegiatan <span className="text-red-500">*</span></label>
            <textarea name="catatan" id="in_catatan" rows="4" placeholder="Tuliskan poin-poin penting hasil kegiatan di sini..." required className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#2A5499] bg-gray-50 focus:bg-white transition outline-none resize-y"></textarea>
          </div>

          <div className="bg-blue-50/50 p-6 rounded-xl border border-blue-100 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label htmlFor="in_file_dok" className="block text-sm font-bold text-[#1B3C73] flex items-center gap-1"><Camera size={16}/> Dokumentasi (Foto)</label>
              <input multiple type="file" name="file_dok" id="in_file_dok" accept="image/*" className="w-full text-sm text-gray-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#1B3C73] file:text-white hover:file:bg-[#0A2647] cursor-pointer border border-dashed border-gray-300 rounded-xl p-2 bg-white outline-none focus:ring-2 focus:ring-[#1B3C73]" />
              <p className="text-xs text-gray-500 mt-1">Bisa pilih lebih dari 1 foto. Sistem otomatis mengompres.</p>
            </div>
            <div className="space-y-2">
              <label htmlFor="in_file_materi" className="block text-sm font-bold text-[#1B3C73] flex items-center gap-1"><FileText size={16}/> Materi (PDF/Docx) <span className="text-xs font-normal text-gray-500">- Opsional</span></label>
              <input multiple type="file" name="file_materi" id="in_file_materi" accept=".pdf,.doc,.docx" className="w-full text-sm text-gray-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-gray-200 file:text-gray-700 hover:file:bg-gray-300 cursor-pointer border border-dashed border-gray-300 rounded-xl p-2 bg-white outline-none focus:ring-2 focus:ring-[#1B3C73]" />
              <p className="text-xs text-gray-500 mt-1">Bisa pilih lebih dari 1 file. Maks 5MB/file.</p>
            </div>
          </div>

          <button type="submit" disabled={isSubmitting} className="w-full bg-[#1B3C73] text-white py-4 rounded-xl font-bold text-lg hover:bg-[#0A2647] disabled:opacity-70 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl flex justify-center items-center gap-2 outline-none focus:ring-4 focus:ring-blue-300">
            {isSubmitting ? <><Loader2 className="animate-spin" /> Sedang Memproses...</> : <><Send /> Kirim Laporan Penugasan</>}
          </button>
        </form>
      </div>
    </div>
  );
};

export default InputData;
