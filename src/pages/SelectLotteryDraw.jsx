import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBet } from '../context/BetContext';
import { FiArrowRight, FiRefreshCw, FiLock, FiChevronDown, FiChevronUp } from 'react-icons/fi';

function isClosed(closingTime) {
  if (!closingTime) return false;
  const now = new Date();
  const [h, m] = closingTime.split(':').map(Number);
  const close = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
  return now > close;
}

function todayLabel() {
  const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const meses = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
  const d = new Date();
  return `${dias[d.getDay()]} ${d.getDate()}/${meses[d.getMonth()]}/${d.getFullYear()}`;
}

const LOTTERY_ORDER = [
  'NAC', 'PBA', 'SF', 'CBA', 'CBAT', 'ER', 'ERT', 'MZA', 'CTES', 'CH', 'CAT', 'FSA', 'FSAQ',
  'JUJ', 'LR', 'MIS', 'NQN', 'RN', 'SAL', 'SALR', 'SL', 'SC', 'SGO', 'TUC',
  'CT', 'SJ', 'URU', 'PAR',
];

function lotteryRank(initials) {
  const i = LOTTERY_ORDER.indexOf(initials);
  return i === -1 ? 999 : i;
}

// Grupos de "Loterías Principales"
const PRINCIPAL_GROUPS = {
  5: ['NAC', 'PBA', 'CBA', 'SF', 'ER'],
  8: ['NAC', 'PBA', 'CBA', 'SF', 'ER', 'MZA', 'CTES', 'CH'],
  9: ['NAC', 'PBA', 'CBA', 'SF', 'ER', 'MZA', 'CTES', 'CH', 'URU'],
};

const PRINCIPAL_GROUP_LABEL = {
  5: '5 Principales',
  8: '8 Principales',
  9: '9 Principales',
};

// Qué grupos de principales ofrece cada turno
const DRAW_PRINCIPAL_GROUPS = {
  'La Previa':  [5, 8],
  'Primera':    [5, 8],
  'Matutina':   [5, 9],
  'Vespertina': [5, 8],
  'Noctura':    [5, 9],
};

