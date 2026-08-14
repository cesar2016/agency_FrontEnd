import { useState, useEffect } from 'react';
import { FiX, FiCheckCircle, FiClock, FiDollarSign } from 'react-icons/fi';
import api from '../services/api';

const fmtDate = (d) => {
  if (!d) return '';
  const parts = d.split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : d;
};
const fmtMoney = (n) => Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function RentalModal({ user, mode, open, onClose, onError }) {
  const [rentals, setRentals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [form, setForm] = useState({ date_from: '', date_to: '', amount: '' });

  useEffect(() => {
    if (open && user) {
      if (mode === 'history') {
        loadHistory();
      } else {
        setForm({ date_from: '', date_to: '', amount: '' });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user, mode]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/users/${user.id}/rentals`);
      setRentals(data);
    } catch (e) {
      onError?.(e.response?.data?.message || 'Error al cargar historial');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      await api.post(`/users/${user.id}/rentals`, form);
      onError?.('Configuración guardada exitosamente');
      onClose();
    } catch (e) {
      onError?.(e.response?.data?.message || 'Error al guardar configuración');
    } finally {
      setFormLoading(false);
    }
  };

  if (!open || !user) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-gray-800 border border-indigo-500/20 rounded-2xl w-full max-w-md shadow-2xl p-6 relative" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-bold text-lg">
            {mode === 'history' ? 'Historial de Locación' : 'Configurar Alquiler'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition">
            <FiX size={20} />
          </button>
        </div>
        <p className="text-sm text-gray-400 mb-6">
          Admin: <span className="font-semibold text-indigo-300">{user.name}</span>
        </p>

        {mode === 'history' && (
          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-4 text-gray-400">Cargando historial...</div>
            ) : rentals.length === 0 ? (
              <div className="text-center py-4 text-gray-400">No hay periodos registrados</div>
            ) : (
              <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
                {rentals.map((r, i) => {
                  const now = new Date();
                  const from = new Date(r.date_from + 'T00:00:00');
                  const to = new Date(r.date_to + 'T23:59:59');
                  const isCurrent = now >= from && now <= to;
                  
                  return (
                    <div key={r.id} className={`p-3 rounded-xl border ${isCurrent ? 'bg-indigo-900/20 border-indigo-500/40 relative' : 'bg-gray-700/30 border-gray-600/50'}`}>
                      {isCurrent && (
                         <span className="absolute top-2 right-2 flex h-2 w-2">
                           <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                           <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                         </span>
                      )}
                      <div className="flex justify-between items-center text-sm mb-1">
                        <span className="text-emerald-400 font-semibold">${fmtMoney(r.amount)}</span>
                        {isCurrent && <span className="text-[10px] text-indigo-300 font-bold tracking-wider uppercase">En Curso</span>}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-gray-300">
                        <FiClock size={12} className="text-gray-400" />
                        <span>{fmtDate(r.date_from)} - {fmtDate(r.date_to)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {mode === 'config' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Desde</label>
                <input
                  type="date"
                  required
                  value={form.date_from}
                  onChange={(e) => setForm({ ...form, date_from: e.target.value })}
                  className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Hasta</label>
                <input
                  type="date"
                  required
                  value={form.date_to}
                  onChange={(e) => setForm({ ...form, date_to: e.target.value })}
                  className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Importe</label>
              <div className="relative">
                <FiDollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className="w-full bg-gray-700/50 border border-gray-600 rounded-lg pl-8 pr-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                  placeholder="Ej: 15000"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={formLoading}
              className="w-full mt-4 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 rounded-lg transition disabled:opacity-50"
            >
              {formLoading ? 'Guardando...' : <><FiCheckCircle size={18} /> Guardar Período</>}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
