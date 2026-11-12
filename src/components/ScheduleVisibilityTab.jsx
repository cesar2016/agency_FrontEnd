import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../services/api';
import { FiRefreshCw, FiLock, FiUnlock, FiCheck, FiEyeOff, FiLayers } from 'react-icons/fi';

const SCOPES = [
  { id: 'daily', label: 'Semana (Lun-Vie)' },
  { id: 'saturday', label: 'Sábados' },
  { id: 'sunday', label: 'Domingos' },
];

export default function ScheduleVisibilityTab({ onChanged }) {
  const [scope, setScope] = useState('daily');
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Herramienta masiva por loterías y turnos
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchMode, setBatchMode] = useState('only_selected');
  const [selectedLotteryIds, setSelectedLotteryIds] = useState([]);
  const [allTurns, setAllTurns] = useState(true);
  const [selectedDrawIds, setSelectedDrawIds] = useState([]);

  const load = useCallback(async (fresh = false) => {
    setLoading(true);
    setError('');
    try {
      const params = fresh ? { fresh: 1, _t: Date.now() } : {};
      const { data } = await api.get('/schedules/status', { params });
      setSections(Array.isArray(data?.sections) ? data.sections : []);
    } catch (e) {
      setError(e?.response?.data?.message || 'Error al cargar los turnos y loterías.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(true);
  }, [load]);

  const currentLotteries = useMemo(() => {
    return sections.find((sec) => sec.scope === scope)?.lotteries || [];
  }, [sections, scope]);

  const turns = useMemo(() => {
    const byDraw = new Map();

    for (const lot of currentLotteries) {
      for (const s of lot.schedules || []) {
        if (!byDraw.has(s.draw_id)) {
          byDraw.set(s.draw_id, {
            draw_id: s.draw_id,
            draw_name: s.draw,
            items: [],
          });
        }
        byDraw.get(s.draw_id).items.push({
          schedule_id: s.id,
          lottery_id: lot.lottery_id,
          initials: lot.initials,
          name: lot.name,
          draw_time: s.draw_time,
          is_active: Boolean(s.is_active),
        });
      }
    }

    return Array.from(byDraw.values()).sort((a, b) => a.draw_id - b.draw_id);
  }, [currentLotteries]);

  const toggleLotteryChoice = (lotteryId) => {
    setSelectedLotteryIds((prev) =>
      prev.includes(lotteryId) ? prev.filter((id) => id !== lotteryId) : [...prev, lotteryId]
    );
  };

  const toggleDrawChoice = (drawId) => {
    setAllTurns(false);
    setSelectedDrawIds((prev) =>
      prev.includes(drawId) ? prev.filter((id) => id !== drawId) : [...prev, drawId]
    );
  };

  const applyBatch = async () => {
    if (selectedLotteryIds.length === 0) {
      setError('Seleccioná al menos una lotería para aplicar el cambio.');
      return;
    }
    if (!allTurns && selectedDrawIds.length === 0) {
      setError('Seleccioná al menos un turno o marcá "Todos los turnos".');
      return;
    }

    setBusyKey('batch');
    setError('');
    setSuccessMsg('');
    try {
      const { data } = await api.post('/schedules/toggle-bulk', {
        mode: batchMode,
        lottery_ids: selectedLotteryIds,
        draw_ids: allTurns ? [] : selectedDrawIds,
        day_scope: scope,
      });
      setSuccessMsg(data?.message || 'Cambios aplicados correctamente.');
      await load(true);
      onChanged?.();
    } catch (e) {
      setError(e?.response?.data?.message || 'No se pudo aplicar el cambio masivo.');
    } finally {
      setBusyKey(null);
    }
  };

  const toggleTurn = async (drawId, nextActive) => {
    const key = `turn-${scope}-${drawId}`;
    setBusyKey(key);
    setError('');
    setSuccessMsg('');
    try {
      await api.post('/schedules/toggle-bulk', {
        draw_id: drawId,
        day_scope: scope,
        is_active: nextActive,
      });
      await load(true);
      onChanged?.();
    } catch (e) {
      setError(e?.response?.data?.message || 'No se pudo actualizar el turno.');
    } finally {
      setBusyKey(null);
    }
  };

  const toggleLotterySchedule = async (scheduleId, nextActive) => {
    const key = `sched-${scheduleId}`;
    setBusyKey(key);
    setError('');
    setSuccessMsg('');
    try {
      await api.post('/schedules/toggle-bulk', {
        schedule_ids: [scheduleId],
        is_active: nextActive,
      });
      await load(true);
      onChanged?.();
    } catch (e) {
      setError(e?.response?.data?.message || 'No se pudo actualizar la lotería.');
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex bg-gray-800/80 border border-indigo-500/20 rounded-xl p-1 gap-1">
          {SCOPES.map((sc) => (
            <button
              key={sc.id}
              type="button"
              onClick={() => {
                setScope(sc.id);
                setSuccessMsg('');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                scope === sc.id
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {sc.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setBatchOpen((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer ${
              batchOpen
                ? 'bg-indigo-600 border-indigo-500 text-white'
                : 'bg-gray-800 hover:bg-gray-700 border-gray-700 text-indigo-300'
            }`}
          >
            <FiLayers size={13} />
            Regla por loterías
          </button>

          <button
            type="button"
            onClick={() => load(true)}
            disabled={loading}
            className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-200 px-3 py-1.5 rounded-lg text-xs transition cursor-pointer"
          >
            <FiRefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Actualizar
          </button>
        </div>
      </div>

      {batchOpen && (
        <div className="bg-gray-800/60 border border-indigo-500/30 rounded-2xl p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-white">
              Aplicar loterías a uno o varios turnos
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 'only_selected', label: 'Solo ver elegidas' },
                { id: 'hide_selected', label: 'Dejar de ver elegidas' },
                { id: 'show_selected', label: 'Habilitar elegidas' },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setBatchMode(m.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                    batchMode === m.id
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-900/60 text-gray-400 hover:text-white border border-gray-700/60'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">
                1. Elegí las loterías ({selectedLotteryIds.length} seleccionadas)
              </span>
              {selectedLotteryIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedLotteryIds([])}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 cursor-pointer"
                >
                  Limpiar selección
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {currentLotteries.map((lot) => {
                const selected = selectedLotteryIds.includes(lot.lottery_id);
                return (
                  <button
                    key={lot.lottery_id}
                    type="button"
                    onClick={() => toggleLotteryChoice(lot.lottery_id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition cursor-pointer ${
                      selected
                        ? 'bg-indigo-500/25 border-indigo-400 text-white'
                        : 'bg-gray-900/50 border-gray-700/60 text-gray-400 hover:text-white'
                    }`}
                  >
                    {lot.initials}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-xs text-gray-400 block">
              2. Elegí en qué turno(s) aplicar
            </span>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setAllTurns(true);
                  setSelectedDrawIds([]);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition cursor-pointer ${
                  allTurns
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                    : 'bg-gray-900/50 border-gray-700/60 text-gray-400 hover:text-white'
                }`}
              >
                Todos los turnos
              </button>
              {turns.map((t) => {
                const active = !allTurns && selectedDrawIds.includes(t.draw_id);
                return (
                  <button
                    key={t.draw_id}
                    type="button"
                    onClick={() => toggleDrawChoice(t.draw_id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition cursor-pointer ${
                      active
                        ? 'bg-indigo-500/25 border-indigo-400 text-white'
                        : 'bg-gray-900/50 border-gray-700/60 text-gray-400 hover:text-white'
                    }`}
                  >
                    {t.draw_name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              disabled={busyKey === 'batch'}
              onClick={applyBatch}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              <FiCheck size={14} />
              {busyKey === 'batch' ? 'Aplicando...' : 'Aplicar cambio'}
            </button>
          </div>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs px-4 py-2.5 rounded-xl">
          {successMsg}
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-xs px-4 py-2.5 rounded-xl">
          {error}
        </div>
      )}

      {loading && sections.length === 0 ? (
        <div className="flex justify-center py-12">
          <FiRefreshCw className="animate-spin text-indigo-400" size={28} />
        </div>
      ) : turns.length === 0 ? (
        <div className="bg-gray-800/40 border border-indigo-500/10 rounded-2xl p-6 text-center text-gray-400 text-sm">
          No hay turnos configurados para este alcance.
        </div>
      ) : (
        <div className="space-y-3">
          {turns.map((turn) => {
            const activeCount = turn.items.filter((i) => i.is_active).length;
            const totalCount = turn.items.length;
            const anyActive = activeCount > 0;
            const turnBusy = busyKey === `turn-${scope}-${turn.draw_id}`;

            return (
              <div
                key={turn.draw_id}
                className={`bg-gray-800/40 backdrop-blur-sm border rounded-2xl overflow-hidden transition ${
                  anyActive ? 'border-indigo-500/20' : 'border-red-500/20 opacity-80'
                }`}
              >
                <div className="flex items-center justify-between gap-3 px-4 py-3 bg-gray-900/50 border-b border-gray-700/40">
                  <div>
                    <h3 className="text-white font-semibold text-sm flex items-center gap-2">
                      {turn.draw_name}
                      {!anyActive && (
                        <span className="text-[11px] bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full">
                          Turno bloqueado
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-gray-400">
                      {activeCount} de {totalCount} loterías habilitadas
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={turnBusy}
                    onClick={() => toggleTurn(turn.draw_id, !anyActive)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer disabled:opacity-50 ${
                      anyActive
                        ? 'bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30'
                        : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30'
                    }`}
                  >
                    {anyActive ? (
                      <>
                        <FiLock size={13} /> Bloquear turno
                      </>
                    ) : (
                      <>
                        <FiUnlock size={13} /> Habilitar turno
                      </>
                    )}
                  </button>
                </div>

                <div className="p-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {turn.items.map((item) => {
                    const itemBusy = busyKey === `sched-${item.schedule_id}`;
                    return (
                      <button
                        key={item.schedule_id}
                        type="button"
                        disabled={itemBusy || turnBusy}
                        onClick={() => toggleLotterySchedule(item.schedule_id, !item.is_active)}
                        className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-left transition cursor-pointer disabled:opacity-50 ${
                          item.is_active
                            ? 'bg-indigo-500/15 border-indigo-500/30 text-white hover:bg-indigo-500/25'
                            : 'bg-gray-900/40 border-gray-700/40 text-gray-500 hover:text-gray-300'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold truncate">
                            {item.initials}
                            <span className="font-normal text-[11px] text-gray-400 ml-1">
                              {item.draw_time}
                            </span>
                          </div>
                          <div className="text-[11px] truncate opacity-80">{item.name}</div>
                        </div>
                        {item.is_active ? (
                          <FiCheck size={14} className="text-emerald-400 shrink-0" />
                        ) : (
                          <FiEyeOff size={14} className="text-gray-500 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