export default function SelectLotteryDraw() {
  const { lotteries, draws, selectedByDraw, selectedGroupsByDraw, selectedAllByDraw, toggleLotteryInDraw, setAllInDraw, setManyInDraw, toggleGroupInDraw, toggleAllInDrawExplicit, fetchLotteries, fetchDraws } = useBet();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [openDraws, setOpenDraws] = useState(() => new Set());

  useEffect(() => {
    Promise.all([fetchLotteries(), fetchDraws()]).finally(() => setLoading(false));
  }, [fetchLotteries, fetchDraws]);

  const toggleOpen = (drawId) => {
    setOpenDraws((prev) => {
      const next = new Set(prev);
      if (next.has(drawId)) next.delete(drawId);
      else next.add(drawId);
      return next;
    });
  };

  const hasSelection = Object.values(selectedByDraw).some((arr) => arr.length > 0);

  // Agrupar loterías por sorteo (draw) usando los schedules
  const drawsGrouped = useMemo(() => {
    return draws
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((draw) => {
        const items = lotteries
          .map((l) => {
            const sched = l.schedules?.find((s) => s.draw_id === draw.id);
            return sched ? { lottery: l, closingTime: sched.closing_time, drawTime: sched.draw_time } : null;
          })
          .filter(Boolean)
          .sort((a, b) => lotteryRank(a.lottery.initials) - lotteryRank(b.lottery.initials));
        return { draw, items };
      });
  }, [lotteries, draws]);

  const toggleLottery = (lotteryId, drawId) => {
    toggleLotteryInDraw(drawId, lotteryId);
  };

  const toggleAllInDraw = (drawId, openItems) => {
    const openIds = openItems.map((it) => it.lottery.id);
    toggleAllInDrawExplicit(drawId, openIds);
  };

  const lotteriesInDraw = (drawId) => selectedByDraw[drawId] || [];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <FiRefreshCw className="animate-spin text-indigo-400" size={32} />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="text-center">
        <h2 className="text-lg font-semibold text-white">Sorteos y Loterías</h2>
        <p className="text-xs text-gray-400">{todayLabel()}</p>
      </div>

      {drawsGrouped.map(({ draw, items }) => {
        const open = openDraws.has(draw.id);
        const drawLots = selectedByDraw[draw.id] || [];
        const openItems = items.filter((it) => !isClosed(it.closingTime));
        const allActive = !!selectedAllByDraw[draw.id];
        const hasOpen = openItems.length > 0;
        return (
          <div key={draw.id} className={`relative bg-gray-800/40 backdrop-blur-sm border border-indigo-500/10 rounded-2xl overflow-hidden ${hasOpen ? '' : 'opacity-60'}`}>
            {!hasOpen && (
              <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-1">
                <FiLock className="text-red-500" size={26} />
                <span className="text-xs font-semibold text-red-500">Cerrado</span>
              </div>
            )}
            <div className="flex items-center justify-between p-4">
              <button
                onClick={() => toggleOpen(draw.id)}
                className="flex items-center gap-2 text-left"
              >
                {open ? <FiChevronUp className="text-gray-400" /> : <FiChevronDown className="text-gray-400" />}
                <span className="text-white font-semibold text-base">{draw.name}</span>
                <span className="text-xs text-gray-500 bg-gray-700/50 px-2 py-0.5 rounded-full">{items.length}</span>
              </button>
            </div>

            {open && (
              <div className="border-t border-gray-700/30">
                <div className="flex items-center justify-between gap-3 px-4 py-2 bg-gray-700/20">
                  <div className="flex items-center gap-3">
                    {(DRAW_PRINCIPAL_GROUPS[draw.name] || []).map((g) => {
                      const groupIds = openItems
                        .filter((it) => PRINCIPAL_GROUPS[g].includes(it.lottery.initials))
                        .map((it) => it.lottery.id);
                      const active = (selectedGroupsByDraw[draw.id] || []).includes(g);
                      return (
                        <label
                          key={g}
                          className={`flex items-center gap-1.5 text-xs ${hasOpen && groupIds.length > 0 ? 'cursor-pointer text-emerald-300' : 'cursor-not-allowed text-gray-600'}`}
                          title={`Lección rápida: ${PRINCIPAL_GROUP_LABEL[g]}`}
                        >
                          <input
                            type="checkbox"
                            checked={active}
                            disabled={!hasOpen || groupIds.length === 0}
                            onChange={() => toggleGroupInDraw(draw.id, g, groupIds)}
                            className="w-3.5 h-3.5 rounded border-gray-600 bg-gray-700 text-emerald-600 focus:ring-emerald-500"
                          />
                          {PRINCIPAL_GROUP_LABEL[g]}
                        </label>
                      );
                    })}
                  </div>
                  <label className={`flex items-center gap-1.5 text-xs ${hasOpen ? 'cursor-pointer text-indigo-300' : 'cursor-not-allowed text-gray-600'}`}>
                    <input
                      type="checkbox"
                      checked={allActive}
                      disabled={!hasOpen || openItems.length === 0}
                      onChange={() => toggleAllInDraw(draw.id, openItems)}
                      className="w-3.5 h-3.5 rounded border-gray-600 bg-gray-700 text-indigo-600 focus:ring-indigo-500"
                    />
                    Todas
                  </label>
                </div>
                <div className="divide-y divide-gray-700/20 max-h-80 overflow-y-auto">
                  {items.map(({ lottery, closingTime, drawTime }) => {
                    const closed = isClosed(closingTime);
                    const selected = drawLots.includes(lottery.id);
                    return (
                      <label
                        key={lottery.id}
                        className={`flex items-center justify-between px-4 py-2.5 text-sm cursor-pointer transition ${
                          closed ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-700/30'
                        } ${selected ? 'bg-indigo-600/10' : ''}`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={selected}
                            disabled={closed}
                            onChange={() => toggleLottery(lottery.id, draw.id)}
                            className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="font-mono font-bold text-indigo-300 w-10">{lottery.initials}</span>
                          <span className="text-gray-200">{lottery.name}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-gray-500">Sorteo {drawTime}</span>
                          {closed ? (
                            <span className="flex items-center gap-1 text-red-500/80"><FiLock size={12} /> Cerrado</span>
                          ) : (
                            <span className="text-yellow-400">Cierre {closingTime}</span>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}

      <button
        onClick={() => navigate('/bet')}
        disabled={!hasSelection}
        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium py-3 rounded-xl transition shadow-lg shadow-indigo-500/20"
      >
        Continuar <FiArrowRight size={18} />
      </button>
    </div>
  );
}
