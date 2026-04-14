import { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../AppContext';
import { PieChart, Table, RefreshCw, Calendar, MapPin, ChevronLeft, ChevronRight } from 'lucide-react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

const Dashboard = () => {
  const { dashboardData, loadDashboardData, isDataLoading } = useAppContext();
  const [filterBidang, setFilterBidang] = useState('Semua');
  const [filterStatus, setFilterStatus] = useState('Semua');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const cleanText = (str) => (str ? str.toString().toLowerCase().replace(/\s+/g, ' ').trim() : "");
  const isPerluTindakLanjut = (str) => cleanText(str).includes('perlu tindak lanjut');

  // Compute stats
  const stats = useMemo(() => {
    const totalLaporan = dashboardData.length;
    const uniquePegawai = new Set(dashboardData.map(item => item['Nama Pegawai']).filter(n => n && n !== '-')).size;
    const totalDievaluasi = dashboardData.filter(item => item['Catatan Pimpinan'] && item['Catatan Pimpinan'].trim() !== '').length;
    return { totalLaporan, uniquePegawai, totalDievaluasi };
  }, [dashboardData]);

  // Compute charts data
  const chartsData = useMemo(() => {
    const countBidang = {};
    const countJenis = {};
    dashboardData.forEach(item => {
      const bidang = item['Bidang'] || 'Lainnya';
      const jenis = item['Jenis Penugasan'] || 'Lainnya';
      countBidang[bidang] = (countBidang[bidang] || 0) + 1;
      countJenis[jenis] = (countJenis[jenis] || 0) + 1;
    });

    return {
      bidangData: {
        labels: Object.keys(countBidang),
        datasets: [{
          data: Object.values(countBidang),
          backgroundColor: ['#1B3C73', '#F59E0B', '#2A5499', '#10B981', '#6B7280'],
          borderWidth: 0
        }]
      },
      jenisData: {
        labels: Object.keys(countJenis),
        datasets: [{
          label: 'Jumlah Penugasan',
          data: Object.values(countJenis),
          backgroundColor: '#1B3C73',
          borderRadius: 6
        }]
      }
    };
  }, [dashboardData]);

  // Filtered Table Data
  const filteredData = useMemo(() => {
    let data = dashboardData;
    if (filterBidang !== 'Semua') {
      const filterVal = cleanText(filterBidang);
      data = data.filter(item => cleanText(item['Bidang']) === filterVal);
    }
    if (filterStatus !== 'Semua') {
      const isFilterPerlu = cleanText(filterStatus).includes('perlu tindak lanjut');
      data = data.filter(item => isFilterPerlu ? isPerluTindakLanjut(item['Status Tindak Lanjut']) : !isPerluTindakLanjut(item['Status Tindak Lanjut']));
    }
    return data;
  }, [dashboardData, filterBidang, filterStatus]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(start, start + itemsPerPage);
  }, [filteredData, currentPage]);

  // Reset page on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterBidang, filterStatus]);

  return (
    <div className="space-y-6 pt-16 lg:pt-0">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
        <h2 className="text-2xl font-bold text-[#1B3C73] flex items-center">
          <PieChart className="mr-3 text-[#F59E0B]" size={28} /> Statistik Laporan ASN
        </h2>
        <button 
          onClick={loadDashboardData} 
          disabled={isDataLoading}
          className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-semibold hover:bg-gray-50 transition shadow-sm text-gray-700 flex items-center outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${isDataLoading ? 'animate-spin' : ''}`} />
          Segarkan Data
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 border-l-4 border-l-[#1B3C73] flex flex-col justify-center">
          <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1">Total Penugasan</p>
          <h3 className="text-4xl font-extrabold text-[#0A2647]">{stats.totalLaporan}</h3>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 border-l-4 border-l-[#F59E0B] flex flex-col justify-center">
          <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1">Pegawai Terlibat</p>
          <h3 className="text-4xl font-extrabold text-[#0A2647]">{stats.uniquePegawai}</h3>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 border-l-4 border-l-green-500 flex flex-col justify-center">
          <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1">Telah Dievaluasi</p>
          <h3 className="text-4xl font-extrabold text-[#0A2647]">{stats.totalDievaluasi}</h3>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <h3 className="font-bold text-[#1B3C73] mb-6 text-center">Distribusi per Bidang</h3>
          <div className="relative h-64 w-full">
            <Doughnut data={chartsData.bidangData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }} />
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <h3 className="font-bold text-[#1B3C73] mb-6 text-center">Berdasarkan Jenis Kegiatan</h3>
          <div className="relative h-64 w-full">
            <Bar data={chartsData.jenisData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }} />
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 mt-6 overflow-hidden">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <h3 className="font-bold text-[#1B3C73] text-lg flex items-center"><Table className="mr-2" size={20} /> Rincian Data Penugasan</h3>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <select 
              value={filterBidang} onChange={e => setFilterBidang(e.target.value)}
              className="px-4 py-2 rounded-xl border border-gray-300 text-sm focus:ring-2 focus:ring-[#2A5499] outline-none bg-gray-50 font-medium"
              aria-label="Filter Bidang"
            >
              <option value="Semua">Semua Bidang</option>
              <option value="Sekretariat">Sekretariat</option>
              <option value="Bidang PPTK">Bidang PPTK</option>
              <option value="Bidang Hubungan Industrial">Bidang Hubungan Industrial</option>
            </select>
            <select 
              value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="px-4 py-2 rounded-xl border border-gray-300 text-sm focus:ring-2 focus:ring-[#2A5499] outline-none bg-gray-50 font-medium"
              aria-label="Filter Status"
            >
              <option value="Semua">Semua Status</option>
              <option value="Untuk Diketahui">Untuk Diketahui</option>
              <option value="Perlu Tindak Lanjut Bidang Teknis">Perlu Tindak Lanjut</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#1B3C73] text-white text-sm">
                <th className="p-4 font-semibold whitespace-nowrap text-center">No</th>
                <th className="p-4 font-semibold whitespace-nowrap">Tanggal Kegiatan</th>
                <th className="p-4 font-semibold whitespace-nowrap">Nama Pegawai</th>
                <th className="p-4 font-semibold whitespace-nowrap">Bidang</th>
                <th className="p-4 font-semibold min-w-[250px]">Nama Kegiatan</th>
                <th className="p-4 font-semibold whitespace-nowrap">Tempat</th>
                <th className="p-4 font-semibold whitespace-nowrap text-center">Status</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-8 text-gray-500 font-medium bg-gray-50">
                    Tidak ada data yang sesuai dengan filter saat ini.
                  </td>
                </tr>
              ) : (
                paginatedData.map((item, idx) => {
                  const isPerlu = isPerluTindakLanjut(item['Status Tindak Lanjut']);
                  const globalIdx = (currentPage - 1) * itemsPerPage + idx + 1;
                  return (
                    <tr key={idx} className={`border-b border-amber-500/30 hover:bg-amber-100 transition duration-200 ${idx % 2 === 0 ? 'bg-amber-50' : 'bg-white'}`}>
                      <td className="p-3 font-bold text-center text-gray-700">{globalIdx}</td>
                      <td className="p-3 whitespace-nowrap font-medium text-gray-700"><Calendar className="inline mr-1 opacity-70" size={14} /> {item['Tanggal Kegiatan'] || '-'}</td>
                      <td className="p-3 whitespace-nowrap font-bold tracking-wide text-gray-800">{item['Nama Pegawai'] || '-'}</td>
                      <td className="p-3 whitespace-nowrap text-gray-700">{item['Bidang'] || '-'}</td>
                      <td className="p-3 font-medium text-gray-800">{item['Nama Kegiatan'] || '-'}</td>
                      <td className="p-3 text-gray-700"><MapPin className="inline mr-1 text-gray-400" size={14}/> {item['Tempat Kegiatan'] || '-'}</td>
                      <td className="p-3 text-center">
                        {!isPerlu ? (
                          <span className="px-2 py-1 bg-green-100 text-green-800 rounded-md text-xs font-bold border border-green-300 shadow-sm whitespace-nowrap">Untuk Diketahui</span>
                        ) : (
                          <span className="px-2 py-1 bg-red-100 text-red-800 rounded-md text-xs font-bold border border-red-300 shadow-sm whitespace-nowrap">Perlu Tindak Lanjut</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {filteredData.length > itemsPerPage && (
          <div className="flex flex-col sm:flex-row justify-between items-center mt-6 gap-4">
            <p className="text-sm text-gray-500 font-medium">
              Menampilkan <span className="text-[#1B3C73] font-bold">{(currentPage - 1) * itemsPerPage + 1}</span> - <span className="text-[#1B3C73] font-bold">{Math.min(currentPage * itemsPerPage, filteredData.length)}</span> dari <span className="text-[#1B3C73] font-bold">{filteredData.length}</span> data
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition outline-none focus:ring-2 focus:ring-amber-500"
                aria-label="Halaman Sebelumnya"
              >
                <ChevronLeft size={20} />
              </button>
              
              <div className="flex items-center gap-1">
                {[...Array(totalPages)].map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentPage(i+1)}
                    className={`w-8 h-8 rounded-lg text-sm font-bold transition outline-none focus:ring-2 focus:ring-amber-500 ${currentPage === i + 1 ? 'bg-[#1B3C73] text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition outline-none focus:ring-2 focus:ring-amber-500"
                aria-label="Halaman Selanjutnya"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
