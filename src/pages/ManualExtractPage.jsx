import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { FiChevronLeft, FiRefreshCw, FiCheck, FiX, FiGrid } from 'react-icons/fi';

const LOTTERY_ORDER = [
  'NAC', 'PBA', 'SF', 'CBA', 'CBAT', 'ER', 'ERT', 'MZA', 'CTES', 'CH', 'CAT', 'FSA', 'FSAQ',
  'JUJ', 'LR', 'MIS', 'NQN', 'RN', 'SAL', 'SALR', 'SL', 'SC', 'SGO', 'TUC',
  'CT', 'SJ', 'URU', 'PAR',
];

function lotteryRank(initials) {
  const i = LOTTERY_ORDER.indexOf(initials);
  return i === -1 ? 999 : i;
}

export default function ManualExtractPage() {
  const navigate = useNavigate();
  const [draws, setDraws] = useState([]);
  const [lotteries, setLotteries] = useState([]);
  const [loading, setLoading] = useState(true);

  const [drawId, setDrawId] = useState('');
  const [lotteryId, setLotteryId] = useState('');
  const [numbers, setNumbers] = useState(() => Array.from({ length: 20 }, () => ''));

  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [preview, setPreview] = useState(null); // extracto a confirmar

  const flash = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, l] = await Promise.all([api.get('/draws'), api.get('/lotteries')]);
      const drawsData = Array.isArray(d.data) ? d.data : (d.data?.data ?? []);
      const lotsData = Array.isArray(l.data) ? l.data : (l.data?.data ?? []);
      setDraws(drawsData);
      setLotteries(lotsData);
    } catch (e) {
      flash(e?.response?.data?.message || 'No se pudieron cargar las secciones/loterías');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const setNumber = (idx, val) => {
    // Solo dígitos, máximo 4 caracteres.
    const clean = val.replace(/\D/g, '').slice(0, 4);
    setNumbers((prev) => {
      const next = [...prev];
      next[idx] = clean;
      return next;
    });
  };

  const filled = numbers.filter((n) => n !== '').length;
  const allFilled = filled === 20;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!drawId || !lotteryId) {
      flash('Seleccioná la sección y la lotería');
      return;
    }
    if (!allFilled) {
      flash(`Faltan números: completá los 20 (vas ${filled}/20)`);
      return;
    }

    setBusy(true);
    try {
      const payload = {
        lottery_id: Number(lotteryId),
        draw_id: Number(drawId),
        draw_date: new Date().toISOString().slice(0, 10),
        numbers: numbers.map((n, i) => ({ position: i + 1, number: n })),
      };
      // El proxy MySQL de produccion es inestable y falla ~50% de las veces
      // con 500/timeout. Reintentamos hasta 3 veces antes de mostrar error.
      let data = null;
      let lastErr = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const res = await api.post('/extracts', payload);
          data = res.data;
          break;
        } catch (e) {
          lastErr = e;
          const st = e?.response?.status;
          if (st && st < 500 && st !== undefined) break; // error de validacion: no reintentar
          if (attempt < 3) await new Promise((r) => setTimeout(r, 800 * attempt));
        }
      }
      if (!data) throw lastErr;
      // Endpoint existente: crea el extracto y devuelve el registro completo.
      setPreview(data.data ?? data);
    } catch (err) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.message;
      if (status >= 500) {
        flash('Error del servidor al guardar. Reintentá en unos segundos.');
      } else {
        flash(msg || 'No se pudo cargar el extracto');
      }
    } finally {
      setBusy(false);
    }
  };

  const confirmPreview = async () => {
    setBusy(true);
    try {
      // El extracto ya quedó registrado en el POST anterior; solo confirmamos
      // y redirigimos a la sección de extractos.
      flash('Extracto cargado correctamente');
      navigate('/extracts/scrape');
    } catch (err) {
      flash(err?.response?.data?.message || 'Error al confirmar');
    } finally {
      setBusy(false);
    }
  };

  const drawName = draws.find((d) => String(d.id) === String(drawId))?.name || '';
  const lot = lotteries.find((l) => String(l.id) === String(lotteryId));

  if (loading) {
    return <div className="flex justify-center pt-20"><FiRefreshCw className="animate-spin text-indigo-400" size={28} /></div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <button
        onClick={() => navigate('/extracts/scrape')}
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition"
      >
        <FiChevronLeft /> Volver a Extractos
      </button>

      {toast && (
        <div className="bg-indigo-500/15 border border-indigo-500/30 text-indigo-200 px-4 py-2 rounded-lg text-sm">
          {toast}
        </div>
      )}

      <div>
        <h2 className="text-xl font-bold text-white">Carga manual de extracto</h2>
        <p className="text-sm text-gray-400">Cargá un sorteo de a uno: elegí sección, lotería y los 20 números.</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-gray-800/40 backdrop-blur-sm border border-indigo-500/10 rounded-2xl p-5 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-xs text-gray-400">Sección (turno)</span>
            <select
              value={drawId}
              onChange={(e) => setDrawId(e.target.value)}
              className="mt-1 w-full bg-gray-900/60 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
            >
              <option value="">Seleccionar sección…</option>
              {draws.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs text-gray-400">Lotería</span>
            <select
              value={lotteryId}
              onChange={(e) => setLotteryId(e.target.value)}
              className="mt-1 w-full bg-gray-900/60 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
            >
              <option value="">Seleccionar lotería…</option>
              {[...lotteries]
                .sort((a, b) => lotteryRank(a.initials) - lotteryRank(b.initials))
                .map((l) => (
                  <option key={l.id} value={l.id}>{l.name} ({l.initials})</option>
                ))}
            </select>
          </label>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400">Números del extracto (posición 1 a 20)</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${allFilled ? 'bg-green-500/15 text-green-300' : 'bg-yellow-500/15 text-yellow-300'}`}>
              {filled}/20
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2">
            {numbers.map((n, i) => (
              <div key={i} className="flex items-center gap-1.5 bg-gray-900/40 rounded-lg px-2 py-1.5">
                <span className="text-[10px] text-gray-500 w-5 text-right">{i + 1}</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={n}
                  onChange={(e) => setNumber(i, e.target.value)}
                  className="w-full bg-transparent text-center font-mono font-bold text-white text-sm focus:outline-none"
                  placeholder="----"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => { setNumbers(Array.from({ length: 20 }, () => '')); setDrawId(''); setLotteryId(''); }}
            className="text-sm text-gray-300 hover:text-white bg-gray-700/60 hover:bg-gray-700 px-4 py-2 rounded-lg transition"
          >
            Limpiar
          </button>
          <button
            type="submit"
            disabled={busy || !allFilled || !drawId || !lotteryId}
            className="flex items-center gap-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-lg transition disabled:opacity-50"
          >
            {busy ? <FiRefreshCw size={14} className="animate-spin" /> : <FiGrid size={14} />}
            Cargar extracto
          </button>
        </div>
      </form>

      {/* Preview modal: muestra el extracto recién cargado para aceptar/cancelar */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-gray-900 border border-indigo-500/30 rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-700/50">
              <span className="flex items-center justify-center w-9 h-9 rounded-full bg-indigo-500/15 text-indigo-400">
                <FiGrid size={18} />
              </span>
              <div>
                <h3 className="text-base font-semibold text-white">Confirmar extracto</h3>
                <p className="text-xs text-gray-400">
                  {lot?.name} ({lot?.initials}) · {drawName}
                </p>
              </div>
            </div>

            <div className="px-5 py-4">
              <div className="grid grid-cols-2 gap-2">
                {(preview.numbers || [])
                  .slice()
                  .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
                  .map((num) => (
                    <div key={num.id || num.position} className="flex items-center justify-between rounded-lg px-3 py-2 bg-gray-800/60">
                      <span className="text-[10px] text-gray-500">#{num.position}</span>
                      <span className="font-mono font-bold text-base text-white">{num.number}</span>
                    </div>
                  ))}
              </div>
              {(!preview.numbers || preview.numbers.length === 0) && (
                <p className="text-xs text-gray-500 text-center">Sin números cargados.</p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-700/50">
              <button
                onClick={() => setPreview(null)}
                disabled={busy}
                className="flex items-center gap-1.5 text-sm text-gray-300 hover:text-white bg-gray-700/60 hover:bg-gray-700 px-4 py-2 rounded-lg transition disabled:opacity-50"
              >
                <FiX size={14} /> Cancelar y editar
              </button>
              <button
                onClick={confirmPreview}
                disabled={busy}
                className="flex items-center gap-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-lg transition disabled:opacity-50"
              >
                {busy ? <FiRefreshCw size={14} className="animate-spin" /> : <FiCheck size={14} />}
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
