import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import {
  FiChevronDown, FiChevronUp, FiDownload, FiRefreshCw,
  FiCheckCircle, FiClock, FiGrid, FiAlertTriangle, FiTrash2, FiUpload,
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
  const today = () => new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(today());
  const [loadingMongo, setLoadingMongo] = useState({}); // "drawId-lotteryId" -> true
  const [mongoProgress, setMongoProgress] = useState({}); // "drawId-lotteryId" -> { step, message }
  const [mongoOptions, setMongoOptions] = useState(null); // { drawId, lot, targetHora, message, options }
  const savedScrollY = useRef(0);

  const flash = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const loadFromMongo = async (drawId, lot, mongoExtractoId = null) => {
    const key = `${drawId}-${lot.lottery_id}`;
    setLoadingMongo((prev) => ({ ...prev, [key]: true }));
    setMongoProgress((prev) => ({ ...prev, [key]: { step: 0, message: 'Conectando con MongoDB...' } }));

    try {
      setMongoProgress((prev) => ({ ...prev, [key]: { step: 25, message: 'Buscando extracto en MongoDB...' } }));
      const payload = {
        lottery_id: lot.lottery_id,
        draw_id: drawId,
        date: selectedDate,
      };
      if (mongoExtractoId) payload.mongo_extracto_id = mongoExtractoId;
      const { data } = await api.post('/extracts/load-from-mongo', payload);

      setMongoProgress((prev) => ({ ...prev, [key]: { step: 75, message: 'Guardando en base de datos...' } }));

      await new Promise((r) => setTimeout(r, 300));

      setMongoProgress((prev) => ({ ...prev, [key]: { step: 100, message: '¡Completado!' } }));
      flash(`${lot.initials}: ${data.message}`);
      setMongoOptions(null);
      savedScrollY.current = window.scrollY;
      await load();
      requestAnimationFrame(() => window.scrollTo(0, savedScrollY.current));
    } catch (e) {
      const resp = e?.response?.data;
      if (resp?.no_match) {
        // Sin match exacto: abrir modal con las opciones que existen en Mongo.
        setMongoOptions({
          drawId,
          lot,
          message: resp.message,
          options: resp.options || [],
        });
      } else {
        flash(resp?.message || `Error al cargar ${lot.initials}`);
      }
      setLoadingMongo((prev) => ({ ...prev, [key]: false }));
      setMongoProgress((prev) => ({ ...prev, [key]: undefined }));
    } finally {
      setTimeout(() => {
        setLoadingMongo((prev) => ({ ...prev, [key]: false }));
        setMongoProgress((prev) => ({ ...prev, [key]: undefined }));
      }, 2000);
    }
  };

  const load = useCallback(async (date) => {
    const d = date || selectedDate;
    setLoading(true);
    try {
      const { data } = await api.get(`/extracts/scrape/status?fresh=1&date=${d}`);
      const raw = Array.isArray(data?.draws) ? data.draws : [];
      setDraws(raw.map((d) => ({ ...d, lotteries: Array.isArray(d?.lotteries) ? d.lotteries : [] })));
    } catch (e) {
      flash(e?.response?.data?.message || e?.message || 'No se pudo cargar el estado de extractos');
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => { load(); }, [load]);

  const handleDateChange = (e) => {
    setSelectedDate(e.target.value);
  };

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

  const [confirm, setConfirm] = useState(null); // { title, message, onConfirm }

  const deleteOne = (drawId, lot) => {
    const drawName = draws.find((d) => d.draw_id === drawId)?.draw_name;
    setConfirm({
      title: `Eliminar grilla de ${lot.initials}`,
      message: `Se eliminará la grilla completa de 20 números de ${lot.name} (${lot.initials}) en el turno ${drawName}. Esta acción no se puede deshacer.`,
      onConfirm: async () => {
        const key = `del-${drawId}-${lot.lottery_id}`;
        setBusy((b) => ({ ...b, [key]: true }));
        try {
          await api.post('/extracts/delete-grilla', {
            draw_id: drawId, lottery_id: lot.lottery_id, date: selectedDate,
          });
          flash(`Grilla de ${lot.initials} / ${drawName} eliminada`);
          await load();
        } catch (e) {
          flash(e?.response?.data?.message || 'Error al eliminar');
        } finally {
          setBusy((b) => ({ ...b, [key]: false }));
        }
      },
    });
  };

  const deleteTurn = (draw) => {
    setConfirm({
      title: `Eliminar turno ${draw.draw_name}`,
      message: `Se eliminará la grilla completa de 20 números de TODAS las loterías del turno ${draw.draw_name}. Esta acción no se puede deshacer.`,
      onConfirm: async () => {
        const key = `del-turn-${draw.draw_id}`;
        setBusy((b) => ({ ...b, [key]: true }));
        try {
          const { data } = await api.post('/extracts/delete-turn-grilla', { draw_id: draw.draw_id, date: selectedDate });
          flash(data.message);
          await load();
        } catch (e) {
          flash(e?.response?.data?.message || 'Error al eliminar el turno');
        } finally {
          setBusy((b) => ({ ...b, [key]: false }));
        }
      },
    });
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
          <p className="text-sm text-gray-400">Cargá resultados desde MongoDB o desde texto. Eliminá grillas por turno o lotería.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-400">Fecha</label>
          <input
            type="date"
            value={selectedDate}
            onChange={handleDateChange}
            className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Acceso a la carga manual, de a un sorteo por vez */}
      <div className="flex justify-end">
        <Link
          to="/extracts/manual"
          className="flex items-center gap-1.5 text-sm bg-indigo-600/50 hover:bg-indigo-600/70 text-indigo-100 px-4 py-2 rounded-lg transition"
        >
          <FiGrid size={14} /> Carga manual
        </Link>
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
                     // Carga por lotes para no superar el timeout de Railway
                     // cuando el proxy MySQL es inestable. Cada lote reintenta
                     // hasta 3 veces; si un lote falla se reporta y se sigue
                     // con el siguiente (no se pierde todo el texto).
                     const BATCH = 5;
                     let offset = 0;
                     let total = null;
                     let stored = 0;
                     let pending = [];
                     do {
                       let ok = false;
                       for (let attempt = 1; attempt <= 3 && !ok; attempt++) {
                         try {
                           const { data } = await api.post('/extracts/parse-bulk', {
                             raw: bulkText, offset, limit: BATCH,
                           });
                           if (total === null) total = data.total;
                           stored += data.stored;
                           if (data.failed?.length) pending.push(...data.failed.map((f) => f.initials));
                           offset += BATCH;
                           ok = true;
                         } catch (err) {
                           if (attempt === 3) {
                             flash('Lote fallido (reintentos agotados). Reintentá más tarde.');
                           } else {
                             await new Promise((r) => setTimeout(r, 800));
                           }
                         }
                       }
                       if (!ok) offset += BATCH; // evita bucle infinito si sigue fallando
                     } while (total !== null && offset < total);

                     flash(`Cargados ${stored} extractos.` +
                       (pending.length ? ` Sin guardar: ${pending.join(', ')}` : ' Completo.'));
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
                title="Eliminar la grilla de todas las loterías de este turno"
                className="flex items-center justify-center text-red-300 hover:text-white hover:bg-red-600/60 bg-red-600/20 border border-red-500/30 p-2 rounded-lg transition disabled:opacity-50"
              >
                {busy[`del-turn-${draw.draw_id}`] ? <FiRefreshCw size={15} className="animate-spin" /> : <FiTrash2 size={15} />}
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
                              {!lot.completed ? (
                                (() => {
                                  const mKey = `${draw.draw_id}-${lot.lottery_id}`;
                                  const prog = mongoProgress[mKey];
                                  if (loadingMongo[mKey] && prog) {
                                    return (
                                      <div className="flex items-center gap-2 min-w-[140px]">
                                        <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                                          <div
                                            className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                                            style={{ width: `${prog.step}%` }}
                                          />
                                        </div>
                                        <span className="text-xs text-indigo-300 whitespace-nowrap">{prog.step}%</span>
                                      </div>
                                    );
                                  }
                                  if (loadingMongo[mKey]) {
                                    return (
                                      <div className="flex items-center gap-1">
                                        <FiRefreshCw size={13} className="animate-spin text-indigo-400" />
                                        <span className="text-xs text-indigo-300">Cargando...</span>
                                      </div>
                                    );
                                  }
                                  return (
                                    <button
                                      onClick={() => loadFromMongo(draw.draw_id, lot)}
                                      className="flex items-center gap-1 text-xs bg-indigo-600/50 hover:bg-indigo-600/70 text-indigo-100 px-2.5 py-1 rounded-lg transition"
                                    >
                                      <FiUpload size={12} /> Cargar
                                    </button>
                                  );
                                })()
                              ) : null}
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
                                  title="Eliminar esta grilla"
                                  className="flex items-center justify-center text-red-300 hover:text-white hover:bg-red-600/60 bg-red-600/20 border border-red-500/30 p-1.5 rounded-lg transition disabled:opacity-50"
                                >
                                  {busy[key] ? <FiRefreshCw size={13} className="animate-spin" /> : <FiTrash2 size={13} />}
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

      {mongoOptions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-gray-900 border border-yellow-500/30 rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-700/50">
              <span className="flex items-center justify-center w-9 h-9 rounded-full bg-yellow-500/15 text-yellow-400">
                <FiAlertTriangle size={18} />
              </span>
              <h3 className="text-base font-semibold text-white">Sin match exacto</h3>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm text-gray-300 leading-relaxed">{mongoOptions.message}</p>
              <p className="text-xs text-gray-500 mt-1">Elegí qué extracto cargar para {mongoOptions.lot.initials}:</p>
              <div className="mt-3 space-y-2 max-h-64 overflow-y-auto">
                {mongoOptions.options.length === 0 && (
                  <p className="text-xs text-gray-500">No hay extractos en Mongo para esta lotería en esta fecha.</p>
                )}
                {mongoOptions.options.map((opt) => (
                  <button
                    key={opt._id}
                    onClick={() => loadFromMongo(mongoOptions.drawId, mongoOptions.lot, opt._id)}
                    className="w-full flex items-center justify-between px-4 py-2.5 bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-500/30 rounded-lg text-sm text-indigo-100 transition"
                  >
                    <span className="font-semibold">{opt.turno}</span>
                    <span className="text-xs text-gray-300">{opt.hora} · {opt.count} nums</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-700/50">
              <button
                onClick={() => setMongoOptions(null)}
                className="text-sm text-gray-300 hover:text-white bg-gray-700/60 hover:bg-gray-700 px-4 py-2 rounded-lg transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-gray-900 border border-red-500/30 rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-700/50">
              <span className="flex items-center justify-center w-9 h-9 rounded-full bg-red-500/15 text-red-400">
                <FiAlertTriangle size={18} />
              </span>
              <h3 className="text-base font-semibold text-white">{confirm.title}</h3>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm text-gray-300 leading-relaxed">{confirm.message}</p>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-700/50">
              <button
                onClick={() => setConfirm(null)}
                className="text-sm text-gray-300 hover:text-white bg-gray-700/60 hover:bg-gray-700 px-4 py-2 rounded-lg transition"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  const fn = confirm.onConfirm;
                  setConfirm(null);
                  await fn();
                }}
                className="text-sm font-medium text-white bg-red-600 hover:bg-red-500 px-4 py-2 rounded-lg transition"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
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
