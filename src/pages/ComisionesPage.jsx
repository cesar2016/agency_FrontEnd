import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import api from '../services/api';
import { FiRefreshCw, FiPlus, FiX, FiEdit, FiTrash2, FiPercent, FiChevronDown } from 'react-icons/fi';

const todayAR = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });

const money = (n) =>
  Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatFecha = (iso) => {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

export default function ComisionesPage() {
  const [comisiones, setComisiones] = useState([]);
  const [pasadores, setPasadores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [deleteModal, setDeleteModal] = useState(null);

  // Filtro por pasador (dropdown buscable)
  const [filterUserId, setFilterUserId] = useState('');
  const [filterQuery, setFilterQuery] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef(null);

  // Modal pago
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [calcLoading, setCalcLoading] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [calc, setCalc] = useState(null);
  const [form, setForm] = useState({ user_id: '', fecha: todayAR(), entrega: '' });

  // Dropdown pasador en modal
  const [modalQuery, setModalQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const modalDropRef = useRef(null);
  const entregaRef = useRef(null);

  const flash = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const loadPasadores = useCallback(async () => {
    try {
      const { data } = await api.get('/users');
      const list = Array.isArray(data?.data) ? data.data : [];
      setPasadores(list.filter((u) => u.is_active !== false));
    } catch (e) {
      flash(e?.response?.data?.message || 'Error al cargar pasadores');
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterUserId) params.user_id = filterUserId;
      const { data } = await api.get('/comisiones', { params });
      setComisiones(Array.isArray(data?.data) ? data.data : []);
    } catch (e) {
      flash(e?.response?.data?.message || 'Error al cargar comisiones');
    } finally {
      setLoading(false);
    }
  }, [filterUserId]);

  useEffect(() => {
    loadPasadores();
  }, [loadPasadores]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onClick = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) setFilterOpen(false);
      if (modalDropRef.current && !modalDropRef.current.contains(e.target)) setModalOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const filteredPasadores = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    if (!q) return pasadores;
    return pasadores.filter(
      (u) =>
        u.name?.toLowerCase().includes(q) ||
        u.username?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q)
    );
  }, [pasadores, filterQuery]);

  const modalPasadores = useMemo(() => {
    const q = modalQuery.trim().toLowerCase();
    if (!q) return pasadores;
    return pasadores.filter(
      (u) =>
        u.name?.toLowerCase().includes(q) ||
        u.username?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q)
    );
  }, [pasadores, modalQuery]);

  const selectedFilterPasador = pasadores.find((u) => String(u.id) === String(filterUserId));
  const selectedModalPasador = pasadores.find((u) => String(u.id) === String(form.user_id));

  const fetchCalculo = async (userId, fecha) => {
    if (!userId || !fecha) {
      setCalc(null);
      return;
    }
    setCalcLoading(true);
    try {
      const { data } = await api.get('/comisiones/calcular', {
        params: { user_id: userId, fecha },
      });
      setCalc(data?.data || null);
      if (data?.data && !editing) {
        setForm((p) => ({
          ...p,
          entrega: data.data.comision_existente
            ? String(data.data.entrega)
            : p.entrega === '' ? '' : p.entrega,
        }));
      }
    } catch (e) {
      setCalc(null);
      flash(e?.response?.data?.message || 'Error al calcular comisión');
    } finally {
      setCalcLoading(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setFormErrors({});
    setCalc(null);
    const uid = filterUserId || '';
    const pasador = pasadores.find((u) => String(u.id) === String(uid));
    setForm({ user_id: uid, fecha: todayAR(), entrega: '' });
    setModalQuery(pasador ? pasador.name : '');
    setShowModal(true);
    if (uid) fetchCalculo(uid, todayAR());
  };

  const openEdit = (row) => {
    setEditing(row);
    setFormErrors({});
    setForm({
      user_id: String(row.user_id),
      fecha: row.fecha,
      entrega: String(row.entrega ?? 0),
    });
    setModalQuery(row.pasador?.name || '');
    setCalc({
      total_ventas: row.total_ventas,
      comision: row.comision,
      entrega: row.entrega,
      saldo: row.saldo,
      comision_existente: row,
    });
    setShowModal(true);
    fetchCalculo(row.user_id, row.fecha);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setCalc(null);
    setFormErrors({});
    setModalOpen(false);
    setModalQuery('');
  };

  useEffect(() => {
    if (showModal && entregaRef.current) {
      const t = setTimeout(() => entregaRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [showModal, calcLoading]);

  const saldoPreview = useMemo(() => {
    if (!calc) return null;
    const entrega = Number(form.entrega || 0);
    return Math.round((Number(calc.comision) - entrega) * 100) / 100;
  }, [calc, form.entrega]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setFormErrors({});
    try {
      if (editing) {
        await api.put(`/comisiones/${editing.id}`, {
          entrega: Number(form.entrega || 0),
          refrescar_ventas: true,
        });
        flash('Pago actualizado correctamente');
      } else {
        if (calc?.comision_existente?.id) {
          await api.put(`/comisiones/${calc.comision_existente.id}`, {
            entrega: Number(form.entrega || 0),
            refrescar_ventas: true,
          });
          flash('Pago registrado correctamente');
        } else {
          await api.post('/comisiones', {
            user_id: Number(form.user_id),
            fecha: form.fecha,
            entrega: Number(form.entrega || 0),
          });
          flash('Comisión registrada correctamente');
        }
      }
      closeModal();
      load();
    } catch (err) {
      const data = err?.response?.data;
      if (data?.errors) {
        const parsed = {};
        Object.entries(data.errors).forEach(([field, rules]) => {
          parsed[field] = Array.isArray(rules) ? rules : [String(rules)];
        });
        setFormErrors(parsed);
      } else {
        flash(data?.message || 'Error al guardar');
      }
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteModal) return;
    const id = deleteModal;
    setComisiones((prev) => prev.filter((c) => c.id !== id));
    try {
      await api.delete(`/comisiones/${id}`);
      flash('Comisión eliminada');
    } catch (e) {
      load();
      flash(e?.response?.data?.message || 'Error al eliminar');
    }
    setDeleteModal(null);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-white text-xl font-bold flex items-center gap-2">
          <FiPercent className="text-indigo-400" /> Comisiones
        </h2>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2 px-4 rounded-lg transition text-sm self-start"
        >
          <FiPlus size={16} /> Registrar pago
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
        <div className="flex-1 relative" ref={filterRef}>
          <label className="block text-xs text-gray-400 mb-1">Pasador</label>
          <div className="relative">
            <input
              type="text"
              value={filterOpen ? filterQuery : (selectedFilterPasador?.name || filterQuery)}
              onChange={(e) => {
                setFilterQuery(e.target.value);
                setFilterOpen(true);
                if (filterUserId) setFilterUserId('');
              }}
              onFocus={() => {
                setFilterOpen(true);
                setFilterQuery(selectedFilterPasador?.name || '');
              }}
              placeholder="Buscar pasador…"
              className={`w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 ${
                (filterUserId || filterQuery) ? 'pr-14' : 'pr-8'
              }`}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
              {(filterUserId || filterQuery) && (
                <button
                  type="button"
                  title="Limpiar"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFilterUserId('');
                    setFilterQuery('');
                    setFilterOpen(false);
                  }}
                  className="p-1 text-gray-400 hover:text-white transition rounded"
                >
                  <FiX size={14} />
                </button>
              )}
              <FiChevronDown className="text-gray-400 pointer-events-none" size={14} />
            </div>
          </div>
          {filterOpen && (
            <div className="absolute z-40 mt-1 w-full max-h-56 overflow-y-auto bg-gray-900 border border-indigo-500/20 rounded-xl shadow-2xl">
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-sm text-gray-400 hover:bg-indigo-600/20 hover:text-white transition"
                onClick={() => {
                  setFilterUserId('');
                  setFilterQuery('');
                  setFilterOpen(false);
                }}
              >
                Todos los pasadores
              </button>
              {filteredPasadores.length === 0 ? (
                <div className="px-3 py-2 text-sm text-gray-500">Sin resultados</div>
              ) : (
                filteredPasadores.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    className={`w-full text-left px-3 py-2 text-sm transition hover:bg-indigo-600/20 ${
                      String(u.id) === String(filterUserId) ? 'text-indigo-300 bg-indigo-600/10' : 'text-gray-300 hover:text-white'
                    }`}
                    onClick={() => {
                      setFilterUserId(String(u.id));
                      setFilterQuery(u.name);
                      setFilterOpen(false);
                    }}
                  >
                    <span className="font-medium">{u.name}</span>
                    {u.username && <span className="text-gray-500 ml-2 font-mono text-xs">@{u.username}</span>}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
        <button
          onClick={load}
          className="flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-gray-200 font-medium py-2 px-4 rounded-lg text-sm transition"
        >
          <FiRefreshCw size={14} /> Actualizar
        </button>
      </div>

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={closeModal}
        >
          <div
            className="bg-gray-800 border border-indigo-500/20 rounded-2xl w-full max-w-md shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold">
                {editing ? 'Editar pago' : 'Registrar pago de comisión'}
              </h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-white transition">
                <FiX size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="relative" ref={modalDropRef}>
                <label className="block text-xs text-gray-400 mb-1">
                  Pasador <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    disabled={!!editing}
                    value={modalOpen ? modalQuery : (selectedModalPasador?.name || modalQuery)}
                    onChange={(e) => {
                      setModalQuery(e.target.value);
                      setModalOpen(true);
                      setForm((p) => ({ ...p, user_id: '' }));
                      setCalc(null);
                      setFormErrors((prev) => {
                        const next = { ...prev };
                        delete next.user_id;
                        return next;
                      });
                    }}
                    onFocus={() => {
                      if (!editing) {
                        setModalOpen(true);
                        setModalQuery(selectedModalPasador?.name || '');
                      }
                    }}
                    placeholder="Buscar pasador…"
                    className={`w-full bg-gray-700/50 border rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-indigo-500 disabled:opacity-60 ${
                      formErrors.user_id ? 'border-red-500' : 'border-gray-600'
                    } ${(!editing && (form.user_id || modalQuery)) ? 'pr-14' : 'pr-8'}`}
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                    {!editing && (form.user_id || modalQuery) && (
                      <button
                        type="button"
                        title="Limpiar"
                        onClick={(e) => {
                          e.stopPropagation();
                          setForm((p) => ({ ...p, user_id: '' }));
                          setModalQuery('');
                          setCalc(null);
                          setModalOpen(true);
                        }}
                        className="p-1 text-gray-400 hover:text-white transition rounded"
                      >
                        <FiX size={14} />
                      </button>
                    )}
                    <FiChevronDown className="text-gray-400 pointer-events-none" size={14} />
                  </div>
                </div>
                {modalOpen && !editing && (
                  <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto bg-gray-900 border border-indigo-500/20 rounded-xl shadow-2xl">
                    {modalPasadores.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-gray-500">Sin resultados</div>
                    ) : (
                      modalPasadores.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-indigo-600/20 transition"
                          onClick={() => {
                            setForm((p) => ({ ...p, user_id: String(u.id) }));
                            setModalQuery(u.name);
                            setModalOpen(false);
                            fetchCalculo(u.id, form.fecha);
                          }}
                        >
                          <span className="font-medium">{u.name}</span>
                          {u.username && <span className="text-gray-500 ml-2 font-mono text-xs">@{u.username}</span>}
                        </button>
                      ))
                    )}
                  </div>
                )}
                {formErrors.user_id && <p className="text-red-400 text-xs mt-1">{formErrors.user_id.join('. ')}</p>}
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  Fecha <span className="text-red-400">*</span>
                </label>
                <input
                  type="date"
                  required
                  disabled={!!editing}
                  value={form.fecha}
                  onChange={(e) => {
                    const fecha = e.target.value;
                    setForm((p) => ({ ...p, fecha }));
                    if (form.user_id) fetchCalculo(form.user_id, fecha);
                  }}
                  className={`w-full bg-gray-700/50 border rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-indigo-500 disabled:opacity-60 ${
                    formErrors.fecha ? 'border-red-500' : 'border-gray-600'
                  }`}
                />
                {formErrors.fecha && <p className="text-red-400 text-xs mt-1">{formErrors.fecha.join('. ')}</p>}
              </div>

              <div className="bg-gray-900/50 border border-gray-700/50 rounded-xl p-3 space-y-2">
                {calcLoading ? (
                  <div className="flex justify-center py-2">
                    <FiRefreshCw className="animate-spin text-indigo-400" size={18} />
                  </div>
                ) : calc ? (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Total ventas</span>
                      <span className="text-white font-medium">${money(calc.total_ventas)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Comisión (30%)</span>
                      <span className="text-indigo-300 font-medium">${money(calc.comision)}</span>
                    </div>
                    {calc.comision_existente && !editing && (
                      <p className="text-[11px] text-amber-400/90 pt-1">
                        Ya existe un registro para este día. Se actualizará el pago.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-gray-500 text-center py-1">
                    Seleccioná pasador y fecha para calcular
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  Entrega (pago) <span className="text-red-400">*</span>
                </label>
                <input
                  ref={entregaRef}
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={form.entrega}
                  onChange={(e) => {
                    setForm((p) => ({ ...p, entrega: e.target.value }));
                    if (formErrors.entrega) {
                      setFormErrors((prev) => {
                        const next = { ...prev };
                        delete next.entrega;
                        return next;
                      });
                    }
                  }}
                  className={`w-full bg-gray-700/50 border rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-indigo-500 ${
                    formErrors.entrega ? 'border-red-500' : 'border-gray-600'
                  }`}
                  placeholder="0.00"
                />
                {formErrors.entrega && <p className="text-red-400 text-xs mt-1">{formErrors.entrega.join('. ')}</p>}
                <p className="text-[10px] text-gray-500 mt-1">Pago total o parcial de la comisión del día</p>
              </div>

              {calc && saldoPreview !== null && (
                <div className="flex justify-between items-center text-sm border-t border-gray-700/50 pt-3">
                  <span className="text-gray-300 font-medium">Saldo</span>
                  <span className={`font-bold text-lg ${saldoPreview > 0 ? 'text-amber-400' : saldoPreview < 0 ? 'text-red-400' : 'text-green-400'}`}>
                    ${money(saldoPreview)}
                  </span>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={formLoading || !form.user_id || calcLoading}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2 px-4 rounded-lg text-sm transition disabled:opacity-50"
                >
                  {formLoading ? 'Guardando...' : editing ? 'Actualizar pago' : 'Guardar pago'}
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  className="bg-gray-700 hover:bg-gray-600 text-gray-200 font-medium py-2 px-4 rounded-lg text-sm transition"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setDeleteModal(null)}>
          <div className="bg-gray-800 border border-red-500/30 rounded-2xl w-full max-w-sm shadow-2xl p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="w-14 h-14 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <FiTrash2 className="text-red-400" size={24} />
            </div>
            <h3 className="text-white font-bold text-lg mb-2">Eliminar comisión</h3>
            <p className="text-gray-400 text-sm mb-6">¿Estás seguro de eliminar este registro? Esta acción no se puede deshacer.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteModal(null)} className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-200 font-medium py-2.5 rounded-lg text-sm transition">
                Cancelar
              </button>
              <button onClick={handleDelete} className="flex-1 bg-red-600 hover:bg-red-500 text-white font-medium py-2.5 rounded-lg text-sm transition shadow-lg shadow-red-500/20">
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center pt-20">
          <FiRefreshCw className="animate-spin text-indigo-400" size={28} />
        </div>
      ) : (
        <div className="bg-gray-800/40 backdrop-blur-sm border border-indigo-500/10 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-gray-700/50">
                  {!filterUserId && <th className="text-left p-3">Pasador</th>}
                  <th className="text-left p-3">Fecha</th>
                  <th className="text-right p-3">Total ventas</th>
                  <th className="text-right p-3">Comisión</th>
                  <th className="text-right p-3">Entrega</th>
                  <th className="text-right p-3">Saldo</th>
                  <th className="text-center p-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {comisiones.length === 0 ? (
                  <tr>
                    <td colSpan={filterUserId ? 6 : 7} className="text-center py-8 text-gray-400">
                      No hay comisiones registradas
                    </td>
                  </tr>
                ) : (
                  comisiones.map((c) => (
                    <tr key={c.id} className="border-b border-gray-700/30 hover:bg-gray-700/20">
                      {!filterUserId && (
                        <td className="p-3 text-white">
                          {c.pasador?.name || '—'}
                          {c.pasador?.username && (
                            <span className="block text-xs text-gray-500 font-mono">@{c.pasador.username}</span>
                          )}
                        </td>
                      )}
                      <td className="p-3 text-gray-300 whitespace-nowrap">{formatFecha(c.fecha)}</td>
                      <td className="p-3 text-right text-white">${money(c.total_ventas)}</td>
                      <td className="p-3 text-right text-indigo-300">${money(c.comision)}</td>
                      <td className="p-3 text-right text-gray-200">${money(c.entrega)}</td>
                      <td className={`p-3 text-right font-medium ${
                        Number(c.saldo) > 0 ? 'text-amber-400' : Number(c.saldo) < 0 ? 'text-red-400' : 'text-green-400'
                      }`}>
                        ${money(c.saldo)}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-3">
                          <button onClick={() => openEdit(c)} className="text-indigo-400 hover:text-indigo-300 transition p-1" title="Editar pago">
                            <FiEdit size={14} />
                          </button>
                          <button onClick={() => setDeleteModal(c.id)} className="text-red-400 hover:text-red-300 transition p-1" title="Eliminar">
                            <FiTrash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-4 right-4 bg-gray-800 border border-indigo-500/30 rounded-xl px-4 py-3 text-sm text-white shadow-2xl z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
