import { Loader2 } from 'lucide-react';

const LoaderOverlay = () => {
  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/40 backdrop-blur-sm no-print" role="alert" aria-busy="true">
      <div className="bg-white p-6 rounded-2xl shadow-xl flex flex-col items-center text-center max-w-sm w-11/12">
        <Loader2 className="animate-spin text-amber-main mb-4" size={48} />
        <h3 className="text-xl font-bold text-navy-main mb-2">Memuat Data</h3>
        <p className="text-gray-500 text-sm">Mohon tunggu sebentar, sedang menyinkronkan data dengan sistem...</p>
      </div>
    </div>
  );
};

export default LoaderOverlay;
