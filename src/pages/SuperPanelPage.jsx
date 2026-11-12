import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import CajaModal from '../components/CajaModal';
import { FiRefreshCw, FiSearch, FiDollarSign, FiClock, FiActivity } from 'react-icons/fi';

const todayAR = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });

const money = (n) =>
  Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatLastLogin = (iso) => {
  if (!iso) return 'Sin registro';
  try {
    return new Date(iso).toLocaleString('es-AR', {
      timeZone: 'America/Argentina/Buenos_Aires',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
};

const ROLE_LABELS = {
  super_admin: { label: 'Super Admin', cls: 'bg-purple-500/20 text-purple-300' },
  admin: { label: 'Admin', cls: 'bg-indigo-500/20 text-indigo-300' },
  usuario: { label: 'Pasador', cls: 'bg-gray-600/30 text-gray-300' },
};

export default function SuperPanelPage({ embedded = false }) {
  const [date, setDate] = useState(todayAR);
  const [search, setSearch] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cajaUser, setCajaUser] = useState(null);

  const loadPanel = useCallback(async (targetDate, force = false) => {
    setLoading(true);
    setError('');
    try {
      const params = { date: targetDate };
      if (force) params._t = Date.now();
      const { data: res } = await api.get('/users/super-panel', { params });
      setData(res?.data || null);
    } catch (e) {
      setError(e?.response?.data?.message || 'Error al cargar el panel.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPanel(date);
  }, [date, loadPanel]);

  const users = (data?.users || []).filter((u) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      u.name?.toLowerCase().includes(q) ||
      u.username?.toLowerCase().includes(q) ||
      u.parent_name?.toLowerCase().includes(q)
    );
  });

  const totales = data?.totales || {
    total_ventas: 0,
    comision: 0,
    total_premios: 0,
    saldo_actual: 0,
  };

  return (
    <div className={embedded ? 'space-y-5' : 'max-w-6xl mx-auto space-y-5'}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FiActivity className="text-indigo-400" /> Panel Super Admin
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Última sesión y arqueo de caja por usuario
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar usuario..."
              className="bg-gray-800/70 border border-gray-700 rounded-lg pl-8 pr-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="bg-gray-800/70 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
          />
          <button
            type="button"
            onClick={() => loadPanel(date, true)}
            disabled={loading}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-sm transition cursor-pointer"
          >
            <FiRefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Actualizar
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-gray-800/40 border border-indigo-500/10 rounded-xl p-4">
          <p className="text-xs text-gray-400">Ventas ({date})</p>
          <p className="text-lg font-bold text-white mt-1">${money(totales.total_ventas)}</p>
        </div>
        <div className="bg-gray-800/40 border border-indigo-500/10 rounded-xl p-4">
          <p className="text-xs text-gray-400">Comisiones</p>
          <p className="text-lg font-bold text-indigo-300 mt-1">${money(totales.comision)}</p>
        </div>
        <div className="bg-gray-800/40 border border-indigo-500/10 rounded-xl p-4">
          <p className="text-xs text-gray-400">Premios</p>
          <p className="text-lg font-bold text-red-400 mt-1">${money(totales.total_premios)}</p>
        </div>
        <div className="bg-gray-800/40 border border-indigo-500/10 rounded-xl p-4">
          <p className="text-xs text-gray-400">Saldo Neto</p>
          <p
            className={`text-lg font-bold mt-1 ${
              totales.saldo_actual > 0
                ? 'text-emerald-400'
                : totales.saldo_actual < 0
                ? 'text-red-400'
                : 'text-white'
            }`}
          >
            ${money(totales.saldo_actual)}
          </p>
        </div>
      </div>

      <div className="bg-gray-800/40 backdrop-blur-sm border border-indigo-500/10 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-900/60 text-xs uppercase text-gray-400 border-b border-gray-700/50">
              <tr>
                <th className="px-4 py-3">Usuario</th>
                <th className="px-4 py-3">Última sesión</th>
                <th className="px-4 py-3 text-right">Jugadas</th>
                <th className="px-4 py-3 text-right">Ventas</th>
                <th className="px-4 py-3 text-right">Comisión</th>
                <th className="px-4 py-3 text-right">Premios</th>
                <th className="px-4 py-3 text-right">Saldo</th>
                <th className="px-4 py-3 text-right">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/40">
              {loading && !data ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                    <FiRefreshCw className="animate-spin inline mr-2 text-indigo-400" />
                    Cargando usuarios...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                    No se encontraron usuarios.
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const roleKey = u.roles?.[0] || 'usuario';
                  const roleMeta = ROLE_LABELS[roleKey] || ROLE_LABELS.usuario;
                  return (
                    <tr key={u.id} className="hover:bg-white/[0.02] transition">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${u.is_active ? 'text-white' : 'text-gray-500 line-through'}`}>
                            {u.name}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${roleMeta.cls}`}>
                            {roleMeta.label}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 font-mono">
                          @{u.username}
                          {u.parent_name ? ` · de ${u.parent_name}` : ''}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 text-xs ${u.last_login_at ? 'text-gray-200' : 'text-gray-500'}`}>
                          <FiClock size={13} className={u.last_login_at ? 'text-indigo-400' : 'text-gray-600'} />
                          {formatLastLogin(u.last_login_at)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-300 tabular-nums">
                        {u.cantidad_jugadas}
                      </td>
                      <td className="px-4 py-3 text-right text-white font-medium tabular-nums">
                        ${money(u.total_ventas)}
                      </td>
                      <td className="px-4 py-3 text-right text-indigo-300 tabular-nums">
                        ${money(u.comision)}
                      </td>
                      <td className="px-4 py-3 text-right text-red-400 tabular-nums">
                        ${money(u.total_premios)}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-semibold tabular-nums ${
                          u.saldo_actual > 0
                            ? 'text-emerald-400'
                            : u.saldo_actual < 0
                            ? 'text-red-400'
                            : 'text-gray-300'
                        }`}
                      >
                        ${money(u.saldo_actual)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setCajaUser(u)}
                          className="inline-flex items-center gap-1 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 px-2.5 py-1 rounded-lg text-xs transition cursor-pointer"
                          title="Ver detalle de caja"
                        >
                          <FiDollarSign size={13} /> Caja
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CajaModal
        user={cajaUser}
        open={!!cajaUser}
        initialDate={date}
        onClose={() => setCajaUser(null)}
        onError={(msg) => setError(msg)}
      />
    </div>
  );
}
