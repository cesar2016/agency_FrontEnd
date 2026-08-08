import { useState, useEffect, useRef } from 'react';
import { Outlet, Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { FiLogOut, FiDollarSign, FiTrendingUp, FiHome, FiCheckCircle, FiMenu, FiX, FiList, FiGrid, FiChevronDown, FiUsers, FiPercent } from 'react-icons/fi';

const SCRAPER_LINKS = [
  { to: '/scraper-dashboard/scrapear.html', label: 'Scraper' },
  { to: '/scraper-dashboard/admin.html', label: 'Admin' },
  { to: '/horarios', label: 'Horarios' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const roles = Array.isArray(user?.roles) ? user.roles : [];
  const isAdmin = roles.some((r) => ['admin', 'super_admin'].includes(r));
  const isSuperAdmin = roles.includes('super_admin');
  const isPasador = roles.includes('usuario') && !isAdmin;
  const [menuOpen, setMenuOpen] = useState(false);
  const [scraperOpen, setScraperOpen] = useState(false);
  const scraperRef = useRef(null);
  const scraperActive = SCRAPER_LINKS.some((sl) => location.pathname.startsWith(sl.to));

  useEffect(() => {
    const handleClick = (e) => {
      if (scraperRef.current && !scraperRef.current.contains(e.target)) {
        setScraperOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const links = [
    { to: '/', label: 'Apuestas', icon: FiHome },
    { to: '/dashboard', label: 'Dashboard', icon: FiTrendingUp },
    { to: '/extracts/scrape', label: 'Extractos', icon: FiList },
    { to: '/aciertos', label: 'Aciertos', icon: FiCheckCircle },
    ...(isAdmin ? [
      { to: '/cash-register', label: 'Arqueo', icon: FiDollarSign },
      { to: '/comisiones', label: 'Comisiones', icon: FiPercent },
      { to: '/users', label: 'Usuarios', icon: FiUsers },
    ] : []),
    ...(isPasador ? [
      { to: '/comision', label: 'Comisión', icon: FiPercent },
    ] : []),
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="relative z-10 bg-gray-900/80 backdrop-blur-sm border-b border-indigo-500/20 px-4 py-3 flex items-center justify-between">
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
          <div className="hidden md:flex gap-1">
            {links.map((l) =>
              l.external ? (
                <a key={l.to} href={l.to} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-gray-300 hover:text-indigo-300 text-sm transition px-2 py-1.5 rounded-lg">
                  <l.icon size={16} /> {l.label}
                </a>
              ) : (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.to === '/'}
                  className={({ isActive }) =>
                    `flex items-center gap-1 text-sm transition px-2 py-1.5 rounded-lg ${
                      isActive
                        ? 'bg-indigo-500/20 text-indigo-300 font-semibold'
                        : 'text-gray-300 hover:text-indigo-300 hover:bg-white/5'
                    }`
                  }
                >
                  <l.icon size={16} /> {l.label}
                </NavLink>
              )
            )}
            {isSuperAdmin && (
              <div className="relative" ref={scraperRef}>
                <button
                  onClick={() => setScraperOpen((v) => !v)}
                  className={`flex items-center gap-1 text-sm transition px-2 py-1.5 rounded-lg cursor-pointer ${
                    scraperActive
                      ? 'bg-indigo-500/20 text-indigo-300 font-semibold'
                      : 'text-gray-300 hover:text-indigo-300 hover:bg-white/5'
                  }`}
                >
                  <FiGrid size={16} /> Silo <FiChevronDown size={12} className={`transition ${scraperOpen ? 'rotate-180' : ''}`} />
                </button>
                {scraperOpen && (
                  <div className="absolute top-full right-0 mt-1 bg-gray-900 border border-indigo-500/20 rounded-xl shadow-2xl overflow-hidden min-w-[160px] z-50">
                    {SCRAPER_LINKS.map((sl) => {
                      const active = location.pathname.startsWith(sl.to);
                      return (
                        <Link key={sl.to} to={sl.to} className={`block px-4 py-2 text-sm transition ${active ? 'text-indigo-300 bg-indigo-500/20 font-semibold' : 'text-gray-300 hover:text-white hover:bg-indigo-600/20'}`} onClick={() => setScraperOpen(false)}>
                          {sl.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs sm:text-sm text-indigo-300 font-medium max-w-[120px] sm:max-w-none truncate" title={user?.name}>
            {user?.name}
          </span>
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
          <div className="flex flex-col px-4 py-3 gap-1">
            {links.map((l) =>
              l.external ? (
                <a key={l.to} href={l.to} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-gray-300 hover:text-indigo-300 text-sm transition py-2">
                  <l.icon size={16} /> {l.label}
                </a>
              ) : (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.to === '/'}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-2 text-sm transition py-2 px-2 rounded-lg ${
                      isActive
                        ? 'bg-indigo-500/20 text-indigo-300 font-semibold'
                        : 'text-gray-300 hover:text-indigo-300 hover:bg-white/5'
                    }`
                  }
                >
                  <l.icon size={16} /> {l.label}
                </NavLink>
              )
            )}
            {isSuperAdmin && (
              <div className="pt-2 mt-2 border-t border-gray-700/50">
                <span className="text-xs text-gray-500 px-2 block mb-1">Dashboard Python</span>
                {SCRAPER_LINKS.map((sl) => {
                  const active = location.pathname.startsWith(sl.to);
                  return (
                    <Link key={sl.to} to={sl.to} className={`flex items-center gap-2 text-sm transition py-2 px-2 rounded-lg ${active ? 'bg-indigo-500/20 text-indigo-300 font-semibold' : 'text-gray-300 hover:text-indigo-300 hover:bg-white/5'}`} onClick={() => setMenuOpen(false)}>
                      {sl.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
      <main className="flex-1 p-4 md:p-6">
        <Outlet />
      </main>
    </div>
  );
}
