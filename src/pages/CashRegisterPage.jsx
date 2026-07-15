import { useState } from 'react';
import api from '../services/api';
import { FiDollarSign, FiRefreshCw, FiCalendar } from 'react-icons/fi';

export default function CashRegisterPage() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchRegister = async () => {
    setLoading(true);
    try {
      const { data: result } = await api.get('/dashboard/cash-register', { params: { date } });
      setData(result);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h2 className="text-xl font-bold text-white">Arqueo de Caja</h2>

      <div className="flex gap-3 items-end">
        <div className="flex-1">
          <label className="text-sm text-gray-300 block mb-1">Fecha</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
          />
        </div>
        <button onClick={fetchRegister}
          className="flex items-center gap-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-4 py-2 rounded-lg text-sm transition shadow-lg shadow-indigo-500/20">
          <FiRefreshCw size={16} /> Consultar
        </button>
      </div>

      {loading && (
        <div className="flex justify-center"><FiRefreshCw className="animate-spin text-indigo-400" size={24} /></div>
      )}

      {data && (
        <div className="bg-gray-800/40 backdrop-blur-sm border border-indigo-500/10 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 text-gray-400 text-sm border-b border-gray-700/50 pb-3">
            <FiCalendar size={14} /> {data.date}
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-300">Total Apuestas</span>
              <span className="text-white font-bold text-lg">${Number(data.total_apuestas).toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-300">Total Premios</span>
              <span className="text-red-400 font-bold text-lg">-${Number(data.total_premios).toFixed(2)}</span>
            </div>
            <div className="border-t border-gray-700/50 pt-3">
              <div className="flex justify-between items-center">
                <span className="text-white font-semibold text-lg">Total Recaudado</span>
                <span className={`font-bold text-2xl ${data.total_recaudado >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  <FiDollarSign className="inline" size={20} />
                  {Number(data.total_recaudado).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
