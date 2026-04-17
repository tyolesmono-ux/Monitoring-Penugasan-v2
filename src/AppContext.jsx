import { createContext, useContext, useState, useEffect } from 'react';
import Swal from 'sweetalert2';

export const API_URL = "https://script.google.com/macros/s/AKfycbwSoiavkjfPYR1PH-y80nALsMifs3Gm3swv548RsXKAEE2SDCSPJoe5FzRf391j5tMR/exec";

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [pegawaiList, setPegawaiList] = useState([]);
  const [dashboardData, setDashboardData] = useState([]);
  const [isDataLoading, setIsDataLoading] = useState(false);
  
  // Custom fetch function
  const fetchData = async (action, additionalParams = '') => {
    try {
      const response = await fetch(`${API_URL}?action=${action}${additionalParams}`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Error fetching ${action}:`, error);
      return { status: 'error', message: error.message };
    }
  };

  const loadPegawai = async () => {
    const data = await fetchData('getPegawai');
    if (data.status === 'success') {
      setPegawaiList(data.data);
    }
  };

  const loadDashboardData = async () => {
    setIsDataLoading(true);
    const data = await fetchData('getLaporan');
    if (data.status === 'success') {
      setDashboardData(data.data);
    }
    setIsDataLoading(false);
  };

  useEffect(() => {
    loadPegawai();
    loadDashboardData();
  }, []);

  return (
    <AppContext.Provider value={{
      activeTab, setActiveTab,
      pegawaiList,
      dashboardData, loadDashboardData,
      isDataLoading, setIsDataLoading,
      fetchData
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => useContext(AppContext);
