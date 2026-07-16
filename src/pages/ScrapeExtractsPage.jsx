import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import {
  FiChevronDown, FiChevronUp, FiDownload, FiRefreshCw, FiPlay,
  FiCheckCircle, FiClock, FiGrid,
} from 'react-icons/fi';

const LOTTERY_ORDER = [
  'NAC', 'PBA', 'SF', 'CBA', 'CBAT', 'ER', 'ERT', 'MZA', 'CTES', 'CH', 'CAT', 'FSA', 'FSAQ',
  'JUJ', 'LR', 'MIS', 'NQN', 'RN', 'SAL', 'SALR', 'SL', 'SC', 'SGO', 'TUC',
  'CT', 'SJ', 'URU', 'PAR',
];

function lotteryRank(initials) {
  const i = LOTTERY_ORDER.indexOf(initials);
  return i === -1 ? 999 : i;
}

export default function ScrapeExtractsPage() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [draws, setDraws] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDraws, setOpenDraws] = useState(() => new Set());
  const [busy, setBusy] = useState({}); // claves: turno o "turno-loteria"
  const [openExtract, setOpenExtract] = useState(null);
  const [toast, setToast] = useState(null);

  const flash = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/extracts/scrape/status', { params: { date } });
      setDraws(data.draws || []);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { load(); }, [load]);

  const toggleOpen = (drawId) => {
    setOpenDraws((prev) => {
      const next = new Set(prev);
      if (next.has(drawId)) next.delete(drawId);
      else next.add(drawId);
      return next;
    });
  };

  const scrapeOne = async (drawId, lot) => {
    const key = `${drawId}-${lot.lottery_id}`;
    if (lot.completed) return;
    setBusy((b) => ({ ...b, [key]: true }));
    try {
      const { data } = await api.post('/extracts/scrape', {
        lottery_id: lot.lottery_id, draw_id: drawId, date,
      });
      flash(`Extracto ${lot.initials} / ${draws.find((d) => d.draw_id === drawId)?.draw_name} cargado`);
      await load();
      setOpenExtract(data.extract?.id ?? openExtract);
    } catch (e) {
      flash(e?.response?.data?.message || 'Error al scrapear');
    } finally {
      setBusy((b) => ({ ...b, [key]: false }));
    }
  };

  const scrapeTurn = async (draw) => {
    const key = `turn-${draw.draw_id}`;
    setBusy((b) => ({ ...b, [key]: true }));
    try {
      const { data } = await api.post('/extracts/scrape-turn', { draw_id: draw.draw_id, date });
      flash(data.message);
      await load();
    } catch (e) {
      flash(e?.response?.data?.message || 'Error al scrapear el turno');
    } finally {
      setBusy((b) => ({ ...b, [key]: false }));
    }
  };

  const processExtract = async (extractId) => {
    setBusy((b) => ({ ...b, [`proc-${extractId}`]: true }));
    try {
      await api.post(`/scrutiny/${extractId}`);
      flash('Escrutinio calculado');
      await load();
    } catch {
      flash('Error al calcular premios');
    } finally {
      setBusy((b) => ({ ...b, [`proc-${extractId}`]: false }));
    }
  };

  if (loading) {
    return <div className="flex justify-center pt-20"><FiRefreshCw className="animate-spin text-indigo-400" size={28} /></div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {toast && (
        <div className="bg-indigo-500/15 border border-indigo-500/30 text-indigo-200 px-4 py-2 rounded-lg text-sm">
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Scrapear Extractos</h2>
          <p className="text-sm text-gray-400">Igual que Horarios: por turno. Scrapeá por lotería o todo el turno. Los completos (20 números) se saltan.</p>
        </div>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
        />
      </div>

      {draws.map((draw) => {
        const completos = draw.lotteries.filter((l) => l.completed).length;
        return (
          <div key={draw.draw_id} className="bg-gray-800/40 backdrop-blur-sm border border-indigo-500/10 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4">
              <button
                onClick={() => toggleOpen(draw.draw_id)}
                className="flex items-center gap-3 text-left hover:opacity-80 transition"
              >
                <span className="text-indigo-400 font-bold text-lg">{draw.draw_name}</span>
                <span className="text-xs text-gray-500 bg-gray-700/50 px-2 py-0.5 rounded-full">
                  {completos}/{draw.lotteries.length} completos
                </span>
                {openDraws.has(draw.draw_id) ? <FiChevronUp className="text-gray-400" /> : <FiChevronDown className="text-gray-400" />}
              </button>
              <button
                onClick={() => scrapeTurn(draw)}
                disabled={busy[`turn-${draw.draw_id}`]}
                className="flex items-center gap-1.5 text-xs bg-indigo-600/40 hover:bg-indigo-600/60 text-indigo-200 px-3 py-1.5 rounded-lg transition disabled:opacity-50"
              >
                {busy[`turn-${draw.draw_id}`] ? <FiRefreshCw size={13} className="animate-spin" /> : <FiDownload size={13} />}
                Scrapear turno
              </button>
            </div>

            {openDraws.has(draw.draw_id) && (
              <div className="border-t border-gray-700/30 divide-y divide-gray-700/20">
                {[...draw.lotteries]
                  .sort((a, b) => lotteryRank(a.initials) - lotteryRank(b.initials))
                  .map((lot) => {
                    const key = `${draw.draw_id}-${lot.lottery_id}`;
                    return (
                      <div key={lot.lottery_id} className="px-5 py-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-indigo-300 w-8">{lot.initials}</span>
                            <span className="text-gray-200 text-sm">{lot.name}</span>
                            <span className="text-xs text-gray-500">Sorteo {lot.draw_time} · Cierre {lot.closing_time}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {lot.completed ? (
                              <span className="flex items-center gap-1 text-xs text-green-300 bg-green-500/15 px-2 py-1 rounded-full">
                                <FiCheckCircle size={13} /> {lot.count}/20
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-xs text-yellow-300 bg-yellow-500/15 px-2 py-1 rounded-full">
                                <FiClock size={13} /> {lot.count}/20
                              </span>
                            )}
                            {!lot.completed && (
                              <button
                                onClick={() => scrapeOne(draw.draw_id, lot)}
                                disabled={busy[key]}
                                className="flex items-center gap-1 text-xs bg-indigo-600/40 hover:bg-indigo-600/60 text-indigo-200 px-2.5 py-1 rounded-lg transition disabled:opacity-50"
                              >
                                {busy[key] ? <FiRefreshCw size={12} className="animate-spin" /> : <FiDownload size={12} />}
                                Scrapear
                              </button>
                            )}
                            {lot.extract_id && (
                              <button
                                onClick={() => setOpenExtract(openExtract === lot.extract_id ? null : lot.extract_id)}
                                className="flex items-center gap-1 text-xs bg-gray-700/50 hover:bg-gray-700 text-gray-200 px-2.5 py-1 rounded-lg transition"
                              >
                                <FiGrid size={12} /> Ver
                              </button>
                            )}
                          </div>
                        </div>

                        {openExtract === lot.extract_id && lot.extract_id && (
                          <ExtractNumbers drawId={draw.draw_id} lotteryId={lot.lottery_id} date={date} busy={busy} onProcess={processExtract} flash={flash} />
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ExtractNumbers({ drawId, lotteryId, date, busy, onProcess, flash }) {
  const [nums, setNums] = useState([]);
  const [status, setStatus] = useState(null);
  const [extractId, setExtractId] = useState(null);

  useEffect(() => {
    let active = true;
    api.get('/extracts', { params: { lottery_id: lotteryId, draw_id: drawId, date } })
      .then((r) => {
        const list = r.data.data || r.data;
        const ex = Array.isArray(list) ? list[0] : null;
        if (active && ex) {
          setExtractId(ex.id);
          setStatus(ex.status);
          setNums((ex.numbers || []).slice().sort((a, b) => a.position - b.position));
        }
      });
    return () => { active = false; };
  }, [drawId, lotteryId, date]);

  const completed = nums.length >= 20;

  return (
    <div className="mt-3 bg-gray-900/40 rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-400">{nums.length}/20 números</span>
        {extractId && status === 'pending' && (
          <button
            onClick={() => onProcess(extractId)}
            disabled={!completed || busy[`proc-${extractId}`]}
            title={completed ? '' : 'Completá los 20 números para calcular'}
            className="flex items-center gap-1 text-xs bg-emerald-600/40 hover:bg-emerald-600/60 text-emerald-200 px-2.5 py-1 rounded-lg transition disabled:opacity-40"
          >
            {busy[`proc-${extractId}`] ? <FiRefreshCw size={12} className="animate-spin" /> : <FiPlay size={12} />}
            Calcular premios
          </button>
        )}
        {status === 'completed' && (
          <span className="text-xs text-green-300 bg-green-500/15 px-2 py-1 rounded-full">Procesado</span>
        )}
      </div>
      <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
        {nums.map((n) => (
          <div key={n.id || n.position} className="rounded-lg px-2 py-1.5 text-center bg-gray-800/60">
            <span className="text-[10px] text-gray-500 block">#{n.position}</span>
            <span className="font-mono font-bold text-sm text-white">{n.number}</span>
          </div>
        ))}
        {nums.length === 0 && <span className="text-xs text-gray-500 col-span-full">Sin números cargados.</span>}
      </div>
    </div>
  );
}
