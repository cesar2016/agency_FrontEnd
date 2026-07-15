import { useEffect, useState, useCallback } from 'react';
import api from '../services/api';
import { Link } from 'react-router-dom';
import { FiTrendingUp, FiDollarSign, FiCheckCircle, FiFileText, FiRefreshCw, FiEye, FiTrash2, FiX } from 'react-icons/fi';

const fmt = (n) => Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [bets, setBets] = useState([]);
  const [draws, setDraws] = useState([]);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterDrawIds, setFilterDrawIds] = useState([]);
  const [viewBet, setViewBet] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  const fetchBets = useCallback(async () => {
    const params = {};
    if (filterDate) params.date = filterDate;
    if (filterDrawIds.length > 0) params.draw_ids = filterDrawIds;
    const { data } = await api.get('/bets', { params });
    setBets(data.data || data);
  }, [filterDate, filterDrawIds]);

  const fetchStats = useCallback(async () => {
    const { data } = await api.get('/dashboard/stats');
    setStats(data);
  }, []);

  useEffect(() => {
    fetchStats();
    api.get('/draws').then((r) => setDraws(r.data));
  }, [fetchStats]);

  useEffect(() => { fetchBets(); }, [fetchBets]);

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await api.delete(`/bets/${deleteId}`);
      setDeleteId(null);
      fetchBets();
      fetchStats();
    } catch {
      alert('Error al eliminar');
    }
  };

  if (!stats) {
    return <div className="flex justify-center pt-20"><FiRefreshCw className="animate-spin text-indigo-400" size={28} /></div>;
  }

  const cards = [
    { label: 'Boletas de Hoy', value: Number(stats.bets_count).toLocaleString('es-AR'), icon: FiFileText, color: 'from-blue-600 to-cyan-600' },
    { label: 'Total $ Recaudado', value: `$${fmt(stats.total_bets)}`, icon: FiDollarSign, color: 'from-green-600 to-emerald-600' },
    { label: 'Aciertos', value: Number(stats.aciertos_count).toLocaleString('es-AR'), icon: FiCheckCircle, color: 'from-purple-600 to-pink-600' },
    { label: 'Extractos', value: Number(stats.extracts_count).toLocaleString('es-AR'), icon: FiTrendingUp, color: 'from-orange-600 to-red-600' },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="bg-gray-800/40 backdrop-blur-sm border border-indigo-500/10 rounded-xl p-4 text-center">
            <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${card.color} flex items-center justify-center mx-auto mb-3`}>
              <card.icon className="text-white" size={18} />
            </div>
            <p className="text-2xl font-bold text-white">{card.value}</p>
            <p className="text-xs text-gray-400 mt-1">{card.label}</p>
          </div>
        ))}
      </div>


      <div className="bg-gray-800/40 backdrop-blur-sm border border-indigo-500/10 rounded-2xl p-4">
        <h3 className="text-white font-semibold mb-3">Ultimas Jugadas</h3>

        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 w-full sm:w-40"
          />
          <div className="flex flex-wrap gap-2">
            {draws.map((d) => {
              const selected = filterDrawIds.includes(d.id);
              return (
                <label
                  key={d.id}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs cursor-pointer transition ${
                    selected
                      ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-200'
                      : 'bg-gray-700/30 border-gray-600/50 text-gray-400 hover:border-gray-500'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => setFilterDrawIds((prev) =>
                      prev.includes(d.id) ? prev.filter((id) => id !== d.id) : [...prev, d.id]
                    )}
                    className="w-3.5 h-3.5 rounded border-gray-600 bg-gray-700 text-indigo-600 focus:ring-indigo-500"
                  />
                  {d.name}
                </label>
              );
            })}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700/50">
                <th className="text-left p-2">Secuencia</th>
                <th className="text-left p-2">Pasador</th>
                <th className="text-left p-2">Sorteo</th>
                <th className="text-right p-2">Total</th>
                <th className="text-center p-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {bets.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-gray-400">No hay jugadas</td></tr>
              ) : bets.map((bet) => (
                <tr key={bet.id} className="border-b border-gray-700/30 hover:bg-gray-700/20">
                  <td className="p-2 text-white font-mono text-xs">{bet.sequence}</td>
                  <td className="p-2 text-gray-300">{bet.user?.name}</td>
                  <td className="p-2 text-gray-300">{bet.draw?.name}</td>
                  <td className="p-2 text-right text-white">${fmt(bet.total)}</td>
                  <td className="p-2 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => setViewBet(bet)} className="text-indigo-400 hover:text-indigo-300 transition p-1" title="Ver boleta">
                        <FiEye size={16} />
                      </button>
                      <button onClick={() => setDeleteId(bet.id)} className="text-red-400 hover:text-red-300 transition p-1" title="Eliminar">
                        <FiTrash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setDeleteId(null)}>
          <div className="bg-gray-800 border border-red-500/30 rounded-2xl w-full max-w-sm shadow-2xl p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="w-14 h-14 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <FiTrash2 className="text-red-400" size={24} />
            </div>
            <h3 className="text-white font-bold text-lg mb-2">Eliminar Apuesta</h3>
            <p className="text-gray-400 text-sm mb-6">¿Estás seguro de eliminar esta apuesta? Esta acción no se puede deshacer.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-200 font-medium py-2.5 rounded-lg text-sm transition">
                Cancelar
              </button>
              <button onClick={confirmDelete} className="flex-1 bg-red-600 hover:bg-red-500 text-white font-medium py-2.5 rounded-lg text-sm transition shadow-lg shadow-red-500/20">
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {viewBet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setViewBet(null)}>
          <div className="bg-gray-800 border border-indigo-500/20 rounded-2xl w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-700/50 flex items-center justify-between">
              <h3 className="text-white font-bold">Boleta</h3>
              <button onClick={() => setViewBet(null)} className="text-gray-400 hover:text-white transition">
                <FiX size={18} />
              </button>
            </div>
            <div className="p-4 font-mono text-xs space-y-2 text-gray-200">
              <p><span className="text-gray-400">Secuencia:</span> <span className="text-white">{viewBet.sequence}</span></p>
              <p><span className="text-gray-400">Pasador:</span> <span className="text-white">{viewBet.user?.name}</span></p>
              <p><span className="text-gray-400">Sorteo:</span> <span className="text-white">{viewBet.draw?.name}</span></p>
              <p><span className="text-gray-400">Fecha:</span> <span className="text-white">{viewBet.draw_date}</span></p>
              <p><span className="text-gray-400">Loterias:</span> <span className="text-indigo-300">{(viewBet.lotteries || []).map((l) => l.initials).join(', ')}</span></p>
              <table className="w-full mt-2">
                <thead>
                  <tr className="border-b border-dashed border-gray-600/50 text-gray-400">
                    <th className="text-left py-1">NUMERO</th>
                    <th className="text-center py-1">POS</th>
                    <th className="text-right py-1">IMPORTE</th>
                  </tr>
                </thead>
                <tbody>
                  {(viewBet.items || []).map((item) => (
                    <tr key={item.id}>
                      <td className="py-1 text-white font-bold">{item.number}</td>
                      <td className="py-1 text-center text-gray-400">{item.type === 'primera' ? '#1' : `#${item.type?.replace('a_los_', '') || ''}`}</td>
                      <td className="py-1 text-right text-white">${fmt(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="border-t border-dashed border-gray-600/50 pt-2 flex justify-between text-white font-bold">
                <span>TOTAL</span>
                <span className="text-indigo-300">${fmt(viewBet.total)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
