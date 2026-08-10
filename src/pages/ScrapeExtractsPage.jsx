import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  FiChevronDown, FiChevronUp, FiDownload, FiRefreshCw,
  FiCheckCircle, FiClock, FiGrid, FiAlertTriangle, FiTrash2, FiMenu,
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
  const { user } = useAuth();
  const userRoles = Array.isArray(user?.roles) ? user.roles : [];
  const isSuperAdmin = userRoles.includes('super_admin');

  const [draws, setDraws] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDraws, setOpenDraws] = useState(() => new Set());
  const [drawOrder, setDrawOrder] = useState(() => {
    try { return JSON.parse(localStorage.getItem('drawOrder') || '[]'); } catch { return []; }
  });
  const [drawDragId, setDrawDragId] = useState(null);
  const [lotteryOrder, setLotteryOrder] = useState(() => {
    try { return JSON.parse(localStorage.getItem('lotteryOrder') || '{}'); } catch { return {}; }
  });
  const [lotteryDragState, setLotteryDragState] = useState({ drawId: null, fromId: null });

  const persistDrawOrder = useCallback((next) => {
    setDrawOrder(next);
    localStorage.setItem('drawOrder', JSON.stringify(next));
  }, []);

  const reorderDraw = useCallback((fromId, toId, allIds) => {
    if (fromId === toId) return;
    const base = drawOrder.length ? drawOrder.filter((id) => allIds.includes(id)) : [];
    const ids = [...base, ...allIds.filter((id) => !base.includes(id))];
    const fi = ids.indexOf(fromId);
    const ti = ids.indexOf(toId);
    if (fi === -1 || ti === -1) return;
    ids.splice(fi, 1);
    ids.splice(ti, 0, fromId);
    persistDrawOrder(ids);
  }, [drawOrder, persistDrawOrder]);

  const persistLotteryOrder = useCallback((next) => {
    setLotteryOrder(next);
    localStorage.setItem('lotteryOrder', JSON.stringify(next));
  }, []);

  const reorderLottery = useCallback((drawId, fromId, toId, allIds) => {
    if (fromId === toId) return;
    const ids = (lotteryOrder[drawId] && lotteryOrder[drawId].length) ? [...lotteryOrder[drawId]] : [...allIds];
    const fi = ids.indexOf(fromId);
    const ti = ids.indexOf(toId);
    if (fi === -1 || ti === -1) return;
    ids.splice(fi, 1);
    ids.splice(ti, 0, fromId);
    persistLotteryOrder({ ...lotteryOrder, [drawId]: ids });
  }, [lotteryOrder, persistLotteryOrder]);

  const [busy, setBusy] = useState({}); // claves: turno o "turno-loteria"
  const [modalExtract, setModalExtract] = useState(null); // { drawId, lotteryId, extractId, label }
  const [toast, setToast] = useState(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
  const [selectedDate, setSelectedDate] = useState(today());
  const [loadingMongo, setLoadingMongo] = useState({}); // "drawId-lotteryId" -> true
  const [mongoProgress, setMongoProgress] = useState({}); // "drawId-lotteryId" -> { step, message }
  const [mongoOptions, setMongoOptions] = useState(null); // { drawId, lot, targetHora, message, options }
  const [mongoCabezas, setMongoCabezas] = useState({}); // "drawId-lotteryId" -> { match_cabeza, cabezas }
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
        // Sin match exacto: abrir modal solo si realmente hay una diferencia
        // entre turno y hora del schedule esperado (no solo diferencias normales).
        const draw = draws.find((d) => d.draw_id === drawId);
        const schedule = draw?.lotteries.find((l) => l.lottery_id === lot.lottery_id);
        const targetHora = schedule?.draw_time;
        let shouldShowModal = false;
        if (resp.options?.length) {
          shouldShowModal = true;
          for (const opt of resp.options) {
            if (opt.turno !== lot.name || opt.hora !== targetHora) {
              shouldShowModal = true;
              break;
            }
          }
        }
        if (shouldShowModal) {
          setMongoOptions({
            drawId,
            lot,
            message: resp.message,
            options: resp.options || [],
          });
        } else {
          flash('El horario del extracto de MongoDB no coincide con el schedule actual. No se cargó.');
        }
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

  const insertAllFromMongo = async (draw) => {
    const lots = draw.lotteries.filter((lot) => {
      if (lot.completed) return false;
      const mKey = `${draw.draw_id}-${lot.lottery_id}`;
      return !!mongoCabezas[mKey];
    });
    if (lots.length === 0) {
      flash('No hay loterías con cabezas en Mongo para este turno.');
      return;
    }
    const key = `insert-all-${draw.draw_id}`;
    setBusy((b) => ({ ...b, [key]: true }));
    let ok = 0;
    let fail = 0;
    for (let i = 0; i < lots.length; i++) {
      const lot = lots[i];
      const mKey = `${draw.draw_id}-${lot.lottery_id}`;
      setLoadingMongo((prev) => ({ ...prev, [mKey]: true }));
      setMongoProgress((prev) => ({ ...prev, [mKey]: { step: Math.round(((i) / lots.length) * 100), message: `${i + 1}/${lots.length} — ${lot.initials}...` } }));
      try {
        await api.post('/extracts/load-from-mongo', {
          lottery_id: lot.lottery_id,
          draw_id: draw.draw_id,
          date: selectedDate,
        });
        ok++;
      } catch {
        fail++;
      } finally {
        setLoadingMongo((prev) => ({ ...prev, [mKey]: false }));
        setMongoProgress((prev) => ({ ...prev, [mKey]: undefined }));
      }
    }
    flash(`Turno ${draw.draw_name}: ${ok} cargados, ${fail} fallidos.`);
    savedScrollY.current = window.scrollY;
    await load();
    requestAnimationFrame(() => window.scrollTo(0, savedScrollY.current));
    setBusy((b) => ({ ...b, [key]: false }));
  };

  // Importa la grilla desde la API JSON de loterias (fuente primaria).
  // Solo se ofrece para las loterias que la API cubre (`api_cubierta`); el
  // resto se sigue cargando desde Mongo o a mano.
  // Importación desde API deshabilitada temporalmente — la API de almacendedatos está desactivada
  // const importFromApi = async (drawId, lot) => {
  //   const key = `api-${drawId}-${lot.lottery_id}`;
  //   setBusy((b) => ({ ...b, [key]: true }));
  //   try {
  //     const { data } = await api.post('/extracts/import-api', {
  //       lottery_id: lot.lottery_id,
  //       draw_id: drawId,
  //       date: selectedDate,
  //     });
  //     if ((data.cargados || []).some((c) => c.initials === lot.initials)) {
  //       flash(`${lot.initials}: grilla cargada desde la API.`);
  //     } else {
  //       const motivo = data.rechazados?.[0]?.motivo || '';
  //       if (/TOKEN_NO_CONFIGURADO|TOKEN_FALTANTE|TOKEN_INVALIDO/.test(motivo)) {
  //         flash(`${lot.initials}: la API no esta configurada. Falta el token en el backend (LOTERIA_API_TOKEN).`);
  //       } else {
  //         flash(`${lot.initials}: ${motivo || 'la API todavia no tiene la grilla completa.'}`);
  //       }
  //     }
  //     savedScrollY.current = window.scrollY;
  //     await load();
  //     requestAnimationFrame(() => window.scrollTo(0, savedScrollY.current));
  //   } catch (e) {
  //     flash(e?.response?.data?.message || `Error al importar ${lot.initials} desde la API`);
  //   } finally {
  //     setBusy((b) => ({ ...b, [key]: false }));
  //   }
  // };

  // Preview del botón "Cargar desde Mongo": cabezas (posición 1) de los
  // extractos que MongoDB tiene para la fecha elegida. El botón solo se
  // muestra cuando hay cabezas disponibles. Falla silencioso: si Mongo no
  // responde, no se renderiza nada.
  const loadCabezas = useCallback(async (d) => {
    try {
      const { data } = await api.get('/extracts/mongo-cabezas', { params: { date: d } });
      setMongoCabezas(data?.data || {});
    } catch {
      setMongoCabezas({});
    }
  }, []);

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
    loadCabezas(d);
  }, [selectedDate, loadCabezas]);

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

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Extractos</h2>
          <p className="text-sm text-gray-400">
            {isSuperAdmin
              ? 'Cargá resultados desde la API, desde MongoDB o desde texto. Eliminá grillas por turno o lotería.'
              : 'Consultá los extractos y números sorteados por turno y lotería.'}
          </p>
          {drawOrder.length > 0 && (
            <button
              onClick={() => persistDrawOrder([])}
              className="mt-1 text-xs text-indigo-400 hover:text-indigo-300 underline transition"
            >
              Restablecer orden de turnos
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <label className="text-xs text-gray-400">Fecha</label>
          <input
            type="date"
            value={selectedDate}
            onChange={handleDateChange}
            className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {isSuperAdmin && (
        <div className="flex justify-end">
          <Link
            to="/extracts/manual"
            className="flex items-center gap-1.5 text-sm bg-indigo-600/50 hover:bg-indigo-600/70 text-indigo-100 px-4 py-2 rounded-lg transition"
          >
            <FiGrid size={14} /> Carga manual
          </Link>
        </div>
      )}

      {isSuperAdmin && (
        <div className="bg-gray-800/40 backdrop-blur-sm border border-indigo-500/10 rounded-2xl overflow-hidden">
          <button
            onClick={() => setBulkOpen((v) => !v)}
            className="flex items-center justify-between w-full px-5 py-4 text-left hover:opacity-80 transition"
          >
            <span className="flex items-center gap-2 text-indigo-300 font-semibold">
              {bulkOpen ? <FiChevronUp /> : <FiChevronDown />}
              Cargar resultados desde texto
            </span>
            <span className="text-xs text-gray-500 hidden sm:inline">Pegá el bloque de resultados (fecha, sorteo y loterías)</span>
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
                         if (!ok) offset += BATCH;
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
      )}

      {[...draws]
        .sort((a, b) => {
          if (!drawOrder.length) return 0;
          const ai = drawOrder.indexOf(a.draw_id);
          const bi = drawOrder.indexOf(b.draw_id);
          return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
        })
        .map((draw) => {
        const completos = draw.lotteries.filter((l) => l.completed).length;
        return (
          <div
            key={draw.draw_id}
            className={`bg-gray-800/40 backdrop-blur-sm border border-indigo-500/10 rounded-2xl overflow-hidden ${drawDragId === draw.draw_id ? 'opacity-30 ring-2 ring-indigo-500' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
            }}
            onDragEnter={(e) => {
              e.preventDefault();
              if (drawDragId !== null && drawDragId !== draw.draw_id) {
                reorderDraw(drawDragId, draw.draw_id, draws.map((d) => d.draw_id));
              }
            }}
          >
            <div
              className="flex items-center justify-between px-5 py-4 cursor-grab active:cursor-grabbing"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'move';
                setDrawDragId(draw.draw_id);
              }}
              onDragEnd={() => setDrawDragId(null)}
            >
              <button
                onClick={() => toggleOpen(draw.draw_id)}
                className="flex items-center gap-2 sm:gap-3 text-left hover:opacity-80 transition min-w-0"
              >
                <span className="text-indigo-400 font-bold text-base sm:text-lg shrink-0">{draw.draw_name}</span>
                <span className="text-xs text-gray-500 bg-gray-700/50 px-2 py-0.5 rounded-full">
                  {completos}/{draw.lotteries.length} completos
                </span>
                {openDraws.has(draw.draw_id) ? <FiChevronUp className="text-gray-400" /> : <FiChevronDown className="text-gray-400" />}
              </button>
              <div className="flex items-center gap-2">
                {isSuperAdmin && (
                  <>
                    {(() => {
                      const hasCabezas = draw.lotteries.some((lot) => {
                        if (lot.completed || !mongoCabezas[`${draw.draw_id}-${lot.lottery_id}`]) return false;
                        
                        // Validar que la hora oficial del sorteo ya haya pasado
                        const drawTime = lot.draw_time ? new Date(`${selectedDate}T${lot.draw_time}:00-03:00`) : null;
                        const now = new Date();
                        if (drawTime && now < drawTime) return false;
                        
                        return true;
                      });
                      if (!hasCabezas) return null;
                      return (
                        <button
                          onClick={(e) => { e.stopPropagation(); insertAllFromMongo(draw); }}
                          disabled={busy[`insert-all-${draw.draw_id}`]}
                          title="Cargar todas las loterías de este turno desde Mongo a MySQL"
                          className="flex items-center justify-center text-emerald-300 hover:text-white hover:bg-emerald-600/60 bg-emerald-600/20 border border-emerald-500/30 p-2 rounded-lg transition disabled:opacity-50 animate-pulse hover:animate-none shadow-[0_0_8px_rgba(16,185,129,0.4)]"
                        >
                          {busy[`insert-all-${draw.draw_id}`] ? <FiRefreshCw size={15} className="animate-spin" /> : <FiDownload size={15} />}
                        </button>
                      );
                    })()}
                    {draw.lotteries.some(lot => lot.completed || lot.extract_id) && (
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteTurn(draw); }}
                        disabled={busy[`del-turn-${draw.draw_id}`]}
                        title="Eliminar la grilla de todas las loterías de este turno"
                        className="flex items-center justify-center text-red-300 hover:text-white hover:bg-red-600/60 bg-red-600/20 border border-red-500/30 p-2 rounded-lg transition disabled:opacity-50"
                      >
                        {busy[`del-turn-${draw.draw_id}`] ? <FiRefreshCw size={15} className="animate-spin" /> : <FiTrash2 size={15} />}
                      </button>
                    )}
                  </>
                )}
                <FiMenu className="text-gray-600" size={16} />
              </div>
            </div>

            {openDraws.has(draw.draw_id) && (
              <div className="border-t border-gray-700/30 divide-y divide-gray-700/20">
                {[...draw.lotteries]
                  .sort((a, b) => {
                    const custom = lotteryOrder[draw.draw_id];
                    if (custom) {
                      const ai = custom.indexOf(a.lottery_id);
                      const bi = custom.indexOf(b.lottery_id);
                      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
                    }
                    return lotteryRank(a.initials) - lotteryRank(b.initials);
                  })
                  .map((lot) => {
                    const key = `del-${draw.draw_id}-${lot.lottery_id}`;
                    const isDragging = lotteryDragState.fromId === lot.lottery_id;
                    return (
                      <div
                        key={lot.lottery_id}
                        className={`px-4 sm:px-5 py-3 transition ${isDragging ? 'opacity-30' : ''}`}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = 'move';
                          setLotteryDragState({ drawId: draw.draw_id, fromId: lot.lottery_id });
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                        }}
                        onDragEnter={(e) => {
                          e.preventDefault();
                          if (lotteryDragState.fromId && lotteryDragState.fromId !== lot.lottery_id) {
                            reorderLottery(draw.draw_id, lotteryDragState.fromId, lot.lottery_id, draw.lotteries.map((l) => l.lottery_id));
                          }
                        }}
                        onDragEnd={() => setLotteryDragState({ drawId: null, fromId: null })}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                           <div className="flex items-center gap-2 min-w-0">
                             <span className="text-gray-600 cursor-grab active:cursor-grabbing touch-none shrink-0">
                               <FiMenu size={14} />
                             </span>
                             <span className="font-mono font-bold text-indigo-300 w-8 shrink-0">{lot.initials}</span>
                             <span className="text-gray-200 text-sm truncate">{lot.name}</span>
                             {lot.defect ? (
                               <span className="flex items-center gap-1 text-xs text-red-300 bg-red-500/15 border border-red-500/40 px-2 py-0.5 rounded-full shrink-0" title={lot.defect_note || 'Sin horario'}>
                                 <FiAlertTriangle size={11} /> defect{lot.defect_note ? `: ${lot.defect_note}` : ''}
                               </span>
                             ) : (
                               <span className="text-xs text-gray-500 hidden sm:inline">
                                 Sorteo {lot.draw_time} · Cierre {lot.closing_time}
                                 {lot.initials === 'PAR' ? (draw.draw_id === 1 ? ' ( + CAT )' : ' ( + SGO )') : ''}
                               </span>
                             )}
                             {lot.cabeza && (
                               <span className="hidden sm:flex items-center justify-center min-w-[3rem] px-2 py-0.5 text-sm font-bold text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-md font-mono tracking-widest leading-none ml-2 shadow-[0_0_8px_rgba(234,179,8,0.2)]">
                                 {lot.cabeza}
                               </span>
                             )}
                           </div>
                           <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                              {lot.completed ? (
                                <span className="flex items-center gap-1 text-xs text-green-300 bg-green-500/15 px-2 py-1 rounded-full">
                                  <FiCheckCircle size={13} /> {lot.count} cargado{lot.count === 1 ? '' : 's'}
                                </span>
                               ) : (
                                 <span className="flex items-center gap-1 text-xs text-yellow-300 bg-yellow-500/15 px-2 py-1 rounded-full">
                                   <FiClock size={13} /> sin cargar
                                 </span>
                               )}
                              {/* Botón API deshabilitado temporalmente — la API de almacendedatos está desactivada
                              {isSuperAdmin && !lot.completed && lot.api_cubierta && (
                                <button
                                  onClick={() => importFromApi(draw.draw_id, lot)}
                                  disabled={busy[`api-${draw.draw_id}-${lot.lottery_id}`]}
                                  title="Importar esta grilla desde la API de loterías"
                                  className="flex items-center gap-1 text-xs bg-emerald-600/40 hover:bg-emerald-600/60 text-emerald-100 px-2.5 py-1 rounded-lg transition disabled:opacity-50"
                                >
                                  {busy[`api-${draw.draw_id}-${lot.lottery_id}`]
                                    ? <FiRefreshCw size={12} className="animate-spin" />
                                    : <FiDownloadCloud size={12} />} API
                                </button>
                              )}
                              */}
                              {isSuperAdmin && !lot.completed ? (
                                (() => {
                                  const mKey = `${draw.draw_id}-${lot.lottery_id}`;
                                  const prog = mongoProgress[mKey];
                                  if (loadingMongo[mKey] && prog) {
                                    return (
                                      <div className="flex items-center gap-2 min-w-0">
                                        <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden w-20">
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
                                  const cab = mongoCabezas[mKey];
                                  const preview = cab ? (cab.match_cabeza ?? cab.cabezas.join('|')) : null;
                                  if (!preview) return null;
                                  
                                  // Solo mostrar la cabeza de Mongo si la hora oficial del sorteo ya pasó
                                  const drawTime = lot.draw_time ? new Date(`${selectedDate}T${lot.draw_time}:00-03:00`) : null;
                                  const now = new Date();
                                  if (drawTime && now < drawTime) return null;
                                  
                                  return (
                                    <button
                                      onClick={() => loadFromMongo(draw.draw_id, lot)}
                                      title={cab.match_cabeza
                                        ? `Cabeza ${preview} en MongoDB — cargar`
                                        : `Cabezas en MongoDB: ${preview} — click para elegir turno`}
                                      className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg transition bg-yellow-600/40 hover:bg-yellow-600/60 text-yellow-100 border border-yellow-500/30"
                                    >
                                      <span className="font-mono font-bold tracking-widest">{preview}</span>
                                      <FiChevronUp size={13} />
                                    </button>
                                  );
                                })()
                              ) : null}
                              {lot.extract_id && (
                               <button
                                 onClick={() => setModalExtract({ drawId: draw.draw_id, lotteryId: lot.lottery_id, extractId: lot.extract_id, label: `${lot.initials} — ${draw.draw_name}`, time: lot.draw_time })}
                                 className="flex items-center gap-1 text-xs bg-gray-700/50 hover:bg-gray-700 text-gray-200 px-2.5 py-1 rounded-lg transition"
                               >
                                 <FiGrid size={12} /> Ver
                               </button>
                              )}
                              {isSuperAdmin && lot.extract_id && (
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

                        {/* Horarios visible solo en mobile debajo del nombre */}
                        {!lot.defect && (
                          <div className="flex items-center gap-2 mt-1 ml-10 sm:hidden">
                            <span className="text-xs text-gray-500">
                              Sorteo {lot.draw_time} · Cierre {lot.closing_time}
                              {lot.initials === 'PAR' ? (draw.draw_id === 1 ? ' ( + CAT )' : ' ( + SGO )') : ''}
                            </span>
                            {lot.cabeza && (
                              <span className="flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded font-mono tracking-wider shadow-[0_0_8px_rgba(234,179,8,0.2)]">
                                {lot.cabeza}
                              </span>
                            )}
                          </div>
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

      {modalExtract && (
        <ExtractNumbersModal
          extractId={modalExtract.extractId}
          label={modalExtract.label}
          time={modalExtract.time}
          onClose={() => setModalExtract(null)}
        />
      )}
    </div>
  );
}

function ExtractNumbersModal({ extractId, label, time, onClose }) {
  const [nums, setNums] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.get(`/extracts/${extractId}`).then((r) => {
      const ex = r.data.data ?? r.data;
      if (active && ex) {
        setNums((ex.numbers || []).slice().sort((a, b) => a.position - b.position));
      }
    }).catch(() => {}).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [extractId]);

  const col1 = nums.filter((n) => n.position >= 1 && n.position <= 10);
  const col2 = nums.filter((n) => n.position >= 11 && n.position <= 20);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md bg-gray-900 border border-indigo-500/20 rounded-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700/50">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white">{label}</h3>
            {time && <span className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded border border-gray-700 font-mono">{time}</span>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-lg leading-none">&times;</button>
        </div>
        <div className="px-5 py-4">
          {loading ? (
            <div className="text-center text-gray-400 text-sm py-8">Cargando...</div>
          ) : nums.length === 0 ? (
            <div className="text-center text-gray-500 text-sm py-8">Sin números cargados.</div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2 font-semibold">Posiciones 1–10</div>
                <div className="space-y-1">
                  {col1.map((n) => (
                    <div key={n.position} className="flex items-center gap-2 bg-gray-800/60 rounded-lg px-3 py-2">
                      <span className="text-[10px] text-gray-500 w-5 text-right">#{n.position}</span>
                      <span className="font-mono font-bold text-white">{n.number}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2 font-semibold">Posiciones 11–20</div>
                <div className="space-y-1">
                  {col2.map((n) => (
                    <div key={n.position} className="flex items-center gap-2 bg-gray-800/60 rounded-lg px-3 py-2">
                      <span className="text-[10px] text-gray-500 w-5 text-right">#{n.position}</span>
                      <span className="font-mono font-bold text-white">{n.number}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
