import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import SelectLotteryDraw from './pages/SelectLotteryDraw';
import PlaceBetPage from './pages/PlaceBetPage';

import AciertosPage from './pages/AciertosPage';
import HorariosPage from './pages/HorariosPage';
import DashboardPage from './pages/DashboardPage';
import ScrapeExtractsPage from './pages/ScrapeExtractsPage';
import ManualExtractPage from './pages/ManualExtractPage';
import CashRegisterPage from './pages/CashRegisterPage';
import ScraperDashboardPage from './pages/ScraperDashboardPage';
import Layout from './components/layout/Layout';

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen text-white">Cargando...</div>;
  if (!user) return <Navigate to="/login" />;
  const userRoles = Array.isArray(user.roles) ? user.roles : [];
  if (roles && !roles.some((r) => userRoles.includes(r))) return <Navigate to="/" />;
  return children;
}

export default function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-indigo-950 to-gray-900">
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<Layout />}>
          <Route path="/" element={<ProtectedRoute><SelectLotteryDraw /></ProtectedRoute>} />
          <Route path="/bet" element={<ProtectedRoute><PlaceBetPage /></ProtectedRoute>} />

          <Route path="/horarios" element={<ProtectedRoute><HorariosPage /></ProtectedRoute>} />
          <Route path="/aciertos" element={<ProtectedRoute roles={['admin', 'super_admin']}><AciertosPage /></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute roles={['admin', 'super_admin']}><DashboardPage /></ProtectedRoute>} />
          <Route path="/extracts/scrape" element={<ProtectedRoute roles={['admin', 'super_admin']}><ScrapeExtractsPage /></ProtectedRoute>} />
          <Route path="/extracts/manual" element={<ProtectedRoute roles={['admin', 'super_admin']}><ManualExtractPage /></ProtectedRoute>} />
          <Route path="/cash-register" element={<ProtectedRoute roles={['admin', 'super_admin']}><CashRegisterPage /></ProtectedRoute>} />
          <Route path="/scraper-dashboard/:path?" element={<ProtectedRoute roles={['admin', 'super_admin']}><ScraperDashboardPage /></ProtectedRoute>} />
        </Route>
      </Routes>
    </div>
  );
}
