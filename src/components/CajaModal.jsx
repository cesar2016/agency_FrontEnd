import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';
import { FiRefreshCw, FiX, FiDollarSign } from 'react-icons/fi';

const todayAR = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });

const money = (n) =>
  Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Modal Caja del pasador (ventas, comisión, premios, detalle ganadoras).
 */
export default function CajaModal({ user, open, onClose, onError }) {
  const [cajaDate, setCajaDate] = useState(todayAR());
  const [cajaData, setCajaData] = useState(null);
  const [cajaLoading, setCajaLoading] = useState(false);
  const [ganadorasOpen, setGanadorasOpen] = useState(false);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const loadCaja = useCallback(async (userId, date) => {
    if (!userId) return;
    setCajaLoading(true);
    try {
      const { data } = await api.get(`/users/${userId}/caja`, {
        params: { date, _t: Date.now() },
      });
      setCajaData(data?.data || null);
    } catch (e) {
      setCajaData(null);
      onErrorRef.current?.(e?.response?.data?.message || 'Error al cargar caja');
    } finally {
      setCajaLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open || !user?.id) return;
    const date = todayAR();
    setCajaDate(date);
    setCajaData(null);
    setGanadorasOpen(false);
    loadCaja(user.id, date);
  }, [open, user?.id, loadCaja]);

  if (!open || !user) return null;

  const isAdmin = cajaData?.is_admin ?? (
    Array.isArray(user?.roles)
      ? user.roles.some((r) => (typeof r === 'string' ? r : r?.name) === 'admin' || (typeof r === 'string' ? r : r?.name) === 'super_admin')
      : user?.role === 'admin' || user?.role === 'super_admin'
  );

  const handleClose = () => {
    setGanadorasOpen(false);
    onClose?.();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={handleClose}>
        <div
          className="bg-gray-800 border border-indigo-500/20 rounded-2xl w-full max-w-lg shadow-2xl p-6 max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between mb-4 gap-3">
            <div>
              <h3 className="text-white font-semibold flex items-center gap-2">
                <FiDollarSign className="text-emerald-400" /> Caja
              </h3>
              <p className="text-sm text-indigo-300 mt-0.5">{user.name}</p>
              {user.username && (
                <p className="text-xs text-gray-500 font-mono">@{user.username}</p>
              )}
            </div>
            <button onClick={handleClose} className="text-gray-400 hover:text-white transition">
              <FiX size={18} />
            </button>
          </div>

          <div className="flex gap-2 items-end mb-4">
            <div className="flex-1">
              <label className="block text-xs text-gray-400 mb-1">Fecha</label>
              <input
                type="date"
                value={cajaDate}
                onChange={(e) => {
                  const d = e.target.value;
                  setCajaDate(d);
                  loadCaja(user.id, d);
                }}
                className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
            <button
              type="button"
              onClick={() => loadCaja(user.id, cajaDate)}
              className="flex items-center gap-1 bg-gray-700 hover:bg-gray-600 text-gray-200 px-3 py-1.5 rounded-lg text-sm transition"
            >
              <FiRefreshCw size={14} className={cajaLoading ? 'animate-spin' : ''} />
            </button>
          </div>

          {cajaLoading && !cajaData ? (
            <div className="flex justify-center py-12">
              <FiRefreshCw className="animate-spin text-indigo-400" size={28} />
            </div>
          ) : cajaData ? (
            <div className="space-y-4">
              <div className="bg-gray-900/50 border border-gray-700/50 rounded-xl p-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Cierre de ayer</span>
                  <span className={`font-medium ${cajaData.cierre_ayer > 0 ? 'text-amber-400' : 'text-white'}`}>
                    ${money(cajaData.cierre_ayer)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Ajuste / Entregas hoy</span>
                  <span className="text-indigo-300 font-medium">${money(cajaData.ajuste_entregas_hoy)}</span>
                </div>
                <p className="text-[10px] text-gray-500">
                  {isAdmin
                    ? 'Saldo a favor de ayer'
                    : `Saldo a favor de ayer + comisión del día (${Math.round((cajaData.comision_rate || 0.3) * 100)}%)`}
                </p>
              </div>

              <div className="bg-gray-900/50 border border-gray-700/50 rounded-xl p-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Total de ventas</span>
                  <span className="text-white font-medium">${money(cajaData.total_ventas)}</span>
                </div>
                {!isAdmin && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Comisión (+ pasador)</span>
                    <span className="text-indigo-300 font-medium">${money(cajaData.comision)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Total premios (aciertos)</span>
                  <span className="text-red-400 font-medium">${money(cajaData.total_premios)}</span>
                </div>
                <div className="flex justify-between items-center border-t border-gray-700/50 pt-2 mt-1">
                  <span className="text-white font-semibold">Saldo actual</span>
                  <span className={`font-bold text-xl ${
                    cajaData.saldo_actual > 0 ? 'text-emerald-400' : cajaData.saldo_actual < 0 ? 'text-red-400' : 'text-white'
                  }`}>
                    ${money(cajaData.saldo_actual)}
                  </span>
                </div>
              </div>

              <div>
                <h4 className="text-xs uppercase tracking-wide text-gray-500 mb-2">Ventas por sorteo</h4>
                <div className="bg-gray-900/50 border border-gray-700/50 rounded-xl overflow-hidden">
                  {(cajaData.ventas_por_sorteo || []).map((s) => (
                    <div key={s.draw_id} className="flex justify-between px-3 py-2 text-sm border-b border-gray-700/30 last:border-0">
                      <span className="text-gray-300">
                        <span className="text-indigo-300 font-mono w-10 inline-block">{s.abbr}</span>
                        <span className="text-gray-500 text-xs ml-1 hidden sm:inline">{s.name}</span>
                      </span>
                      <span className="text-white">${money(s.ventas)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setGanadorasOpen(true)}
                className="w-full flex items-center justify-between bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-200 font-medium py-2.5 px-4 rounded-xl text-sm transition"
              >
                <span>Detalle jugadas ganadoras</span>
                <span className="text-xs text-indigo-400">
                  {(cajaData.jugadas_ganadoras || []).length} acierto{(cajaData.jugadas_ganadoras || []).length === 1 ? '' : 's'}
                </span>
              </button>
            </div>
          ) : (
            <p className="text-center text-gray-400 py-8 text-sm">No se pudo cargar la caja</p>
          )}
        </div>
      </div>

      {ganadorasOpen && cajaData && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setGanadorasOpen(false)}>
          <div
            className="bg-gray-800 border border-indigo-500/20 rounded-2xl w-full max-w-2xl shadow-2xl p-6 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-white font-semibold">Detalle jugadas ganadoras</h3>
                <p className="text-xs text-gray-400 mt-0.5">{cajaData.pasador?.name} · {cajaData.fecha}</p>
              </div>
              <button onClick={() => setGanadorasOpen(false)} className="text-gray-400 hover:text-white transition">
                <FiX size={18} />
              </button>
            </div>

            {(cajaData.jugadas_ganadoras || []).length === 0 ? (
              <p className="text-center text-gray-400 py-10 text-sm">No hay jugadas ganadoras</p>
            ) : (
              <div className="space-y-2">
                {cajaData.jugadas_ganadoras.map((j) => (
                  <div
                    key={j.id}
                    className="bg-gray-900/50 border border-gray-700/40 rounded-xl px-3 py-2.5 text-sm flex flex-wrap items-center gap-x-3 gap-y-1"
                  >
                    <span className="text-indigo-300 font-medium min-w-[4.5rem]">{j.turno}</span>
                    <span className="text-white font-mono"># {j.numero ?? '—'}</span>
                    <span className="text-gray-400">
                      POS {j.position ?? (j.es_redoblona ? 'R' : '—')}
                    </span>
                    {j.lottery && <span className="text-gray-500 text-xs">{j.lottery}</span>}
                    <span className="text-gray-300 ml-auto">imp. ${money(j.importe)}</span>
                    <span className="text-emerald-400 font-semibold">Premio = ${money(j.premio)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
