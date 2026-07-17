import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import {
  FiChevronDown, FiChevronUp, FiDownload, FiRefreshCw,
  FiCheckCircle, FiClock, FiGrid, FiAlertTriangle, FiTrash2,
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
  const [draws, setDraws] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDraws, setOpenDraws] = useState(() => new Set());
  const [busy, setBusy] = useState({}); // claves: turno o "turno-loteria"
  const [openExtract, setOpenExtract] = useState(null);
  const [toast, setToast] = useState(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);

  const flash = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  // Siempre se muestran los resultados de hoy (el backend filtra por la fecha
  // actual de Buenos Aires). No se usa ningun filtro de fecha.
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/extracts/scrape/status');
      const raw = Array.isArray(data?.draws) ? data.draws : [];
      // Normaliza por si el backend devuelve lotteries como no-array.
      setDraws(raw.map((d) => ({ ...d, lotteries: Array.isArray(d?.lotteries) ? d.lotteries : [] })));
    } catch (e) {
      flash(e?.response?.data?.message || e?.message || 'No se pudo cargar el estado de extractos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleOpen = (drawId) => {
    setOpenDraws((prev) => {
      const next = new Set(prev);
      if (next.has(drawId)) next.delete(drawId);
      else next.add(drawId);
      return next;
    });
  };

  // Scrape manual desactivado temporalmente (se carga por texto / automático).
  // const scrapeOne = async (drawId, lot) => { ... };
  // const scrapeTurn = async (draw) => { ... };

  const deleteOne = async (drawId, lot) => {
    const key = `del-${drawId}-${lot.lottery_id}`;
    setBusy((b) => ({ ...b, [key]: true }));
    try {
      await api.post('/extracts/delete-grilla', {
        draw_id: drawId, lottery_id: lot.lottery_id,
      });
      flash(`Grilla de ${lot.initials} / ${draws.find((d) => d.draw_id === drawId)?.draw_name} eliminada`);
      await load();
    } catch (e) {
      flash(e?.response?.data?.message || 'Error al eliminar');
    } finally {
      setBusy((b) => ({ ...b, [key]: false }));
    }
  };

  const deleteTurn = async (draw) => {
    const key = `del-turn-${draw.draw_id}`;
    if (!window.confirm(`¿Eliminar la grilla de TODAS las loterías del turno ${draw.draw_name}?`)) return;
    setBusy((b) => ({ ...b, [key]: true }));
    try {
      const { data } = await api.post('/extracts/delete-turn-grilla', { draw_id: draw.draw_id });
      flash(data.message);
      await load();
    } catch (e) {
      flash(e?.response?.data?.message || 'Error al eliminar el turno');
    } finally {
      setBusy((b) => ({ ...b, [key]: false }));
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
          <h2 className="text-xl font-bold text-white">Extractos</h2>
          <p className="text-sm text-gray-400">Resultados de hoy. Cargá desde texto o eliminá grillas por turno.</p>
        </div>
      </div>

      {/* Carga masiva desde texto de resultados */}
      <div className="bg-gray-800/40 backdrop-blur-sm border border-indigo-500/10 rounded-2xl overflow-hidden">
        <button
          onClick={() => setBulkOpen((v) => !v)}
          className="flex items-center justify-between w-full px-5 py-4 text-left hover:opacity-80 transition"
        >
          <span className="flex items-center gap-2 text-indigo-300 font-semibold">
            {bulkOpen ? <FiChevronUp /> : <FiChevronDown />}
            Cargar resultados desde texto
          </span>
          <span className="text-xs text-gray-500">Pegá el bloque de resultados (fecha, sorteo y loterías)</span>
        </button>
        {bulkOpen && (
          <div className="border-t border-gray-700/30 p-4 space-y-3">
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              rows={8}
              placeholder={'📊 RESULTADOS QUINIELA 📊\n🕒 SORTEO: NOCTURNA\n📅 FECHA: 2026-07-16\n\n🎰 PROVINCIA\n01°: 8459    11°: 1964\n...'}
              className="w-full bg-gray-900/50 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-indigo-500"
            />
            <div className="flex items-center gap-3">
              <button
                onClick={async () => {
                  if (!bulkText.trim()) return;
                  setBulkBusy(true);
                  try {
                    const { data } = await api.post('/extracts/parse-bulk', { raw: bulkText });
                    flash(`Cargados ${data.stored} extractos. Fecha ${data.date} · ${data.draw_name}` +
                      (data.unmatched?.length ? ` · sin match: ${data.unmatched.join(', ')}` : ''));
                    setBulkText('');
                    setBulkOpen(false);
                    await load();
                  } catch (e) {
                    flash(e?.response?.data?.message || 'Error al procesar el texto');
                  } finally {
                    setBulkBusy(false);
                  }
                }}
                disabled={bulkBusy || !bulkText.trim()}
                className="flex items-center gap-1.5 text-sm bg-indigo-600/50 hover:bg-indigo-600/70 text-indigo-100 px-4 py-2 rounded-lg transition disabled:opacity-50"
              >
                {bulkBusy ? <FiRefreshCw size={14} className="animate-spin" /> : <FiDownload size={14} />}
                Procesar y cargar
              </button>
              {bulkOpen && (
                <span className="text-xs text-gray-500">
                  Las loterías sin match en la base quedan marcadas como “sin match”.
                </span>
              )}
            </div>
          </div>
        )}
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
                onClick={() => deleteTurn(draw)}
                disabled={busy[`del-turn-${draw.draw_id}`]}
                className="flex items-center gap-1.5 text-xs bg-red-600/40 hover:bg-red-600/60 text-red-200 px-3 py-1.5 rounded-lg transition disabled:opacity-50"
              >
                {busy[`del-turn-${draw.draw_id}`] ? <FiRefreshCw size={13} className="animate-spin" /> : <FiTrash2 size={13} />}
                Eliminar turno
              </button>
            </div>

            {openDraws.has(draw.draw_id) && (
              <div className="border-t border-gray-700/30 divide-y divide-gray-700/20">
                {[...draw.lotteries]
                  .sort((a, b) => lotteryRank(a.initials) - lotteryRank(b.initials))
                  .map((lot) => {
                    const key = `del-${draw.draw_id}-${lot.lottery_id}`;
                    return (
                      <div key={lot.lottery_id} className="px-5 py-3">
                        <div className="flex items-center justify-between">
                           <div className="flex items-center gap-2">
                             <span className="font-mono font-bold text-indigo-300 w-8">{lot.initials}</span>
                             <span className="text-gray-200 text-sm">{lot.name}</span>
                             {lot.defect ? (
                               <span className="flex items-center gap-1 text-xs text-red-300 bg-red-500/15 border border-red-500/40 px-2 py-0.5 rounded-full" title={lot.defect_note || 'Sin horario'}>
                                 <FiAlertTriangle size={11} /> defect{lot.defect_note ? `: ${lot.defect_note}` : ''}
                               </span>
                             ) : (
                               <span className="text-xs text-gray-500">Sorteo {lot.draw_time} · Cierre {lot.closing_time}</span>
                             )}
                           </div>
                           <div className="flex items-center gap-2">
                             {lot.completed ? (
                               <span className="flex items-center gap-1 text-xs text-green-300 bg-green-500/15 px-2 py-1 rounded-full">
                                 <FiCheckCircle size={13} /> {lot.count} cargado{lot.count === 1 ? '' : 's'}
                               </span>
                             ) : (
                               <span className="flex items-center gap-1 text-xs text-yellow-300 bg-yellow-500/15 px-2 py-1 rounded-full">
                                 <FiClock size={13} /> sin cargar
                               </span>
                             )}
                             {lot.extract_id && (
                               <button
                                 onClick={() => setOpenExtract(openExtract === lot.extract_id ? null : lot.extract_id)}
                                 className="flex items-center gap-1 text-xs bg-gray-700/50 hover:bg-gray-700 text-gray-200 px-2.5 py-1 rounded-lg transition"
                               >
                                 <FiGrid size={12} /> Ver
                               </button>
                             )}
                             {lot.extract_id && (
                               <button
                                 onClick={() => deleteOne(draw.draw_id, lot)}
                                 disabled={busy[key]}
                                 className="flex items-center gap-1 text-xs bg-red-600/40 hover:bg-red-600/60 text-red-200 px-2.5 py-1 rounded-lg transition disabled:opacity-50"
                               >
                                 {busy[key] ? <FiRefreshCw size={12} className="animate-spin" /> : <FiTrash2 size={12} />}
                                 Eliminar
                               </button>
                             )}
                           </div>
                        </div>

                        {openExtract === lot.extract_id && lot.extract_id && (
                          <ExtractNumbers drawId={draw.draw_id} lotteryId={lot.lottery_id} extractId={lot.extract_id} />
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

function ExtractNumbers({ drawId, lotteryId, extractId: propExtractId }) {
  const [nums, setNums] = useState([]);
  const [status, setStatus] = useState(null);
  const [extractId, setExtractId] = useState(propExtractId ?? null);

  useEffect(() => {
    let active = true;
    if (propExtractId) {
      setExtractId(propExtractId);
    }
    api.get(`/extracts/${propExtractId}`).then((r) => {
      const ex = r.data.data ?? r.data;
      if (active && ex) {
        setExtractId(ex.id);
        setStatus(ex.status);
        setNums((ex.numbers || []).slice().sort((a, b) => a.position - b.position));
      }
    });
    return () => { active = false; };
  }, [propExtractId]);

  const hasNumbers = nums.length > 0;

  return (
    <div className="mt-3 bg-gray-900/40 rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-400">{nums.length} número(s) cargado(s)</span>
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
