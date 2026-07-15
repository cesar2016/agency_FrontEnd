import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { FiUpload, FiCheck, FiRefreshCw, FiSearch, FiChevronDown, FiChevronUp, FiPlay } from 'react-icons/fi';

function Accordion({ title, count, open, onToggle, children }) {
  return (
    <div className="bg-gray-800/40 backdrop-blur-sm border border-indigo-500/10 rounded-2xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 text-white font-semibold hover:bg-gray-700/20 transition"
      >
        <span>{title} {count !== undefined && <span className="text-sm text-gray-400 font-normal">({count})</span>}</span>
        {open ? <FiChevronUp size={18} className="text-gray-400" /> : <FiChevronDown size={18} className="text-gray-400" />}
      </button>
      {open && <div className="p-4 pt-0">{children}</div>}
    </div>
  );
}

export default function ExtractUploadPage() {
  const [lotteries, setLotteries] = useState([]);
  const [draws, setDraws] = useState([]);
  const [lotteryId, setLotteryId] = useState('');
  const [drawId, setDrawId] = useState('');
  const [drawDate, setDrawDate] = useState(new Date().toISOString().split('T')[0]);
  const [numbers, setNumbers] = useState(Array.from({ length: 20 }, (_, i) => ({ position: i + 1, number: '' })));
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null);

  const [extracts, setExtracts] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [search, setSearch] = useState('');
  const [filterDrawIds, setFilterDrawIds] = useState([]);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [openForm, setOpenForm] = useState(true);
  const [openList, setOpenList] = useState(false);
  const [openExtract, setOpenExtract] = useState(null);
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    api.get('/lotteries').then((r) => setLotteries(r.data));
    api.get('/draws').then((r) => setDraws(r.data));
  }, []);

  const fetchExtracts = useCallback(async () => {
    setLoadingList(true);
    try {
      const params = {};
      if (search) params.q = search;
      if (filterDrawIds.length === 1) params.draw_id = filterDrawIds[0];
      if (filterDate) params.date = filterDate;
      const { data } = await api.get('/extracts', { params });
      setExtracts(data.data || data);
    } finally {
      setLoadingList(false);
    }
  }, [search, filterDate, filterDrawIds]);

  useEffect(() => {
    fetchExtracts();
  }, [fetchExtracts]);

  const updateNumber = (index, value) => {
    const updated = [...numbers];
    updated[index] = { ...updated[index], number: value.replace(/\D/g, '') };
    setNumbers(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setSuccess(null);
    try {
      await api.post('/extracts', {
        lottery_id: Number(lotteryId),
        draw_id: Number(drawId),
        draw_date: drawDate,
        numbers: numbers.map((n) => ({ position: n.position, number: n.number || '00' })),
      });
      setSuccess('Extracto cargado exitosamente');
      setNumbers(numbers.map((n) => ({ ...n, number: '' })));
      fetchExtracts();
    } catch {
      alert('Error al cargar el extracto');
    } finally {
      setSubmitting(false);
    }
  };

  const runScrutiny = async (id) => {
    setProcessingId(id);
    try {
      await api.post(`/scrutiny/${id}`);
      fetchExtracts();
    } catch {
      alert('Error al procesar el escrutinio');
    } finally {
      setProcessingId(null);
    }
  };

  const getDrawName = (id) => draws.find((d) => d.id === id)?.name || '';
  const getLotteryName = (id) => lotteries.find((l) => l.id === id)?.name || '';

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {success && (
        <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-2 rounded-lg flex items-center gap-2">
          <FiCheck /> {success}
        </div>
      )}

      <Accordion title="Carga de Extracto Oficial" open={openForm} onToggle={() => setOpenForm(!openForm)}>
        <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm text-gray-300 block mb-1">Loteria</label>
            <select value={lotteryId} onChange={(e) => setLotteryId(e.target.value)} required
              className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500">
              <option value="">Seleccionar...</option>
              {lotteries.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm text-gray-300 block mb-1">Sorteo</label>
            <select value={drawId} onChange={(e) => setDrawId(e.target.value)} required
              className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500">
              <option value="">Seleccionar...</option>
              {draws.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm text-gray-300 block mb-1">Fecha</label>
            <input type="date" value={drawDate} onChange={(e) => setDrawDate(e.target.value)}
              className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" />
          </div>
        </div>

        <div>
          <h3 className="text-white font-semibold mb-3">Numeros del Extracto (Posicion 1 a 20)</h3>
          <div className="grid grid-cols-5 md:grid-cols-10 gap-2">
            {numbers.map((n, i) => (
              <div key={n.position}>
                <label className="text-xs text-gray-500 block mb-0.5">#{n.position}</label>
                <input
                  type="text"
                  maxLength={4}
                  value={n.number}
                  onChange={(e) => updateNumber(i, e.target.value)}
                  className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-2 py-1.5 text-white text-xs text-center focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting || !lotteryId || !drawId}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition shadow-lg shadow-indigo-500/20"
        >
          {submitting ? <FiRefreshCw className="animate-spin" size={18} /> : <FiUpload size={18} />}
          {submitting ? 'Procesando...' : 'Cargar Extracto'}
        </button>
      </form>
      </Accordion>

      <Accordion title="Extractos Cargados" count={extracts.length} open={openList} onToggle={() => setOpenList(!openList)}>

        <div className="flex flex-col md:flex-row gap-3 mb-4">
          <div className="flex-1 relative">
            <FiSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por loteria o numero..."
              className="w-full bg-gray-700/50 border border-gray-600 rounded-lg pl-9 pr-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {draws.map((d) => {
              const sel = filterDrawIds.includes(d.id);
              return (
                <label
                  key={d.id}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs cursor-pointer transition ${
                    sel
                      ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-200'
                      : 'bg-gray-700/30 border-gray-600/50 text-gray-400 hover:border-gray-500'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={sel}
                    onChange={() => setFilterDrawIds((prev) =>
                      prev.includes(d.id) ? prev.filter((id) => id !== d.id) : [...prev, d.id]
                    )}
                    className="w-3.5 h-3.5 rounded border-gray-600 bg-gray-700 text-indigo-600 focus:ring-indigo-500"
                  />
                  {d.name}
                </label>
              );
            })}
          </div>
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 w-full sm:w-40"
          />
        </div>

        {loadingList ? (
          <div className="flex justify-center py-8"><FiRefreshCw className="animate-spin text-indigo-400" size={24} /></div>
        ) : extracts.length === 0 ? (
          <p className="text-gray-400 text-center py-8">No hay extractos cargados</p>
        ) : (
          <div className="space-y-3">
            {extracts.map((ex) => (
              <div key={ex.id} className="bg-gray-700/30 rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenExtract(openExtract === ex.id ? null : ex.id)}
                  className="w-full flex items-center justify-between p-3 hover:bg-gray-700/50 transition"
                >
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-indigo-300 font-semibold">{ex.lottery?.initials || getLotteryName(ex.lottery_id)}</span>
                    <span className="text-white">{ex.draw?.name || getDrawName(ex.draw_id)}</span>
                    <span className="text-gray-400">{ex.draw_date}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      ex.status === 'completed' ? 'bg-green-500/20 text-green-300' : 'bg-yellow-500/20 text-yellow-300'
                    }`}>{ex.status}</span>
                    {ex.status === 'pending' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); runScrutiny(ex.id); }}
                        disabled={processingId === ex.id}
                        className="flex items-center gap-1 text-xs bg-indigo-600/40 hover:bg-indigo-600/60 text-indigo-200 px-2.5 py-1 rounded-lg transition disabled:opacity-50"
                      >
                        {processingId === ex.id ? <FiRefreshCw size={12} className="animate-spin" /> : <FiPlay size={12} />}
                        Procesar
                      </button>
                    )}
                  </div>
                  {openExtract === ex.id ? <FiChevronUp className="text-gray-400" /> : <FiChevronDown className="text-gray-400" />}
                </button>
                {openExtract === ex.id && (
                  <div className="px-3 pb-3">
                    <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
                      {(ex.numbers || []).sort((a, b) => a.position - b.position).map((n) => {
                        const match = search && n.number.endsWith(search);
                        return (
                          <div key={n.id || n.position} className={`rounded-lg px-2 py-1.5 text-center ${match ? 'bg-yellow-500/30 ring-2 ring-yellow-400' : 'bg-gray-800/60'}`}>
                            <span className="text-[10px] text-gray-500 block">#{n.position}</span>
                            <span className={`font-mono font-bold text-sm ${match ? 'text-yellow-200' : 'text-white'}`}>{n.number}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Accordion>
    </div>
  );
}
