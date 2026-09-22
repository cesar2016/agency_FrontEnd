import { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { FiSave, FiCheckSquare, FiSquare, FiList, FiEdit2, FiCheck, FiX } from 'react-icons/fi';

export default function LimitsPage() {
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.roles?.some(r => r === 'admin' || r === 'super_admin');

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Form states
  const [limit4, setLimit4] = useState('');
  const [limit3, setLimit3] = useState('');
  const [limit2, setLimit2] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);

  // Edit states for the table inline
  const [editingUserId, setEditingUserId] = useState(null);
  const [editLimit4, setEditLimit4] = useState('');
  const [editLimit3, setEditLimit3] = useState('');
  const [editLimit2, setEditLimit2] = useState('');

  const flash = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/users');
      // Mantenemos a los pasadores ('usuario') y al propio admin ('currentUser.id')
      const relevantUsers = (Array.isArray(data?.data) ? data.data : []).filter(u => 
        u.roles.includes('usuario') || u.id === currentUser?.id
      );
      setUsers(relevantUsers);
    } catch (e) {
      flash(e?.response?.data?.message || 'Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSelectAll = () => {
    if (selectedIds.length === users.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(users.map(u => u.id));
    }
  };

  const toggleSelect = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(x => x !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handeBulkSubmit = async (e) => {
    e.preventDefault();
    if (selectedIds.length === 0) {
      flash('Selecciona al menos un pasador.');
      return;
    }

    try {
      const payload = {
        user_ids: selectedIds,
        limit_4_cifras: limit4 ? parseFloat(limit4) : null,
        limit_3_cifras: limit3 ? parseFloat(limit3) : null,
        limit_2_cifras: limit2 ? parseFloat(limit2) : null,
      };

      const res = await api.post('/users/limits', payload);
      flash(res.data.message || 'Topes actualizados correctamente.');
      
      // Reset form
      setLimit4('');
      setLimit3('');
      setLimit2('');
      setSelectedIds([]);
      load();
    } catch (e) {
      flash(e?.response?.data?.message || 'Error al actualizar topes');
    }
  };

  const startInlineEdit = (user) => {
    setEditingUserId(user.id);
    setEditLimit4(user.limit_4_cifras ?? '');
    setEditLimit3(user.limit_3_cifras ?? '');
    setEditLimit2(user.limit_2_cifras ?? '');
  };

  const cancelInlineEdit = () => {
    setEditingUserId(null);
  };

  const saveInlineEdit = async (userId) => {
    try {
      const payload = {
        user_ids: [userId],
        limit_4_cifras: editLimit4 !== '' ? parseFloat(editLimit4) : null,
        limit_3_cifras: editLimit3 !== '' ? parseFloat(editLimit3) : null,
        limit_2_cifras: editLimit2 !== '' ? parseFloat(editLimit2) : null,
      };
      await api.post('/users/limits', payload);
      flash('Topes del pasador actualizados.');
      setEditingUserId(null);
      load();
    } catch (e) {
      flash(e?.response?.data?.message || 'Error al guardar');
    }
  };

  if (!isAdmin) {
    return <div className="text-center text-white py-20">Acceso denegado</div>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-10">
      
      <div className="bg-gray-800/40 backdrop-blur-sm border border-indigo-500/10 rounded-2xl p-6 shadow-xl">
        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <FiSave className="text-indigo-400" /> Regulación de Topes de Apuesta (Premios)
        </h2>
        
        <form onSubmit={handeBulkSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-700/50">
              <label className="block text-sm font-medium text-gray-300 mb-2">Tope Cuaterno (4 cifras) $</label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Ej: 100000"
                value={limit4}
                onChange={e => setLimit4(e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-700/50">
              <label className="block text-sm font-medium text-gray-300 mb-2">Tope Terno (3 cifras) $</label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Ej: 500"
                value={limit3}
                onChange={e => setLimit3(e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-700/50">
              <label className="block text-sm font-medium text-gray-300 mb-2">Tope Ambo (2 cifras) $</label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Ej: 10"
                value={limit2}
                onChange={e => setLimit2(e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
          <p className="text-xs text-gray-400 -mt-2">Dejar en blanco para no aplicar límite (infinito).</p>

          <div>
            <div className="flex items-center justify-between mb-3 border-b border-gray-700 pb-2">
              <h3 className="text-white font-medium">Seleccionar Pasadores</h3>
              <button 
                type="button" 
                onClick={handleSelectAll} 
                className="text-indigo-400 text-sm hover:text-indigo-300 flex items-center gap-1"
              >
                {selectedIds.length === users.length && users.length > 0 ? <FiCheckSquare /> : <FiSquare />}
                Todos
              </button>
            </div>
            {loading ? (
              <p className="text-gray-400 text-sm">Cargando...</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-h-60 overflow-y-auto pr-2">
                {users.map(u => (
                  <label key={u.id} className="flex items-center gap-3 bg-gray-900/30 p-2.5 rounded-lg border border-gray-700/30 cursor-pointer hover:bg-gray-800/80 transition">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(u.id)}
                      onChange={() => toggleSelect(u.id)}
                      className="w-4 h-4 text-indigo-600 rounded border-gray-600 bg-gray-700 focus:ring-indigo-500 focus:ring-offset-gray-900"
                    />
                    <div className="truncate">
                      <div className="text-sm font-medium text-gray-200 truncate">
                        {u.name} {u.id === currentUser.id && <span className="text-indigo-400 text-xs font-bold">(Tú)</span>}
                      </div>
                      <div className="text-xs text-gray-500 truncate">@{u.username}</div>
                    </div>
                  </label>
                ))}
                {users.length === 0 && <p className="text-gray-400 text-sm col-span-full">No hay usuarios disponibles.</p>}
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={selectedIds.length === 0}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 px-8 rounded-xl transition flex items-center gap-2"
            >
              <FiCheck /> Aplicar Límites
            </button>
          </div>
        </form>
      </div>

      <div className="bg-gray-800/40 backdrop-blur-sm border border-indigo-500/10 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-5 border-b border-gray-700/50 bg-gray-800/60">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <FiList className="text-indigo-400" /> Límites Actuales
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700/50 bg-gray-900/20">
                <th className="text-left p-4">Usuario</th>
                <th className="text-center p-4">Tope 4 Cifras</th>
                <th className="text-center p-4">Tope 3 Cifras</th>
                <th className="text-center p-4">Tope 2 Cifras</th>
                <th className="text-right p-4">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                const isEditing = editingUserId === u.id;
                
                return (
                  <tr key={u.id} className="border-b border-gray-700/30 hover:bg-gray-700/10">
                    <td className="p-4">
                      <div className="text-gray-200 font-medium">
                        {u.name} {u.id === currentUser.id && <span className="text-indigo-400 text-xs font-bold">(Tú)</span>}
                      </div>
                      <div className="text-gray-500 text-xs text-mono">@{u.username}</div>
                    </td>
                    
                    <td className="p-4 text-center border-l border-gray-700/20">
                      {isEditing ? (
                        <input type="number" min="0" step="0.01" value={editLimit4} onChange={e => setEditLimit4(e.target.value)} className="w-24 bg-gray-900 border border-gray-600 rounded px-2 py-1 text-white text-center text-xs" />
                      ) : (
                        <span className={u.limit_4_cifras !== null ? "font-bold text-amber-400" : "text-gray-500"}>
                          {u.limit_4_cifras !== null ? `$${u.limit_4_cifras}` : 'Ilimitado'}
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-center border-l border-gray-700/20">
                       {isEditing ? (
                        <input type="number" min="0" step="0.01" value={editLimit3} onChange={e => setEditLimit3(e.target.value)} className="w-24 bg-gray-900 border border-gray-600 rounded px-2 py-1 text-white text-center text-xs" />
                      ) : (
                        <span className={u.limit_3_cifras !== null ? "font-bold text-green-400" : "text-gray-500"}>
                          {u.limit_3_cifras !== null ? `$${u.limit_3_cifras}` : 'Ilimitado'}
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-center border-l border-gray-700/20">
                       {isEditing ? (
                        <input type="number" min="0" step="0.01" value={editLimit2} onChange={e => setEditLimit2(e.target.value)} className="w-24 bg-gray-900 border border-gray-600 rounded px-2 py-1 text-white text-center text-xs" />
                      ) : (
                        <span className={u.limit_2_cifras !== null ? "font-bold text-blue-400" : "text-gray-500"}>
                          {u.limit_2_cifras !== null ? `$${u.limit_2_cifras}` : 'Ilimitado'}
                        </span>
                      )}
                    </td>
                    
                    <td className="p-4 text-right">
                      {isEditing ? (
                        <div className="flex justify-end gap-2 text-lg">
                          <button onClick={() => saveInlineEdit(u.id)} className="text-emerald-400 hover:text-emerald-300" title="Guardar"><FiCheck /></button>
                          <button onClick={cancelInlineEdit} className="text-red-400 hover:text-red-300" title="Cancelar"><FiX /></button>
                        </div>
                      ) : (
                         <button onClick={() => startInlineEdit(u)} className="text-indigo-400 hover:text-indigo-300 transition p-1" title="Editar Topes">
                           <FiEdit2 size={16} />
                         </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 && !loading && (
                <tr>
                  <td colSpan="5" className="text-center p-8 text-gray-500">No hay usuarios pasadores para mostrar.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-4 right-4 bg-gray-800 border border-indigo-500/30 rounded-xl px-4 py-3 text-sm text-white shadow-2xl z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
