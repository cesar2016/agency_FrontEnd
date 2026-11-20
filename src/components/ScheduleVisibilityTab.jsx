import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { FiRefreshCw, FiLock, FiUnlock, FiCheck, FiEyeOff, FiLayers, FiRotateCcw, FiInfo, FiX } from 'react-icons/fi';

const SCOPES = [
  { id: 'daily', label: 'Semana (Lun-Vie)' },
  { id: 'saturday', label: 'Sábados' },
  { id: 'sunday', label: 'Domingos' },
];

const CANONICAL_DRAW_ORDER = [
  'La Previa',
  'Primera',
  'Matutina',
  'Matutina Plus',
  'La Siesta',
  'Vespertina',
  'De la Tarde',
  'Nocturna',
  'Noctura',
  'Nocturna Plus',
];

export default function ScheduleVisibilityTab({ onChanged }) {
  const { user, updateUser } = useAuth();
  const [scope, setScope] = useState('daily');
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Tucumán scheme state & modal
  const [tucScheme, setTucScheme] = useState(() => {
    return user?.schedule_preferences?.tucuman_scheme || 'alternativo';
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingScheme, setPendingScheme] = useState('original');
  const [schemeLoading, setSchemeLoading] = useState(false);

  // Preferencias individuales (IDs de schedules ocultados por este usuario)
  const [hiddenScheduleIds, setHiddenScheduleIds] = useState(() => {
    return Array.isArray(user?.schedule_preferences?.hidden_schedule_ids)
      ? user.schedule_preferences.hidden_schedule_ids
      : [];
  });

  // Herramienta masiva por loterías y turnos
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchMode, setBatchMode] = useState('only_selected');
  const [selectedLotteryIds, setSelectedLotteryIds] = useState([]);
  const [allTurns, setAllTurns] = useState(true);
  const [selectedDrawIds, setSelectedDrawIds] = useState([]);

  const loadTucScheme = useCallback(async () => {
    try {
      const res = await api.get('/schedules/tucuman-scheme');
      if (res.data?.scheme) {
        setTucScheme(res.data.scheme);
      }
    } catch {
      // fallback
    }
  }, []);

  // Carga inicial de grilla de turnos y sincronización de preferencias del usuario
  const load = useCallback(async (fresh = false) => {
    setLoading(true);
    setError('');
    try {
      const params = fresh ? { fresh: 1, _t: Date.now() } : {};
      const [{ data: schedData }, { data: prefData }] = await Promise.all([
        api.get('/schedules/status', { params }),
        api.get('/user/schedule-preferences').catch(() => ({ data: { data: { hidden_schedule_ids: [] } } })),
        loadTucScheme(),
      ]);
      setSections(Array.isArray(schedData?.sections) ? schedData.sections : []);
      const savedHidden = prefData?.data?.hidden_schedule_ids || [];
      const savedScheme = prefData?.data?.tucuman_scheme || 'alternativo';
      setHiddenScheduleIds(savedHidden);
      if (savedScheme) {
        setTucScheme(savedScheme);
      }
      updateUser?.({
        schedule_preferences: {
          hidden_schedule_ids: savedHidden,
          tucuman_scheme: savedScheme,
        },
      });
    } catch (e) {
      setError(e?.response?.data?.message || 'Error al cargar los turnos y loterías.');
    } finally {
      setLoading(false);
    }
  }, [updateUser, loadTucScheme]);

  const handleSelectScheme = (scheme) => {
    setPendingScheme(scheme);
    setModalOpen(true);
  };

  const confirmSchemeChange = async () => {
    if (!pendingScheme) return;
    setSchemeLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await api.post('/schedules/tucuman-scheme', { scheme: pendingScheme });
      setTucScheme(pendingScheme);
      updateUser?.({
        schedule_preferences: {
          ...user?.schedule_preferences,
          tucuman_scheme: pendingScheme,
        },
      });
      setSuccessMsg(res.data?.message || 'Esquema de Tucumán actualizado con éxito.');
      setModalOpen(false);
      await load(true);
      onChanged?.();
    } catch (err) {
      setError(err?.response?.data?.message || 'Error al cambiar esquema de Tucumán.');
      setModalOpen(false);
    } finally {
      setSchemeLoading(false);
    }
  };

  useEffect(() => {
    load(true);
  }, [load]);

  const hiddenSet = useMemo(() => {
    return new Set(hiddenScheduleIds.map(Number));
  }, [hiddenScheduleIds]);

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
          is_active: !hiddenSet.has(Number(s.id)),
        });
      }
    }

    return Array.from(byDraw.values()).sort((a, b) => {
      const ai = CANONICAL_DRAW_ORDER.indexOf(a.draw_name);
      const bi = CANONICAL_DRAW_ORDER.indexOf(b.draw_name);
      if (ai !== -1 && bi !== -1) return ai - bi;
      return a.draw_id - b.draw_id;
    });
  }, [currentLotteries, hiddenSet]);

  // Persistir preferencias individuales
  const savePreferences = async (nextHidden) => {
    const unique = Array.from(new Set(nextHidden.map(Number)));
    setHiddenScheduleIds(unique);
    updateUser?.({
      schedule_preferences: {
        ...(user?.schedule_preferences || {}),
        hidden_schedule_ids: unique,
        tucuman_scheme: tucScheme,
      },
    });

    await api.post('/user/schedule-preferences', {
      hidden_schedule_ids: unique,
      tucuman_scheme: tucScheme,
    });
    onChanged?.();
  };

  const toggleLotterySchedule = async (scheduleId) => {
    const sId = Number(scheduleId);
    const key = `sched-${sId}`;
    setBusyKey(key);
    setError('');
    setSuccessMsg('');
    try {
      const nextHidden = hiddenSet.has(sId)
        ? hiddenScheduleIds.map(Number).filter((id) => id !== sId)
        : [...hiddenScheduleIds.map(Number), sId];
      await savePreferences(nextHidden);
    } catch (e) {
      setError(e?.response?.data?.message || 'No se pudo guardar tu preferencia.');
    } finally {
      setBusyKey(null);
    }
  };

  const toggleTurn = async (drawId) => {
    const key = `turn-${scope}-${drawId}`;
    setBusyKey(key);
    setError('');
    setSuccessMsg('');
    try {
      const turn = turns.find((t) => t.draw_id === drawId);
      if (!turn) return;
      const turnScheduleIds = turn.items.map((i) => Number(i.schedule_id));
      const anyActive = turn.items.some((i) => i.is_active);

      let nextHidden;
      if (anyActive) {
        // Bloquear turno: ocultar todos sus schedules
        nextHidden = Array.from(new Set([...hiddenScheduleIds.map(Number), ...turnScheduleIds]));
      } else {
        // Habilitar turno: mostrar todos sus schedules
        nextHidden = hiddenScheduleIds.map(Number).filter((id) => !turnScheduleIds.includes(id));
      }

      await savePreferences(nextHidden);
    } catch (e) {
      setError(e?.response?.data?.message || 'No se pudo actualizar el turno.');
    } finally {
      setBusyKey(null);
    }
  };

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
      // Filtrar los turnos objetivo en el alcance actual
      const targetTurns = allTurns
        ? turns
        : turns.filter((t) => selectedDrawIds.includes(t.draw_id));

      const targetSchedules = targetTurns.flatMap((t) => t.items);

      let nextHidden = [...hiddenScheduleIds.map(Number)];

      if (batchMode === 'only_selected') {
        // Solo ver elegidas: mostrar elegidas en estos turnos, ocultar las demás en estos turnos
        for (const item of targetSchedules) {
          const sId = Number(item.schedule_id);
          if (selectedLotteryIds.includes(item.lottery_id)) {
            nextHidden = nextHidden.filter((id) => id !== sId);
          } else {
            if (!nextHidden.includes(sId)) {
              nextHidden.push(sId);
            }
          }
        }
      } else if (batchMode === 'hide_selected') {
        // Dejar de ver elegidas: ocultar solo las seleccionadas
        for (const item of targetSchedules) {
          const sId = Number(item.schedule_id);
          if (selectedLotteryIds.includes(item.lottery_id)) {
            if (!nextHidden.includes(sId)) {
              nextHidden.push(sId);
            }
          }
        }
      } else if (batchMode === 'show_selected') {
        // Habilitar elegidas: mostrar las seleccionadas
        for (const item of targetSchedules) {
          const sId = Number(item.schedule_id);
          if (selectedLotteryIds.includes(item.lottery_id)) {
            nextHidden = nextHidden.filter((id) => id !== sId);
          }
        }
      }

      await savePreferences(nextHidden);
      setSuccessMsg('Preferencia guardada: aplicada a tus turnos.');
    } catch (e) {
      setError(e?.response?.data?.message || 'No se pudo aplicar el cambio masivo.');
    } finally {
      setBusyKey(null);
    }
  };

  const resetAllPreferences = async () => {
    setBusyKey('reset');
    setError('');
    setSuccessMsg('');
    try {
      await savePreferences([]);
      setSuccessMsg('Preferencias restablecidas. Ahora ves todas las loterías.');
    } catch (e) {
      setError(e?.response?.data?.message || 'No se pudieron restablecer las preferencias.');
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Aviso informativo de alcance personal */}
      <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl px-4 py-2.5 flex items-center justify-between gap-3 text-xs text-indigo-300">
        <div className="flex items-center gap-2">
          <FiInfo size={16} className="text-indigo-400 shrink-0" />
          <span>
            <strong>Configuración individual ({user?.name}):</strong> solo afecta las loterías y turnos que vos ves y jugás. Ningún otro usuario se ve afectado.
          </span>
        </div>
        {hiddenScheduleIds.length > 0 && (
          <button
            type="button"
            disabled={busyKey === 'reset'}
            onClick={resetAllPreferences}
            className="flex items-center gap-1 text-[11px] bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 px-2.5 py-1 rounded-lg transition shrink-0 cursor-pointer"
          >
            <FiRotateCcw size={12} />
            Ver todas ({hiddenScheduleIds.length} ocultas)
          </button>
        )}
      </div>

      {/* Selector de Esquema para Tucumán (TUC) */}
      <div className="bg-gray-800/80 border border-indigo-500/30 rounded-2xl p-4 sm:p-5 space-y-3 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                TUC
              </span>
              <h3 className="text-sm font-bold text-white">
                Esquema de Turnos: Tucumán
              </h3>
              <span className="text-[11px] text-gray-400">
                (Lunes a Sábados)
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Elegí con qué esquema de turnos jugar Tucumán. Hacé clic en la opción deseada para ver el detalle y confirmar.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-full">
              Activo: {tucScheme === 'original' ? 'Opción A (Original)' : 'Opción B (Alternativo)'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {/* Checkbox Opción A */}
          <div
            onClick={() => handleSelectScheme('original')}
            className={`flex items-start gap-3 p-3.5 rounded-xl border transition cursor-pointer ${
              tucScheme === 'original'
                ? 'bg-indigo-950/70 border-indigo-400 ring-1 ring-indigo-400/40 text-white shadow'
                : 'bg-gray-900/60 border-gray-700/80 hover:border-gray-600 text-gray-300 hover:text-white'
            }`}
          >
            <input
              type="checkbox"
              checked={tucScheme === 'original'}
              onChange={() => handleSelectScheme('original')}
              className="w-4 h-4 mt-0.5 rounded border-gray-600 text-indigo-600 focus:ring-indigo-500 cursor-pointer pointer-events-none"
            />
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">
                  Opción A: Horario Original (CPA)
                </span>
                {tucScheme === 'original' && (
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-1.5 py-0.5 rounded font-semibold">
                    ACTIVO
                  </span>
                )}
              </div>
              <p className="text-[11px] text-gray-400 leading-snug">
                11:30 Matutina · 14:30 Vespertina · 17:30 La Siesta · 19:30 De la Tarde · 22:00 Nocturna
              </p>
            </div>
          </div>

          {/* Checkbox Opción B */}
          <div
            onClick={() => handleSelectScheme('alternativo')}
            className={`flex items-start gap-3 p-3.5 rounded-xl border transition cursor-pointer ${
              tucScheme === 'alternativo'
                ? 'bg-indigo-950/70 border-indigo-400 ring-1 ring-indigo-400/40 text-white shadow'
                : 'bg-gray-900/60 border-gray-700/80 hover:border-gray-600 text-gray-300 hover:text-white'
            }`}
          >
            <input
              type="checkbox"
              checked={tucScheme === 'alternativo'}
              onChange={() => handleSelectScheme('alternativo')}
              className="w-4 h-4 mt-0.5 rounded border-gray-600 text-indigo-600 focus:ring-indigo-500 cursor-pointer pointer-events-none"
            />
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">
                  Opción B: Alternativo (Nacional)
                </span>
                {tucScheme === 'alternativo' && (
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-1.5 py-0.5 rounded font-semibold">
                    ACTIVO
                  </span>
                )}
              </div>
              <p className="text-[11px] text-gray-400 leading-snug">
                11:30 La Previa · 14:30 Primera · 17:30 Matutina · 19:30 Vespertina · 22:00 Nocturna
              </p>
            </div>
          </div>
        </div>
      </div>

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
              {busyKey === 'batch' ? 'Aplicando...' : 'Aplicar cambio a mi vista'}
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
                          Turno bloqueado para vos
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-gray-400">
                      {activeCount} de {totalCount} loterías visibles para vos
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={turnBusy}
                    onClick={() => toggleTurn(turn.draw_id)}
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
                        onClick={() => toggleLotterySchedule(item.schedule_id)}
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

      {/* Modal de confirmación de esquema */}
      {modalOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-gray-900 border border-indigo-500/30 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between border-b border-gray-700/50 pb-3">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  TUC
                </span>
                <h3 className="text-sm font-bold text-white">
                  Confirmar Esquema de Turnos: Tucumán
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-gray-400 hover:text-white transition p-1 cursor-pointer"
              >
                <FiX size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-gray-300">
                Seleccionaste jugar Tucumán con:
              </p>
              <div className="p-3.5 rounded-xl bg-indigo-950/60 border border-indigo-500/40">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-sm text-indigo-200">
                    {pendingScheme === 'original'
                      ? 'Opción A: Horario Original (CPA)'
                      : 'Opción B: Alternativo (Nacional)'}
                  </span>
                  <span className="text-[10px] text-indigo-300 bg-indigo-500/20 px-2 py-0.5 rounded-full font-semibold">
                    Lun a Sáb
                  </span>
                </div>
                
                <div className="divide-y divide-gray-700/40 border-t border-gray-700/40 pt-2 space-y-1.5">
                  {(pendingScheme === 'original' ? [
                    { time: '11:30', name: 'Matutina', close: '11:28' },
                    { time: '14:30', name: 'Vespertina', close: '14:28' },
                    { time: '17:30', name: 'La Siesta', close: '17:28' },
                    { time: '19:30', name: 'De la Tarde', close: '19:28' },
                    { time: '22:00', name: 'Nocturna', close: '21:58' },
                  ] : [
                    { time: '11:30', name: 'La Previa', close: '11:28' },
                    { time: '14:30', name: 'Primera', close: '14:28' },
                    { time: '17:30', name: 'Matutina', close: '17:28' },
                    { time: '19:30', name: 'Vespertina', close: '19:28' },
                    { time: '22:00', name: 'Nocturna', close: '21:58' },
                  ]).map((row) => (
                    <div key={row.name} className="flex items-center justify-between pt-1">
                      <span className="font-semibold text-gray-200">{row.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400">Sorteo <strong className="text-gray-200 font-mono">{row.time}</strong></span>
                        <span className="text-gray-400">·</span>
                        <span className="text-yellow-400/90">Cierre <strong className="text-yellow-300 font-mono">{row.close}</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-gray-800/60 border border-gray-700/60 rounded-xl p-2.5 text-gray-400 text-[11px] leading-relaxed">
                ℹ️ Esta configuración actualiza los turnos de juego para la lotería de <strong>Tucumán (TUC)</strong> de Lunes a Sábados sin duplicar la lotería.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-700/50">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                disabled={schemeLoading}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-medium transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmSchemeChange}
                disabled={schemeLoading}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg transition cursor-pointer disabled:opacity-50"
              >
                {schemeLoading ? (
                  <>
                    <FiRefreshCw className="animate-spin" size={13} />
                    Guardando...
                  </>
                ) : (
                  <>
                    <FiCheck size={14} />
                    Confirmar elección
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
