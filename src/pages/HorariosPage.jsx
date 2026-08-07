import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  FiClock,
  FiChevronDown,
  FiChevronUp,
  FiRefreshCw,
  FiAlertTriangle,
  FiEdit2,
  FiTrash2,
  FiPlus,
  FiCheck,
  FiX,
  FiSliders,
  FiToggleLeft,
  FiToggleRight,
  FiPower,
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

const DRAW_ORDER = ['La Previa', 'Primera', 'Matutina', 'Vespertina', 'Nocturna'];

function computeClosingTime(drawTime) {
  if (!drawTime || !/^\d{2}:\d{2}$/.exec(drawTime)) return '';
  const [h, m] = drawTime.split(':').map(Number);
  let total = h * 60 + m - 2;
  if (total < 0) total += 24 * 60;
  const hh = String(Math.floor(total / 60)).padStart(2, '0');
  const mm = String(total % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

export default function HorariosPage() {
  const { user } = useAuth();
  const userRoles = Array.isArray(user?.roles) ? user.roles : [];
  const isAdmin = userRoles.includes('admin') || userRoles.includes('super_admin');

  const [sections, setSections] = useState([]);
  const [allDraws, setAllDraws] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [filter, setFilter] = useState('all'); // all | daily | saturday | sunday
  const [search, setSearch] = useState('');
  const [showCsvOption, setShowCsvOption] = useState(false);

  // State for inline editing of existing schedule
  const [editingScheduleId, setEditingScheduleId] = useState(null);
  const [editForm, setEditForm] = useState({ draw_time: '', closing_time: '' });

  // State for adding a new turn to a lottery
  // key format: `${sectionScope}-${lotteryId}`
  const [addingTurnKey, setAddingTurnKey] = useState(null);
  const [addForm, setAddForm] = useState({ draw_id: '', draw_time: '', closing_time: '' });

  const flash = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [statusRes, drawsRes] = await Promise.all([
        api.get('/schedules/status'),
        api.get('/draws').catch(() => ({ data: [] })),
      ]);
      setSections(statusRes.data.sections || []);
      setAllDraws(drawsRes.data || []);
    } catch {
      flash('Error al cargar los horarios');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Handle schedule edit start
  const startEditing = (s) => {
    setEditingScheduleId(s.id);
    setEditForm({
      draw_time: s.draw_time || '',
      closing_time: s.closing_time || '',
    });
  };

  const cancelEditing = () => {
    setEditingScheduleId(null);
    setEditForm({ draw_time: '', closing_time: '' });
  };

  const handleEditDrawTimeChange = (val) => {
    setEditForm((prev) => ({
      ...prev,
      draw_time: val,
      closing_time: computeClosingTime(val),
    }));
  };

  const saveEditing = async (scheduleId) => {
    if (!editForm.draw_time || !editForm.closing_time) {
      flash('Los horarios de sorteo y cierre son requeridos');
      return;
    }
    setBusy(true);
    try {
      await api.put(`/schedules/${scheduleId}`, {
        draw_time: editForm.draw_time,
        closing_time: editForm.closing_time,
        defect: false,
      });
      flash('Horario actualizado correctamente');
      setEditingScheduleId(null);
      await load();
    } catch (err) {
      const msg = err?.response?.data?.message;
      flash(msg ? `Error: ${msg}` : 'Error al actualizar el horario');
    } finally {
      setBusy(false);
    }
  };

  const deleteSchedule = async (scheduleId, drawName, initials) => {
    if (!window.confirm(`¿Eliminar el turno "${drawName}" para ${initials}?`)) return;
    setBusy(true);
    try {
      await api.delete(`/schedules/${scheduleId}`);
      flash('Horario eliminado');
      await load();
    } catch (err) {
      const msg = err?.response?.data?.message;
      flash(msg ? `Error: ${msg}` : 'Error al eliminar el horario');
    } finally {
      setBusy(false);
    }
  };

  // Handle adding new turn to lottery
  const startAddingTurn = (sectionScope, lotteryId) => {
    setAddingTurnKey(`${sectionScope}-${lotteryId}`);
    setAddForm({ draw_id: '', draw_time: '', closing_time: '' });
  };

  const cancelAddingTurn = () => {
    setAddingTurnKey(null);
    setAddForm({ draw_id: '', draw_time: '', closing_time: '' });
  };

  const handleAddDrawTimeChange = (val) => {
    setAddForm((prev) => ({
      ...prev,
      draw_time: val,
      closing_time: computeClosingTime(val),
    }));
  };

  const saveAddingTurn = async (sectionScope, lotteryId) => {
    if (!addForm.draw_id || !addForm.draw_time || !addForm.closing_time) {
      flash('Selecciona un turno e ingresa los horarios');
      return;
    }
    setBusy(true);
    try {
      await api.post('/schedules', {
        lottery_id: lotteryId,
        draw_id: Number(addForm.draw_id),
        day_scope: sectionScope,
        draw_time: addForm.draw_time,
        closing_time: addForm.closing_time,
      });
      flash('Turno agregado correctamente');
      setAddingTurnKey(null);
      await load();
    } catch (err) {
      const msg = err?.response?.data?.message;
      flash(msg ? `Error: ${msg}` : 'Error al agregar turno');
    } finally {
      setBusy(false);
    }
  };

  const toggleScheduleActive = async (s) => {
    setBusy(true);
    try {
      await api.put(`/schedules/${s.id}`, {
        draw_time: s.draw_time,
        closing_time: s.closing_time,
        is_active: !s.is_active,
      });
      flash(`Turno ${s.draw} ${!s.is_active ? 'habilitado' : 'deshabilitado'}`);
      await load();
    } catch (err) {
      const msg = err?.response?.data?.message;
      flash(msg ? `Error: ${msg}` : 'Error al cambiar estado del turno');
    } finally {
      setBusy(false);
    }
  };

  const toggleLotteryBulkActive = async (lotteryId, dayScope, currentAllActive) => {
    setBusy(true);
    try {
      await api.post('/schedules/toggle-bulk', {
        lottery_id: lotteryId,
        day_scope: dayScope,
        is_active: !currentAllActive,
      });
      flash(`Lotería ${!currentAllActive ? 'habilitada' : 'deshabilitada'} en todos los turnos`);
      await load();
    } catch (err) {
      const msg = err?.response?.data?.message;
      flash(msg ? `Error: ${msg}` : 'Error al cambiar estado de la lotería');
    } finally {
      setBusy(false);
    }
  };

  // Emergency CSV refresh
  const refreshFromCsv = async () => {
    setBusy(true);
    try {
      let data;
      try {
        const res = await api.post('/schedules/scrape', {}, { timeout: 60000 });
        data = res.data;
      } catch (firstErr) {
        if (firstErr.code === 'ECONNABORTED' || firstErr.response?.status >= 500) {
          const res = await api.post('/schedules/scrape', {}, { timeout: 60000 });
          data = res.data;
        } else {
          throw firstErr;
        }
      }
      flash(data.message + (data.defects?.length ? ` · defectos: ${data.defects.map((d) => d.initials).join(', ')}` : ''));
      await load();
    } catch (err) {
      const msg = err?.response?.data?.message;
      flash(msg ? `Error: ${msg}` : 'Error al importar desde CSV');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center pt-20">
        <FiClock className="animate-spin text-indigo-400" size={28} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {toast && (
        <div className="bg-indigo-500/15 border border-indigo-500/30 text-indigo-200 px-4 py-2 rounded-lg text-sm transition">
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Horarios por lotería</h2>
          <p className="text-sm text-gray-400">
            {isAdmin
              ? 'Pasa el cursor o presiona el lápiz para editar horarios de sorteo y cierre.'
              : 'Horario de sorteo y cierre de cada turno.'}
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { k: 'all', label: 'Todos' },
            { k: 'daily', label: 'Lun–Vie' },
            { k: 'saturday', label: 'Sábado' },
            { k: 'sunday', label: 'Domingo' },
          ].map((f) => (
            <button
              key={f.k}
              onClick={() => setFilter(f.k)}
              className={
                'text-xs px-3 py-1.5 rounded-full border transition ' +
                (filter === f.k
                  ? 'bg-indigo-600/40 border-indigo-400 text-indigo-100 font-semibold'
                  : 'bg-gray-800/40 border-gray-700/40 text-gray-400 hover:text-white')
              }
            >
              {f.label}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="🔍 Buscar lotería, turno, horario..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 w-full sm:w-64"
        />
      </div>

      <div className="space-y-6">
        {sections
          .filter((s) => filter === 'all' || s.scope === filter)
          .map((section) => {
            const searchLower = search.toLowerCase();
            const filtered = [...section.lotteries]
              .filter((lot) => {
                if (!searchLower) return true;
                const nameMatch = lot.initials?.toLowerCase().includes(searchLower)
                  || lot.name?.toLowerCase().includes(searchLower);
                const scheduleMatch = lot.schedules?.some((s) =>
                  s.draw?.toLowerCase().includes(searchLower)
                  || s.draw_time?.toLowerCase().includes(searchLower)
                  || s.closing_time?.toLowerCase().includes(searchLower)
                );
                return nameMatch || scheduleMatch;
              })
              .sort((a, b) => lotteryRank(a.initials) - lotteryRank(b.initials));
            if (filtered.length === 0 && search) return null;
            return (
              <div
                key={section.scope}
                className="bg-gray-800/40 backdrop-blur-sm border border-indigo-500/10 rounded-2xl overflow-hidden"
              >
                <div className="px-5 py-3 border-b border-indigo-500/20 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white uppercase tracking-wide">
                      {section.label}
                    </span>
                    <span className="text-[10px] text-indigo-300 bg-indigo-500/15 px-1.5 py-0.5 rounded-full">
                      {section.scope === 'sunday'
                        ? 'Solo domingo'
                        : section.scope === 'saturday'
                        ? 'Solo sábado'
                        : 'Lun–Vie'}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-[80px_1fr] gap-2 px-5 py-3 border-b border-gray-700/30 text-xs text-gray-400 uppercase">
                  <span>Lotería</span>
                  <span>Turnos</span>
                </div>
                <div className="divide-y divide-gray-700/20">
                  {filtered.map((lot) => {
                    const isAddingTurn = addingTurnKey === `${section.scope}-${lot.lottery_id}`;
                    // Find draws not assigned to this lottery in this section
                    const assignedDrawIds = lot.schedules.map((s) => s.draw_id).filter(Boolean);
                    const unassignedDraws = (allDraws.length > 0
                      ? allDraws
                      : DRAW_ORDER.map((name, idx) => ({ id: idx + 1, name }))
                    ).filter((d) => !assignedDrawIds.includes(d.id));

                    return (
                      <div key={lot.lottery_id} className="px-5 py-3">
                        <div className="flex items-start gap-3">
                          <div className="flex flex-col gap-1 w-[80px] shrink-0 pt-1">
                            <div className="flex items-center gap-1.5">
                              <span className={`font-mono font-bold text-base ${lot.is_active ? 'text-indigo-300' : 'text-gray-500 line-through'}`}>
                                {lot.initials}
                              </span>
                              {lot.defect && (
                                <span
                                  className="flex items-center gap-1 text-[10px] text-red-300 bg-red-500/15 px-1 rounded"
                                  title="Hay turnos con defect"
                                >
                                  <FiAlertTriangle size={10} />
                                </span>
                              )}
                            </div>
                            {isAdmin && (
                              <div className="flex flex-col gap-1">
                                <button
                                  onClick={() => toggleLotteryBulkActive(lot.lottery_id, section.scope, lot.all_active)}
                                  disabled={busy}
                                  title={lot.all_active ? "Deshabilitar en todos los turnos" : "Habilitar en todos los turnos"}
                                  className={`inline-flex items-center justify-center gap-1 text-[10px] px-1 py-0.5 rounded transition font-medium border ${
                                    lot.all_active
                                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20'
                                      : lot.is_active
                                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20'
                                      : 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20'
                                  }`}
                                >
                                  {lot.all_active ? 'Activa' : lot.is_active ? 'Parcial' : 'Off'}
                                </button>
                                <button
                                  onClick={() =>
                                    isAddingTurn
                                      ? cancelAddingTurn()
                                      : startAddingTurn(section.scope, lot.lottery_id)
                                  }
                                  title="Agregar turno a esta lotería"
                                  className="inline-flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-200 transition font-medium"
                                >
                                  <FiPlus size={12} /> Turno
                                </button>
                              </div>
                            )}
                          </div>

                          <div className="flex-1 space-y-2">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                              {lot.schedules
                                .slice()
                                .sort(
                                  (a, b) =>
                                    DRAW_ORDER.indexOf(a.draw) - DRAW_ORDER.indexOf(b.draw)
                                )
                                .map((s) => {
                                  const isEditing = editingScheduleId === s.id;
                                  const isDefect = !!s.defect || !s.draw_time;
                                  const isInactive = s.is_active === false;

                                  if (isEditing) {
                                    return (
                                      <div
                                        key={s.id || s.draw}
                                        className="rounded-lg p-2.5 border border-indigo-400/50 bg-indigo-950/60 text-sm space-y-2 shadow-lg"
                                      >
                                        <div className="flex items-center justify-between font-semibold text-indigo-200">
                                          <span>{s.draw}</span>
                                          <div className="flex items-center gap-1">
                                            <button
                                              onClick={() => saveEditing(s.id)}
                                              disabled={busy}
                                              className="p-1 bg-emerald-600/60 hover:bg-emerald-600 text-white rounded transition"
                                              title="Guardar"
                                            >
                                              <FiCheck size={14} />
                                            </button>
                                            <button
                                              onClick={cancelEditing}
                                              disabled={busy}
                                              className="p-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition"
                                              title="Cancelar"
                                            >
                                              <FiX size={14} />
                                            </button>
                                          </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                          <div>
                                            <label className="block text-gray-400 mb-0.5">Sorteo</label>
                                            <input
                                              type="time"
                                              value={editForm.draw_time}
                                              onChange={(e) =>
                                                handleEditDrawTimeChange(e.target.value)
                                              }
                                              className="w-full bg-gray-900 border border-indigo-500/30 rounded px-2 py-1 text-gray-100 focus:outline-none focus:border-indigo-400"
                                            />
                                          </div>
                                          <div>
                                            <label className="block text-gray-400 mb-0.5">Cierre</label>
                                            <input
                                              type="time"
                                              value={editForm.closing_time}
                                              onChange={(e) =>
                                                setEditForm((prev) => ({
                                                  ...prev,
                                                  closing_time: e.target.value,
                                                }))
                                              }
                                              className="w-full bg-gray-900 border border-indigo-500/30 rounded px-2 py-1 text-yellow-300 focus:outline-none focus:border-indigo-400"
                                            />
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  }

                                  return (
                                    <div
                                      key={s.id || s.draw}
                                      className={
                                        'group relative rounded-lg px-3 py-2 border text-sm transition ' +
                                        (isInactive
                                          ? 'border-gray-800 bg-gray-900/20 text-gray-500'
                                          : isDefect
                                          ? 'border-red-500/40 bg-red-500/10'
                                          : 'border-gray-700/30 bg-gray-900/30 hover:border-indigo-500/30')
                                      }
                                    >
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5">
                                          <span
                                            className={
                                              isInactive
                                                ? 'text-gray-500 line-through'
                                                : isDefect
                                                ? 'text-red-300 font-semibold'
                                                : 'text-gray-200 font-medium'
                                            }
                                          >
                                            {s.draw}
                                          </span>
                                          {isInactive && (
                                            <span className="text-[10px] px-1 py-0.2 rounded bg-gray-800 text-gray-400">
                                              Off
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-1">
                                          {isDefect && !isInactive && (
                                            <FiAlertTriangle size={13} className="text-red-400" />
                                          )}
                                          {isAdmin && s.id && (
                                            <div className="flex items-center gap-1">
                                              <button
                                                onClick={() => toggleScheduleActive(s)}
                                                disabled={busy}
                                                className={`p-1 rounded transition ${
                                                  s.is_active
                                                    ? 'text-emerald-400 hover:bg-emerald-500/20'
                                                    : 'text-red-400 hover:bg-red-500/20'
                                                }`}
                                                title={s.is_active ? 'Deshabilitar turno' : 'Habilitar turno'}
                                              >
                                                {s.is_active ? <FiToggleRight size={16} /> : <FiToggleLeft size={16} />}
                                              </button>
                                              <div className="flex items-center gap-1">
                                                <button
                                                  onClick={() => startEditing(s)}
                                                  className="p-1 text-indigo-300 hover:text-white hover:bg-indigo-600/40 rounded transition"
                                                  title="Editar horario"
                                                >
                                                  <FiEdit2 size={12} />
                                                </button>
                                                <button
                                                  onClick={() =>
                                                    deleteSchedule(s.id, s.draw, lot.initials)
                                                  }
                                                  className="p-1 text-red-400 hover:text-red-200 hover:bg-red-500/20 rounded transition"
                                                  title="Eliminar turno"
                                                >
                                                  <FiTrash2 size={12} />
                                                </button>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      </div>

                                      <div className="text-xs mt-1">
                                        {isInactive ? (
                                          <span className="text-gray-500 italic">Deshabilitado</span>
                                        ) : isDefect ? (
                                          <span className="text-red-300">
                                            {s.defect_note || 'Sin horario'}
                                          </span>
                                        ) : (
                                          <span className="text-gray-400">
                                            Sorteo{' '}
                                            <span className="text-gray-200 font-medium">
                                              {s.draw_time}
                                            </span>{' '}
                                            · Cierre{' '}
                                            <span className="text-yellow-300 font-medium">
                                              {s.closing_time}
                                            </span>
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}

                              {lot.schedules.length === 0 && !isAddingTurn && (
                                <span className="text-xs text-red-300 bg-red-500/10 border border-red-500/40 rounded-lg px-3 py-2">
                                  <FiAlertTriangle size={12} className="inline mr-1" /> Sin horarios cargados
                                </span>
                              )}
                            </div>

                            {/* Add Turn Inline Form */}
                            {isAddingTurn && (
                              <div className="mt-2 p-3 bg-indigo-950/40 border border-indigo-500/30 rounded-xl space-y-3">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-semibold text-indigo-200">
                                    Agregar turno a {lot.initials} ({section.label})
                                  </span>
                                  <button
                                    onClick={cancelAddingTurn}
                                    className="text-gray-400 hover:text-white"
                                  >
                                    <FiX size={14} />
                                  </button>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                                  <div>
                                    <label className="block text-gray-400 mb-1">Turno</label>
                                    <select
                                      value={addForm.draw_id}
                                      onChange={(e) =>
                                        setAddForm((prev) => ({ ...prev, draw_id: e.target.value }))
                                      }
                                      className="w-full bg-gray-900 border border-indigo-500/30 rounded px-2 py-1.5 text-gray-100 focus:outline-none focus:border-indigo-400"
                                    >
                                      <option value="">Seleccionar...</option>
                                      {unassignedDraws.map((d) => (
                                        <option key={d.id} value={d.id}>
                                          {d.name}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-gray-400 mb-1">Hora Sorteo</label>
                                    <input
                                      type="time"
                                      value={addForm.draw_time}
                                      onChange={(e) => handleAddDrawTimeChange(e.target.value)}
                                      className="w-full bg-gray-900 border border-indigo-500/30 rounded px-2 py-1.5 text-gray-100 focus:outline-none focus:border-indigo-400"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-gray-400 mb-1">Hora Cierre</label>
                                    <input
                                      type="time"
                                      value={addForm.closing_time}
                                      onChange={(e) =>
                                        setAddForm((prev) => ({ ...prev, closing_time: e.target.value }))
                                      }
                                      className="w-full bg-gray-900 border border-indigo-500/30 rounded px-2 py-1.5 text-yellow-300 focus:outline-none focus:border-indigo-400"
                                    />
                                  </div>
                                </div>
                                <div className="flex justify-end gap-2 text-xs">
                                  <button
                                    onClick={cancelAddingTurn}
                                    className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition"
                                  >
                                    Cancelar
                                  </button>
                                  <button
                                    onClick={() => saveAddingTurn(section.scope, lot.lottery_id)}
                                    disabled={busy}
                                    className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition disabled:opacity-50"
                                  >
                                    Guardar Turno
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
      </div>

      {/* Emergency CSV Import Section */}
      {isAdmin && (
        <div className="pt-4 border-t border-gray-800">
          <button
            onClick={() => setShowCsvOption((prev) => !prev)}
            className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-300 transition"
          >
            <FiSliders size={13} />
            <span>Opciones de respaldo y emergencia</span>
            {showCsvOption ? <FiChevronUp size={13} /> : <FiChevronDown size={13} />}
          </button>

          {showCsvOption && (
            <div className="mt-3 p-4 bg-gray-900/60 border border-gray-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h4 className="text-xs font-semibold text-gray-300">Importar desde CSV</h4>
                  <p className="text-[11px] text-gray-500">
                    Sobreescribe los horarios de la base de datos utilizando los archivos CSV por defecto del sistema.
                  </p>
                </div>
                <button
                  onClick={refreshFromCsv}
                  disabled={busy}
                  className="flex items-center gap-1.5 text-xs bg-indigo-900/40 hover:bg-indigo-800/60 text-indigo-300 px-3 py-1.5 rounded-lg border border-indigo-700/40 transition disabled:opacity-50"
                >
                  {busy ? <FiRefreshCw size={12} className="animate-spin" /> : <FiRefreshCw size={12} />}
                  Re-importar CSV
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
