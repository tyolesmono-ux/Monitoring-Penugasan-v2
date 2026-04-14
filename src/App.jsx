import { AppProvider, useAppContext } from './AppContext';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import InputData from './components/InputData';
import Cetak from './components/Cetak';
import MenuPimpinan from './components/MenuPimpinan';
import LoaderOverlay from './components/LoaderOverlay';

const MainContent = () => {
  const { activeTab, isDataLoading } = useAppContext();

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 text-gray-800">
      <Sidebar />
      <main className="flex-1 overflow-y-auto relative no-print">
        {isDataLoading && activeTab === 'dashboard' && <LoaderOverlay />}
        
        <div className={`p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto transition-all duration-300 ${isDataLoading && activeTab === 'dashboard' ? 'blur-sm pointer-events-none' : ''}`}>
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div key="dashboard" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }}>
                <Dashboard />
              </motion.div>
            )}
            {activeTab === 'input' && (
              <motion.div key="input" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }}>
                <InputData />
              </motion.div>
            )}
            {activeTab === 'cetak' && (
              <motion.div key="cetak" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }}>
                <Cetak />
              </motion.div>
            )}
            {activeTab === 'pimpinan' && (
              <motion.div key="pimpinan" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }}>
                <MenuPimpinan />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
    {/* Area Cetak Khusus - Berada di luar container flex h-screen agar tidak terpotong saat diprint */}
    <div id="area-cetak"></div>
  );
};

function App() {
  return (
    <AppProvider>
      <MainContent />
    </AppProvider>
  );
}

export default App;
