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

export default function SelectLotteryDraw() {
  const { lotteries, draws, selectedLotteries, setSelectedLotteries, selectedDraws, setSelectedDraws, fetchLotteries, fetchDraws } = useBet();
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
          .sort((a, b) => a.lottery.initials.localeCompare(b.lottery.initials));
        return { draw, items };
      });
  }, [lotteries, draws]);

  const toggleLottery = (lotteryId, drawId) => {
    setSelectedLotteries((prev) =>
      prev.includes(lotteryId) ? prev.filter((i) => i !== lotteryId) : [...prev, lotteryId]
    );
    // Al seleccionar una lotería, asegurar que el sorteo quede seleccionado
    setSelectedDraws((prev) =>
      prev.includes(drawId) ? prev : [...prev, drawId]
    );
  };

  const toggleDraw = (drawId) => {
    setSelectedDraws((prev) =>
      prev.includes(drawId) ? prev.filter((i) => i !== drawId) : [...prev, drawId]
    );
  };

  const toggleAllInDraw = (drawId, items) => {
    const allInDraw = items.every((it) => selectedLotteries.includes(it.lottery.id));
    if (allInDraw) {
      setSelectedLotteries((prev) => prev.filter((id) => !items.some((it) => it.lottery.id === id)));
      setSelectedDraws((prev) => prev.filter((i) => i !== drawId));
    } else {
      setSelectedLotteries((prev) => [
        ...prev,
        ...items.filter((it) => !prev.includes(it.lottery.id)).map((it) => it.lottery.id),
      ]);
      setSelectedDraws((prev) => (prev.includes(drawId) ? prev : [...prev, drawId]));
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
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="text-center">
        <h2 className="text-lg font-semibold text-white">Sorteos y Loterías</h2>
        <p className="text-xs text-gray-400">{todayLabel()}</p>
      </div>

      {drawsGrouped.map(({ draw, items }) => {
        const open = openDraws.has(draw.id);
        const drawSelected = selectedDraws.includes(draw.id);
        const allInDraw = items.length > 0 && items.every((it) => selectedLotteries.includes(it.lottery.id));
        const someInDraw = items.some((it) => selectedLotteries.includes(it.lottery.id));
        return (
          <div key={draw.id} className="bg-gray-800/40 backdrop-blur-sm border border-indigo-500/10 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4">
              <button
                onClick={() => toggleOpen(draw.id)}
                className="flex items-center gap-2 text-left"
              >
                {open ? <FiChevronUp className="text-gray-400" /> : <FiChevronDown className="text-gray-400" />}
                <span className="text-white font-semibold text-base">{draw.name}</span>
                <span className="text-xs text-gray-500 bg-gray-700/50 px-2 py-0.5 rounded-full">{items.length}</span>
              </button>
              <label className="flex items-center gap-2 cursor-pointer" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={drawSelected}
                  onChange={() => toggleDraw(draw.id)}
                  className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-xs text-gray-400">Seleccionar turno</span>
              </label>
            </div>

            {open && (
              <div className="border-t border-gray-700/30">
                <div className="flex items-center justify-between px-4 py-2 bg-gray-700/20">
                  <span className="text-xs text-gray-400">Loterías de este turno (hora de cierre)</span>
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs text-indigo-300">
                    <input
                      type="checkbox"
                      checked={allInDraw}
                      ref={(el) => { if (el) el.indeterminate = !allInDraw && someInDraw; }}
                      onChange={() => toggleAllInDraw(draw.id, items)}
                      className="w-3.5 h-3.5 rounded border-gray-600 bg-gray-700 text-indigo-600 focus:ring-indigo-500"
                    />
                    Todas
                  </label>
                </div>
                <div className="divide-y divide-gray-700/20 max-h-80 overflow-y-auto">
                  {items.map(({ lottery, closingTime, drawTime }) => {
                    const closed = isClosed(closingTime);
                    const selected = selectedLotteries.includes(lottery.id);
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
        disabled={selectedLotteries.length === 0 || selectedDraws.length === 0}
        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium py-3 rounded-xl transition shadow-lg shadow-indigo-500/20"
      >
        Continuar <FiArrowRight size={18} />
      </button>
    </div>
  );
}
