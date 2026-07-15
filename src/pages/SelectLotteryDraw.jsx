import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBet } from '../context/BetContext';
import { FiArrowRight, FiRefreshCw, FiLock } from 'react-icons/fi';

function isDrawOpen(schedule) {
  if (!schedule?.closing_time) return true;
  const now = new Date();
  const [h, m] = schedule.closing_time.split(':').map(Number);
  const close = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
  return now <= close;
}

export default function SelectLotteryDraw() {
  const { lotteries, draws, selectedLotteries, setSelectedLotteries, selectedDraw, setSelectedDraw, fetchLotteries, fetchDraws } = useBet();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchLotteries(), fetchDraws()]).finally(() => setLoading(false));
  }, [fetchLotteries, fetchDraws]);

  const toggleLottery = (id) => {
    setSelectedLotteries((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const allSelected = lotteries.length > 0 && selectedLotteries.length === lotteries.length;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedLotteries([]);
    } else {
      setSelectedLotteries(lotteries.map((l) => l.id));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <FiRefreshCw className="animate-spin text-indigo-400" size={32} />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-gray-800/40 backdrop-blur-sm border border-indigo-500/10 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Loterias</h2>
          <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-indigo-600 focus:ring-indigo-500"
            />
            Seleccionar todo
          </label>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
          {lotteries.map((l) => (
            <label
              key={l.id}
              className={`flex items-center gap-2 p-2.5 rounded-lg border text-sm cursor-pointer transition ${
                selectedLotteries.includes(l.id)
                  ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-200'
                  : 'bg-gray-700/30 border-gray-600/50 text-gray-300 hover:border-gray-500'
              }`}
            >
              <input
                type="checkbox"
                checked={selectedLotteries.includes(l.id)}
                onChange={() => toggleLottery(l.id)}
                className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-indigo-600 focus:ring-indigo-500"
              />
              <span>{l.name}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="bg-gray-800/40 backdrop-blur-sm border border-indigo-500/10 rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Sorteos</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {draws.map((d) => {
            const schedule = lotteries[0]?.schedules?.find((s) => s.draw_id === d.id);
            const open = isDrawOpen(schedule);
            return (
              <label
                key={d.id}
                className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition ${
                  !open
                    ? 'bg-gray-800/50 border-gray-700 text-gray-600 cursor-not-allowed'
                    : selectedDraw === d.id
                      ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-200'
                      : 'bg-gray-700/30 border-gray-600/50 text-gray-300 hover:border-gray-500'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    !open
                      ? 'bg-gray-700 cursor-not-allowed'
                      : selectedDraw === d.id ? 'bg-indigo-600' : 'bg-gray-600'
                  }`}>
                    <input
                      type="checkbox"
                      checked={selectedDraw === d.id}
                      onChange={() => open && setSelectedDraw(d.id)}
                      disabled={!open}
                      className="sr-only peer"
                    />
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      selectedDraw === d.id ? 'translate-x-[18px]' : 'translate-x-[2px]'
                    }`} />
                  </div>
                  <span className="text-sm font-medium">{d.name}</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {schedule && <span className="opacity-60">{schedule.draw_time}</span>}
                  {!open && <span className="flex items-center gap-1 text-red-500/70"><FiLock size={12} /> Cerrado</span>}
                </div>
              </label>
            );
          })}
        </div>
      </div>

      <button
        onClick={() => navigate('/bet')}
        disabled={selectedLotteries.length === 0 || !selectedDraw}
        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium py-3 rounded-xl transition shadow-lg shadow-indigo-500/20"
      >
        Continuar <FiArrowRight size={18} />
      </button>
    </div>
  );
}
