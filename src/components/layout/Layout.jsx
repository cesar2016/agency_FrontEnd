import { useState } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { FiLogOut, FiDollarSign, FiTrendingUp, FiHome, FiCheckCircle, FiClock, FiMenu, FiX, FiList } from 'react-icons/fi';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const roles = Array.isArray(user?.roles) ? user.roles : [];
  const isAdmin = roles.some((r) => ['admin', 'super_admin'].includes(r));
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const links = [
    { to: '/', label: 'Apuestas', icon: FiHome },
    { to: '/horarios', label: 'Horarios', icon: FiClock },
    ...(isAdmin ? [
      { to: '/dashboard', label: 'Dashboard', icon: FiTrendingUp },
      { to: '/aciertos', label: 'Aciertos', icon: FiCheckCircle },
      { to: '/extracts/scrape', label: 'Extractos', icon: FiList },
      { to: '/cash-register', label: 'Arqueo', icon: FiDollarSign },
    ] : []),
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="bg-gray-900/80 backdrop-blur-sm border-b border-indigo-500/20 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 md:gap-6">
          <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden text-gray-300 hover:text-white transition p-1 -ml-1">
            {menuOpen ? <FiX size={22} /> : <FiMenu size={22} />}
          </button>
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="Agencia" className="h-8 w-auto" />
            <span className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              AGENCIA
            </span>
          </Link>
          <div className="hidden md:flex gap-4">
            {links.map((l) => (
              <Link key={l.to} to={l.to} className="flex items-center gap-1 text-gray-300 hover:text-indigo-300 text-sm transition">
                <l.icon size={16} /> {l.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline text-sm text-indigo-300">{user?.name}</span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 text-sm text-gray-400 hover:text-red-400 transition p-1"
            title="Cerrar sesion"
          >
            <FiLogOut size={16} />
          </button>
        </div>
      </nav>
      {menuOpen && (
        <div className="md:hidden bg-gray-900/95 backdrop-blur-sm border-b border-indigo-500/20">
          <div className="flex flex-col px-4 pb-3 gap-1">
            <span className="text-sm text-indigo-300 pt-1 pb-2 sm:hidden">{user?.name}</span>
            {links.map((l) => (
              <Link key={l.to} to={l.to} className="flex items-center gap-2 text-gray-300 hover:text-indigo-300 text-sm transition py-2" onClick={() => setMenuOpen(false)}>
                <l.icon size={16} /> {l.label}
              </Link>
            ))}
          </div>
        </div>
      )}
      <main className="flex-1 p-4 md:p-6">
        <Outlet />
      </main>
    </div>
  );
}
