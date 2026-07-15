import { useState, useEffect } from 'react';
import api from '../services/api';
import { FiClock, FiChevronDown, FiChevronUp } from 'react-icons/fi';

const LOTTERY_ORDER = [
  'NAC', 'PBA', 'SF', 'CBA', 'ER', 'MZA', 'CTES', 'CH', 'CAT', 'FSA',
  'JUJ', 'LR', 'MIS', 'NQN', 'RN', 'SAL', 'SL', 'SC', 'SGO', 'TUC',
  'CT', 'SJ', 'URU',
];

function lotteryRank(initials) {
  const i = LOTTERY_ORDER.indexOf(initials);
  return i === -1 ? 999 : i;
}

export default function HorariosPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDraws, setOpenDraws] = useState(() => new Set());

  useEffect(() => {
    api.get('/horarios').then((r) => {
      setData(r.data);
    }).finally(() => setLoading(false));
  }, []);

  const toggleOpen = (drawId) => {
    setOpenDraws((prev) => {
      const next = new Set(prev);
      if (next.has(drawId)) next.delete(drawId);
      else next.add(drawId);
      return next;
    });
  };

  if (loading) {
    return <div className="flex justify-center pt-20"><FiClock className="animate-spin text-indigo-400" size={28} /></div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <h2 className="text-xl font-bold text-white">Horarios de cierre por turno</h2>
      <p className="text-sm text-gray-400">Cada turno muestra las loterías que participan con su hora de cierre.</p>

      {data.map((draw) => (
        <div key={draw.draw_id} className="bg-gray-800/40 backdrop-blur-sm border border-indigo-500/10 rounded-2xl overflow-hidden">
          <button
            onClick={() => toggleOpen(draw.draw_id)}
            className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-700/30 transition"
          >
            <div className="flex items-center gap-3">
              <span className="text-indigo-400 font-bold text-lg">{draw.draw_name}</span>
              <span className="text-xs text-gray-500 bg-gray-700/50 px-2 py-0.5 rounded-full">{draw.lotteries.length} loterías</span>
            </div>
            {openDraws.has(draw.draw_id) ? <FiChevronUp className="text-gray-400" /> : <FiChevronDown className="text-gray-400" />}
          </button>

          {openDraws.has(draw.draw_id) && (
            <div className="border-t border-gray-700/30 divide-y divide-gray-700/20">
              {[...draw.lotteries]
                .sort((a, b) => lotteryRank(a.initials) - lotteryRank(b.initials))
                .map((lot) => (
                <div key={lot.lottery_id} className="flex items-center justify-between px-5 py-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-indigo-300 w-8">{lot.initials}</span>
                    <span className="text-gray-200">{lot.name}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-gray-400">Sorteo: <span className="text-gray-200 font-medium">{lot.draw_time}</span></span>
                    <span className="text-yellow-400">Cierre: <span className="text-yellow-300 font-medium">{lot.closing_time}</span></span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
