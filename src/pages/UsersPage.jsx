import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import CajaModal from '../components/CajaModal';
import RentalModal from '../components/RentalModal';
import { FiRefreshCw, FiUserPlus, FiX, FiShare2, FiEdit, FiTrash2, FiToggleRight, FiToggleLeft, FiDollarSign, FiEye, FiEyeOff, FiSearch, FiChevronLeft, FiChevronRight, FiClock, FiList, FiPercent } from 'react-icons/fi';

function generateFakeData(name) {
  const firstWord = name.trim().split(/\s+/)[0] || '';
  const datePart = new Date().toLocaleDateString('es-AR').replace(/\//g, '');
  const timePart = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).replace(/:/g, '');
  const username = (firstWord + timePart).toLowerCase();
  const whatsapp = String(Math.floor(1000 + Math.random() * 9000));
  const email = firstWord.toLowerCase().replace(/\s/g, '') + datePart + '@agencia.com';
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  const word = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  const digits = String(Math.floor(10 + Math.random() * 90));
  const password = word + digits;
  return { name, whatsapp, email, username, role: 'usuario', password, password_confirmation: password };
}

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const currentRoles = Array.isArray(currentUser?.roles) ? currentUser.roles : [];
  const isAdmin = currentRoles.includes('admin') || currentRoles.includes('super_admin');
  const isSuperAdmin = currentRoles.includes('super_admin');
  // Regla: super_admin asigna admin/usuario; admin solo puede asignar usuario.
  const assignableRoles = isSuperAdmin ? ['usuario', 'admin'] : ['usuario'];

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState({ name: '', whatsapp: '', email: '', username: '', role: 'usuario', password: '', password_confirmation: '' });
  // Si el usuario editado tiene un rol que no puedo asignar, se muestra tal cual (sin cambiarlo).
  const shownRoles = assignableRoles.includes(form.role) ? assignableRoles : [form.role];
  const [formLoading, setFormLoading] = useState(false);
  const [generatedUsername, setGeneratedUsername] = useState('');
  const [lastCreatedUser, setLastCreatedUser] = useState(null);
  const [lastPassword, setLastPassword] = useState('');
  const [toast, setToast] = useState(null);
  const [deleteModal, setDeleteModal] = useState(null);
  const [editingPasswordField, setEditingPasswordField] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const nameInputRef = useRef(null);

  const [cajaUser, setCajaUser] = useState(null);
  const [rentalUser, setRentalUser] = useState(null);
  const [rentalMode, setRentalMode] = useState('config');

  // Edición inline de porcentaje por fila: { userId: valorString }
  const [rateEdits, setRateEdits] = useState({});
  const [rateSaving, setRateSaving] = useState({});

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const filteredUsers = useMemo(() => {
    let list = users;
    if (searchTerm) {
      const qs = searchTerm.toLowerCase();
      list = list.filter(u => 
        (u.name || '').toLowerCase().includes(qs) ||
        (u.username || '').toLowerCase().includes(qs) ||
        (u.email || '').toLowerCase().includes(qs) ||
        (u.whatsapp || '').includes(qs) ||
        (u.parent_name || '').toLowerCase().includes(qs)
      );
    }
    return list;
  }, [users, searchTerm]);

  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredUsers.slice(start, start + itemsPerPage);
  }, [filteredUsers, currentPage]);

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage) || 1;

  const flash = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const openCaja = (user) => setCajaUser(user);
  const closeCaja = () => setCajaUser(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/users');
      setUsers(Array.isArray(data?.data) ? data.data : []);
    } catch (e) {
      flash(e?.response?.data?.message || 'Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (showModal && nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, [showModal]);

  const openCreate = () => {
    setEditingUser(null);
    setForm({ name: '', whatsapp: '', email: '', username: '', role: 'usuario', password: '', password_confirmation: '', comision_rate: '30' });
    setGeneratedUsername('');
    setLastPassword('');
    setFormErrors({});
    setShowPassword(false);
    setShowModal(true);
  };

  const openEdit = (user) => {
    const role = user.roles?.[0] || 'usuario';
    const clave = user.password || '••••••';
    setEditingUser(user);
    setForm({ name: user.name, whatsapp: user.whatsapp || '', email: user.email, username: user.username || '', role, password: clave, password_confirmation: clave, comision_rate: String(user.comision_rate ?? 30) });
    setEditingPasswordField(false);
    setGeneratedUsername('');
    setLastPassword('');
    setFormErrors({});
    setShowPassword(false);
    setShowModal(true);
  };

  const handleNameChange = (e) => {
    const name = e.target.value;
    setForm((prev) => ({ ...prev, name }));
    if (name.trim()) {
      const fake = generateFakeData(name);
      setForm((prev) => ({
        ...prev,
        whatsapp: fake.whatsapp,
        email: fake.email,
        username: fake.username,
        password: fake.password,
        password_confirmation: fake.password_confirmation,
        is_recycled: !!editingUser
      }));
      setGeneratedUsername(fake.username);
      if (editingUser) setEditingPasswordField(true);
    } else {
      setForm((prev) => ({
        ...prev,
        whatsapp: '',
        email: '',
        username: '',
        password: '',
        password_confirmation: '',
        is_recycled: false
      }));
      setGeneratedUsername('');
      if (editingUser) setEditingPasswordField(false);
    }
  };

  const errorMessages = {
    'required': () => `Es obligatorio.`,
    'email': () => `Debe ser un email válido.`,
    'string': () => `Debe ser texto.`,
    'min': () => `Debe tener al menos 6 caracteres.`,
    'confirmed': () => `Las contraseñas no coinciden.`,
    'unique': () => `Ya está en uso.`,
    'max': () => `Excede la longitud máxima.`,
    'regex': () => `Debe tener 6 caracteres: 4 letras y 2 dígitos (ej: loxo12).`,
    'in': () => `Tiene un valor no válido.`,
    'digits': () => `Debe contener solo números.`,
  };

  const clearFieldError = (field) => {
    if (formErrors[field]) {
      setFormErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setFormErrors({});
    try {
      if (editingUser) {
        const payload = { ...form };
        if (!editingPasswordField || payload.password === '••••••') {
          delete payload.password;
          delete payload.password_confirmation;
        }
        const { data } = await api.put(`/users/${editingUser.id}`, payload);
        if (payload.is_recycled || (editingPasswordField && payload.password)) {
          setLastCreatedUser(data?.data || { ...editingUser, ...payload });
          setLastPassword(payload.password);
        }
        flash('Usuario actualizado correctamente');
      } else {
        const { data } = await api.post('/users', form);
        setLastCreatedUser(data?.data);
        setLastPassword(form.password);
        flash('Usuario creado correctamente');
      }
      setForm({ name: '', whatsapp: '', email: '', username: '', role: 'usuario', password: '', password_confirmation: '', comision_rate: '30' });
      setEditingUser(null);
      setGeneratedUsername('');
      setShowPassword(false);
      setShowModal(false);
      load();
    } catch (e) {
      const data = e?.response?.data;
      if (data?.errors) {
        const parsed = {};
        Object.entries(data.errors).forEach(([field, rules]) => {
          parsed[field] = rules.map((rule) => {
            if (typeof rule === 'string') {
              const clean = rule.replace('validation.', '');
              const fn = errorMessages[clean];
              return fn ? fn(field) : rule;
            }
            return rule;
          });
        });
        setFormErrors(parsed);
      } else {
        flash(data?.message || 'Error al guardar usuario');
      }
    } finally {
      setFormLoading(false);
    }
  };

  const handleToggle = async (userId) => {
    const user = users.find((u) => u.id === userId);
    if (!user) return;
    const prevActive = user.is_active;
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, is_active: !prevActive } : u))
    );
    try {
      await api.post(`/users/${userId}/toggle`);
    } catch (e) {
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, is_active: prevActive } : u))
      );
      flash(e?.response?.data?.message || 'Error al cambiar estado');
    }
  };

  const handleDelete = async () => {
    if (!deleteModal) return;
    const userId = deleteModal;
    const user = users.find((u) => u.id === userId);
    setUsers((prev) => prev.filter((u) => u.id !== userId));
    try {
      await api.delete(`/users/${userId}`);
      flash('Usuario eliminado');
    } catch (e) {
      if (user) setUsers((prev) => [...prev, user]);
      flash(e?.response?.data?.message || 'Error al eliminar usuario');
    }
    setDeleteModal(null);
  };

  // Guarda el porcentaje inline al salir del campo (blur) o Enter
  const handleRateSave = async (userId, rawVal) => {
    const rate = parseFloat(rawVal);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      flash('El porcentaje debe estar entre 0 y 100');
      // Revertir display al valor original
      const orig = users.find((u) => u.id === userId)?.comision_rate ?? 30;
      setRateEdits((prev) => ({ ...prev, [userId]: String(orig) }));
      return;
    }
    const rounded = Math.round(rate * 100) / 100;
    setRateSaving((prev) => ({ ...prev, [userId]: true }));
    try {
      await api.put(`/users/${userId}`, { comision_rate: rounded });
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, comision_rate: rounded } : u));
      setRateEdits((prev) => { const n = { ...prev }; delete n[userId]; return n; });
      flash(`Comisión actualizada a ${rounded}%`);
    } catch (e) {
      flash(e?.response?.data?.message || 'Error al actualizar comisión');
    } finally {
      setRateSaving((prev) => { const n = { ...prev }; delete n[userId]; return n; });
    }
  };

  const whatsappShare = (user) => {
    const text = `Usuario: ${user.username}\nClave: ${lastPassword}`;
    const encoded = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-white text-xl font-bold">Usuarios</h2>
        {isAdmin && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2 px-4 rounded-lg transition text-sm"
          >
            <FiUserPlus size={16} /> Nuevo usuario
          </button>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => { setShowModal(false); setEditingUser(null); setForm({ name: '', whatsapp: '', email: '', username: '', role: 'usuario', password: '', password_confirmation: '' }); setFormErrors({}); }}>
          <div className="bg-gray-800 border border-indigo-500/20 rounded-2xl w-full max-w-md shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold">{editingUser ? 'Editar usuario' : 'Crear usuario'}</h3>
              <button onClick={() => { setShowModal(false); setEditingUser(null); setFormErrors({}); }} className="text-gray-400 hover:text-white transition">
                <FiX size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Nombre <span className="text-red-400">*</span></label>
                <input
                  ref={nameInputRef}
                  type="text"
                  required
                  value={form.name}
                  onChange={handleNameChange}
                  className={`w-full bg-gray-700/50 border rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-indigo-500 ${formErrors.name ? 'border-red-500' : 'border-gray-600'}`}
                  placeholder="Ej: Cesar Sanchez"
                />
                {formErrors.name && <p className="text-red-400 text-xs mt-1">{formErrors.name.join('. ')}</p>}
              </div>

              {generatedUsername ? (
                <div className="text-xs text-gray-400">
                  {editingUser ? 'Nuevo username (usuario reciclado):' : 'Username generado:'}{' '}
                  <span className="text-indigo-300 font-mono">{generatedUsername}</span>
                </div>
              ) : editingUser ? (
                <div className="text-xs text-gray-400">
                  Username actual: <span className="text-indigo-300 font-mono">{form.username}</span>
                </div>
              ) : null}

              <div>
                <label className="block text-xs text-gray-400 mb-1">WhatsApp</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={form.whatsapp}
                  onChange={(e) => { const val = e.target.value.replace(/[^0-9]/g, ''); setForm((p) => ({ ...p, whatsapp: val })); clearFieldError('whatsapp'); }}
                  className={`w-full bg-gray-700/50 border rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-indigo-500 ${formErrors.whatsapp ? 'border-red-500' : 'border-gray-600'}`}
                  placeholder="Solo números"
                />
                {formErrors.whatsapp && <p className="text-red-400 text-xs mt-1">{formErrors.whatsapp.join('. ')}</p>}
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => { setForm((p) => ({ ...p, email: e.target.value })); clearFieldError('email'); }}
                  className={`w-full bg-gray-700/50 border rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-indigo-500 ${formErrors.email ? 'border-red-500' : 'border-gray-600'}`}
                  placeholder="Ej: juan@agencia.com"
                />
                {formErrors.email && <p className="text-red-400 text-xs mt-1">{formErrors.email.join('. ')}</p>}
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Rol</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
                  disabled={shownRoles.length === 1}
                  className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-indigo-500 disabled:opacity-60"
                >
                  {shownRoles.map((r) => (
                    <option key={r} value={r}>{r === 'usuario' ? 'Usuario' : r === 'admin' ? 'Admin' : 'Super Admin'}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Contraseña {editingUser ? '' : <span className="text-red-400">*</span>}</label>
                <div className="relative">
                  {editingUser ? (
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={form.password}
                      onFocus={() => {
                        if (!editingPasswordField) {
                          setEditingPasswordField(true);
                          setForm((p) => ({ ...p, password: '', password_confirmation: '' }));
                        }
                      }}
                      onChange={(e) => { setForm((p) => ({ ...p, password: e.target.value, password_confirmation: e.target.value })); clearFieldError('password'); }}
                      className={`w-full bg-gray-700/50 border rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-indigo-500 pr-10 ${formErrors.password ? 'border-red-500' : 'border-gray-600'}`}
                      placeholder={editingPasswordField ? 'Nueva contraseña' : ''}
                    />
                  ) : (
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={form.password}
                      onChange={(e) => { setForm((p) => ({ ...p, password: e.target.value, password_confirmation: e.target.value })); clearFieldError('password'); }}
                      className={`w-full bg-gray-700/50 border rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-indigo-500 pr-10 ${formErrors.password ? 'border-red-500' : 'border-gray-600'}`}
                      placeholder="Ej: loxo12"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition"
                    title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  >
                    {showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                  </button>
                </div>
                {formErrors.password && <p className="text-red-400 text-xs mt-1">{formErrors.password.join('. ')}</p>}
                <p className="text-[10px] text-gray-500 mt-1">6 caracteres: 4 letras + 2 dígitos (ej: loxo12)</p>
              </div>

              {/* Porcentaje de comisión (solo para pasadores) */}
              {(form.role === 'usuario' || !form.role) && (
                <div>
                  <label className="block text-xs text-gray-400 mb-1 flex items-center gap-1">
                    <FiPercent size={11} /> Comisión del pasador
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={form.comision_rate ?? '30'}
                      onChange={(e) => { setForm((p) => ({ ...p, comision_rate: e.target.value })); clearFieldError('comision_rate'); }}
                      className={`w-28 bg-gray-700/50 border rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-indigo-500 ${formErrors.comision_rate ? 'border-red-500' : 'border-gray-600'}`}
                    />
                    <span className="text-gray-400 text-sm">%</span>
                  </div>
                  {editingUser && editingUser.pending_comision_rate !== null && (
                    <p className="text-[10px] text-amber-400 mt-1 leading-tight">
                      Este usuario tiene un porcentaje pendiente ({editingUser.pending_comision_rate}%) para aplicar mañana. Al establecerlo en el mismo valor actual se cancelará el cambio.
                    </p>
                  )}
                  {formErrors.comision_rate && <p className="text-red-400 text-xs mt-1">{formErrors.comision_rate.join('. ')}</p>}
                  <p className="text-[10px] text-gray-500 mt-1">Porcentaje que retiene el pasador de sus ventas diarias. Si tiene jugadas hoy, el cambio rige a partir de mañana.</p>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2 px-4 rounded-lg text-sm transition disabled:opacity-50"
                >
                  {formLoading ? 'Guardando...' : editingUser ? 'Actualizar' : 'Crear usuario'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setEditingUser(null); setForm({ name: '', whatsapp: '', email: '', username: '', role: 'usuario', password: '', password_confirmation: '' }); setFormErrors({}); }}
                  className="bg-gray-700 hover:bg-gray-600 text-gray-200 font-medium py-2 px-4 rounded-lg text-sm transition"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {lastCreatedUser && (
        <div className="bg-gray-800/40 backdrop-blur-sm border border-green-500/30 rounded-2xl p-4 flex items-center justify-between">
          <div className="text-sm text-gray-300">
            <span className="text-green-400 font-semibold">{lastCreatedUser.name}</span>
            <span className="text-gray-500 mx-2">·</span>
            <span className="font-mono text-indigo-300">@{lastCreatedUser.username}</span>
          </div>
          <button
            onClick={() => whatsappShare(lastCreatedUser)}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white font-medium py-2 px-4 rounded-lg text-sm transition"
          >
            <FiShare2 size={16} /> Compartir por WhatsApp
          </button>
        </div>
      )}

      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setDeleteModal(null)}>
          <div className="bg-gray-800 border border-red-500/30 rounded-2xl w-full max-w-sm shadow-2xl p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="w-14 h-14 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <FiTrash2 className="text-red-400" size={24} />
            </div>
            <h3 className="text-white font-bold text-lg mb-2">Eliminar usuario</h3>
            <p className="text-gray-400 text-sm mb-6">¿Estás seguro de eliminar este usuario? Esta acción no se puede deshacer.</p>
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

      <CajaModal
        user={cajaUser}
        open={!!cajaUser}
        onClose={closeCaja}
        onError={flash}
      />

      <RentalModal
        user={rentalUser}
        mode={rentalMode}
        open={!!rentalUser}
        onClose={() => setRentalUser(null)}
        onError={flash}
      />

      {loading ? (
        <div className="flex justify-center pt-20"><FiRefreshCw className="animate-spin text-indigo-400" size={28} /></div>
      ) : (
        <div className="bg-gray-800/40 backdrop-blur-sm border border-indigo-500/10 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-gray-700/50 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="relative w-full sm:max-w-xs">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar nombre, username, whatsapp..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="w-full pl-10 pr-4 py-2 bg-gray-900/50 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500 transition"
              />
            </div>
            <div className="text-sm text-gray-400 font-medium">
              Mostrando {filteredUsers.length} usuario{filteredUsers.length !== 1 && 's'}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-gray-700/50">
                  <th className="text-left p-3">Nombre</th>
                  <th className="text-left p-3">Username</th>
                  <th className="text-left p-3">Whatsapp</th>
                  <th className="text-left p-3">Email</th>
                  <th className="text-left p-3">Rol</th>
                  {isSuperAdmin && <th className="text-left p-3">Creado por</th>}
                  <th className="text-center p-3" title="% de comisión del pasador">% Com.</th>
                  <th className="text-center p-3">Activo</th>
                  <th className="text-center p-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {paginatedUsers.length === 0 ? (
                  <tr><td colSpan={isSuperAdmin ? 9 : 8} className="text-center py-8 text-gray-400">No hay usuarios</td></tr>
                ) : paginatedUsers.map((u) => (
                  <tr key={u.id} className={`border-b border-gray-700/30 hover:bg-gray-700/20 ${u.is_active ? '' : 'opacity-40'}`}>
                    <td className="p-3 text-white">{u.name}</td>
                    <td className="p-3 text-gray-300 font-mono text-xs">{u.username}</td>
                    <td className="p-3 text-gray-300">{u.whatsapp}</td>
                    <td className="p-3 text-gray-300">{u.email}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${u.roles.includes('super_admin') ? 'bg-purple-500/20 text-purple-300' : u.roles.includes('admin') ? 'bg-indigo-500/20 text-indigo-300' : 'bg-gray-600/20 text-gray-300'}`}>
                        {u.roles?.join(', ') || 'usuario'}
                      </span>
                    </td>
                    {isSuperAdmin && (
                      <td className="p-3 text-gray-400 text-xs font-medium">
                        {u.parent_name || '—'}
                      </td>
                    )}
                    {/* Columna % comisión: editable inline solo para pasadores y admins */}
                    <td className="p-2 text-center h-full align-middle">
                      {u.roles?.includes('usuario') && isAdmin && u.id !== currentUser?.id ? (
                        <div className="flex flex-col items-center justify-center">
                          <div className="flex items-center justify-center gap-1">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.5"
                              disabled={!!rateSaving[u.id]}
                              value={rateEdits[u.id] !== undefined ? rateEdits[u.id] : String(u.comision_rate ?? 30)}
                              onChange={(e) => setRateEdits((prev) => ({ ...prev, [u.id]: e.target.value }))}
                              onBlur={(e) => {
                                const cur = String(u.comision_rate ?? 30);
                                if (e.target.value !== cur) handleRateSave(u.id, e.target.value);
                                else setRateEdits((prev) => { const n = { ...prev }; delete n[u.id]; return n; });
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') e.target.blur();
                                if (e.key === 'Escape') {
                                  setRateEdits((prev) => { const n = { ...prev }; delete n[u.id]; return n; });
                                  e.target.blur();
                                }
                              }}
                              className="w-14 bg-gray-700/60 border border-gray-600 rounded px-1.5 py-0.5 text-white text-xs text-center focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/30 transition disabled:opacity-50"
                            />
                            <span className="text-gray-500 text-xs">%</span>
                          </div>
                          {u.pending_comision_rate !== null && (
                            <span className="text-[10px] text-amber-400 mt-1 leading-none" title="Entra en vigencia mañana">
                              Mña: {u.pending_comision_rate}%
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center">
                          <span className="text-gray-500 text-xs mt-1">
                            {u.roles?.includes('usuario') ? `${u.comision_rate ?? 30}%` : '—'}
                          </span>
                          {u.pending_comision_rate !== null && (
                            <span className="text-[10px] text-amber-400 mt-1 leading-none" title="Entra en vigencia mañana">
                              Mña: {u.pending_comision_rate}%
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-center cursor-pointer" onClick={() => handleToggle(u.id)} title={u.is_active ? 'Desactivar' : 'Activar'}>
                      {u.is_active
                        ? <FiToggleRight className="text-green-400 mx-auto" size={20} />
                        : <FiToggleLeft className="text-red-400 mx-auto" size={20} />}
                    </td>
                    <td className="p-3 text-center">
                      {isAdmin && (
                        <div className="flex items-center justify-center gap-3">
                          <button onClick={() => openCaja(u)} className="text-emerald-400 hover:text-emerald-300 transition p-1" title="Caja">
                            <FiDollarSign size={14} />
                          </button>
                          {u.id !== currentUser?.id && (
                            <>
                              <button onClick={() => openEdit(u)} className="text-indigo-400 hover:text-indigo-300 transition p-1" title="Editar">
                                <FiEdit size={14} />
                              </button>
                              <button onClick={() => setDeleteModal(u.id)} className="text-red-400 hover:text-red-300 transition p-1" title="Eliminar">
                                <FiTrash2 size={14} />
                              </button>
                              {isSuperAdmin && u.roles.includes('admin') && (
                                <>
                                  <button onClick={() => { setRentalUser(u); setRentalMode('config'); }} className="text-orange-400 hover:text-orange-300 transition p-1 mt-1" title="Configurar tiempo e importe">
                                    <FiClock size={15} />
                                  </button>
                                  <button onClick={() => { setRentalUser(u); setRentalMode('history'); }} className="text-blue-400 hover:text-blue-300 transition p-1 mt-1" title="Historial de locación">
                                    <FiList size={15} />
                                  </button>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="p-4 border-t border-gray-700/50 flex items-center justify-between">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="flex items-center gap-1 text-sm text-gray-300 hover:text-white disabled:opacity-30 transition font-medium"
              >
                <FiChevronLeft size={16} /> Anterior
              </button>
              <div className="flex gap-1 flex-wrap justify-center max-w-[200px] sm:max-w-none">
                {Array.from({length: totalPages}, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-8 h-8 rounded-lg text-sm font-bold transition flex items-center justify-center ${currentPage === page ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'hover:bg-gray-700 text-gray-400 hover:text-white'}`}
                  >
                    {page}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="flex items-center gap-1 text-sm text-gray-300 hover:text-white disabled:opacity-30 transition font-medium"
              >
                Siguiente <FiChevronRight size={16} />
              </button>
            </div>
          )}
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