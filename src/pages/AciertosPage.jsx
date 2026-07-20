import { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { FiRefreshCw, FiChevronDown, FiChevronUp, FiRotateCcw } from 'react-icons/fi';

const prizeTable = [
  { ubicacion: 1,  cuatro_cifras: 175000, tres_cifras: 30000, dos_cifras: 3500 },
  { ubicacion: 2,  cuatro_cifras: 87500,  tres_cifras: 15000, dos_cifras: 1750 },
  { ubicacion: 3,  cuatro_cifras: 58300,  tres_cifras: 10000, dos_cifras: 1165 },
  { ubicacion: 4,  cuatro_cifras: 43750,  tres_cifras: 7500,  dos_cifras: 875 },
  { ubicacion: 5,  cuatro_cifras: 35000,  tres_cifras: 6000,  dos_cifras: 700 },
  { ubicacion: 10, cuatro_cifras: 17500,  tres_cifras: 3000,  dos_cifras: 350 },
  { ubicacion: 20, cuatro_cifras: 8750,   tres_cifras: 1500,  dos_cifras: 175 },
];

// Pagos por apuesta a 1 cifra segun el puesto (veces el importe jugado).
// Solo aplica para numeros de 1 cifra y posiciones del 1 al 10.
const singleDigitPayout = [
  { range: 'Al 1 (Cabeza)', mult: 7.00 },
  { range: 'A los 2',       mult: 3.50 },
  { range: 'A los 3',       mult: 2.33 },
  { range: 'A los 4',       mult: 1.75 },
  { range: 'A los 5',       mult: 1.40 },
  { range: 'A los 6',       mult: 1.166 },
  { range: 'A los 7',       mult: 1.00 },
  { range: 'A los 8',       mult: 0.875 },
  { range: 'A los 9',       mult: 0.777 },
  { range: 'A los 10',      mult: 0.70 },
];

// Tabla de pagos de Redoblona (los valores son de ejemplo, por terminacion de 2 cifras).
const redoblonaTable = [
  { play: 1,    r1_5: 1280,    r1_10: 640,    r1_20: 336.84,  r5_5: 256,   r5_10: 128,   r5_20: 64,   r10_10: 64,  r10_20: 32,  r20_20: 16 },
  { play: 2,    r1_5: 2560,    r1_10: 1280,   r1_20: 673.68,  r5_5: 512,   r5_10: 256,   r5_20: 128,  r10_10: 128, r10_20: 64,  r20_20: 32 },
  { play: 2.5,  r1_5: 3200,    r1_10: 1600.5, r1_20: 842.10,  r5_5: 640,   r5_10: 320,   r5_20: 160,  r10_10: 160, r10_20: 80,  r20_20: 40 },
  { play: 5,    r1_5: 6400,    r1_10: 3200,   r1_20: 1684.20, r5_5: 1280,  r5_10: 640,   r5_20: 320,  r10_10: 320, r10_20: 160, r20_20: 80 },
  { play: 10,   r1_5: 12800,   r1_10: 6400,   r1_20: 3368.40, r5_5: 2560,  r5_10: 1280,  r5_20: 640,  r10_10: 640, r10_20: 320, r20_20: 160 },
  { play: 25,   r1_5: 32000,   r1_10: 16000,  r1_20: 8421.00, r5_5: 6400,  r5_10: 3200,  r5_20: 1600, r10_10: 1600,r10_20: 800, r20_20: 400 },
];

function fmt(n) {
  return Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function AciertosPage() {
  const { user } = useAuth();
  const roles = Array.isArray(user?.roles) ? user.roles : [];
  const isAdmin = roles.some((r) => ['admin', 'super_admin'].includes(r));

  const [aciertos, setAciertos] = useState({});
  const [loading, setLoading] = useState(true);
  const [showTable, setShowTable] = useState(false);
  const [openDraw, setOpenDraw] = useState(null);
  const [recalc, setRecalc] = useState({ open: false, running: false, processed: 0, total: 0, done: false, error: null });

  const today = new Date().toLocaleDateString('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
  });

  const loadAciertos = () => {
    api.get(`/aciertos?date=${today}`).then((r) => {
      setAciertos(r.data);
      const keys = Object.keys(r.data);
      if (keys.length > 0) setOpenDraw(keys[0]);
    });
  };

  useEffect(() => {
    // Solo los aciertos del dia de hoy (hora Argentina).
    loadAciertos();
    setLoading(false);
  }, []);

  const handleRecalc = async () => {
    setRecalc({ open: true, running: true, processed: 0, total: 0, done: false, error: null });
    const limit = 8;
    let offset = 0;
    try {
      // Procesamos en lotes para no superar el timeout del backend/proxy.
      while (true) {
        const { data } = await api.post('/scrutiny/recalc', { date: today, offset, limit });
        setRecalc((p) => ({
          ...p,
          processed: p.processed + data.processed,
          total: data.total,
        }));
        if (data.done) break;
        offset += limit;
      }
      loadAciertos();
      setRecalc((p) => ({ ...p, running: false, done: true }));
    } catch (e) {
      setRecalc((p) => ({ ...p, running: false, error: 'Ocurrió un error al recalcular. Reintentá.' }));
    }
  };

  if (loading) {
    return <div className="flex justify-center pt-20"><FiRefreshCw className="animate-spin text-indigo-400" size={28} /></div>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Aciertos</h2>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <button
              onClick={handleRecalc}
              disabled={recalc.running}
              className="flex items-center gap-1.5 text-sm text-indigo-400 hover:text-indigo-300 transition disabled:opacity-50"
              title="Volver a calcular los aciertos del día"
            >
              <FiRotateCcw size={14} className={recalc.running ? 'animate-spin' : ''} />
              Recalcular
            </button>
          )}
          <button
            onClick={() => setShowTable(!showTable)}
            className="text-sm text-indigo-400 hover:text-indigo-300 transition"
          >
            {showTable ? 'Ocultar' : 'Ver'} tabla de premios
          </button>
        </div>
      </div>

      {showTable && (
        <>
          <div className="bg-gray-800/40 backdrop-blur-sm border border-indigo-500/10 rounded-2xl overflow-x-auto">
            <div className="px-4 py-2 text-sm font-semibold text-white border-b border-gray-700/30">Loterías (terminación por cifras)</div>
            <table className="w-full text-xs">
              <thead className="bg-gray-700/50">
                <tr className="text-gray-300">
                  <th className="p-2 text-left">Ubic</th>
                  <th className="p-2 text-right">4 cifras</th>
                  <th className="p-2 text-right">3 cifras (Lu-Sa)</th>
                  <th className="p-2 text-right">2 cifras</th>
                </tr>
              </thead>
              <tbody>
                {prizeTable.map((row) => (
                  <tr key={row.ubicacion} className="border-t border-gray-700/30 text-gray-200">
                    <td className="p-2 font-bold">#{row.ubicacion}</td>
                    <td className="p-2 text-right">${row.cuatro_cifras.toLocaleString('es-AR')}</td>
                    <td className="p-2 text-right">${row.tres_cifras.toLocaleString('es-AR')}</td>
                    <td className="p-2 text-right">${row.dos_cifras.toLocaleString('es-AR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-gray-800/40 backdrop-blur-sm border border-indigo-500/10 rounded-2xl overflow-x-auto">
            <div className="px-4 py-2 text-sm font-semibold text-white border-b border-gray-700/30">Redoblona (por terminación de 2 cifras)</div>
            <table className="w-full text-xs">
              <thead className="bg-gray-700/50">
                <tr className="text-gray-300">
                  <th className="p-2 text-left">Juega $</th>
                  <th className="p-2 text-right">Al 1° todo a los 5</th>
                  <th className="p-2 text-right">Al 1° todo a los 10</th>
                  <th className="p-2 text-right">Al 1° todo a los 20</th>
                </tr>
              </thead>
              <tbody>
                {redoblonaTable.map((r) => (
                  <tr key={`a1-${r.play}`} className="border-t border-gray-700/30 text-gray-200">
                    <td className="p-2 font-bold">${Number(r.play).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="p-2 text-right">${Number(r.r1_5).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="p-2 text-right">${Number(r.r1_10).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="p-2 text-right">${Number(r.r1_20).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
              <thead className="bg-gray-700/50">
                <tr className="text-gray-300">
                  <th className="p-2 text-left">Juega $</th>
                  <th className="p-2 text-right">A los 5 todo a los 5</th>
                  <th className="p-2 text-right">A los 5 todo a los 10</th>
                  <th className="p-2 text-right">A los 5 todo a los 20</th>
                </tr>
              </thead>
              <tbody>
                {redoblonaTable.map((r) => (
                  <tr key={`a5-${r.play}`} className="border-t border-gray-700/30 text-gray-200">
                    <td className="p-2 font-bold">${Number(r.play).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="p-2 text-right">${Number(r.r5_5).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="p-2 text-right">${Number(r.r5_10).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="p-2 text-right">${Number(r.r5_20).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
              <thead className="bg-gray-700/50">
                <tr className="text-gray-300">
                  <th className="p-2 text-left">Juega $</th>
                  <th className="p-2 text-right">A los 10 todo a los 10</th>
                  <th className="p-2 text-right">A los 10 todo a los 20</th>
                  <th className="p-2 text-right">A los 20 todo a los 20</th>
                </tr>
              </thead>
              <tbody>
                {redoblonaTable.map((r) => (
                  <tr key={`a10-${r.play}`} className="border-t border-gray-700/30 text-gray-200">
                    <td className="p-2 font-bold">${Number(r.play).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="p-2 text-right">${Number(r.r10_10).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="p-2 text-right">${Number(r.r10_20).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="p-2 text-right">${Number(r.r20_20).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-gray-800/40 backdrop-blur-sm border border-indigo-500/10 rounded-2xl overflow-x-auto">
            <div className="px-4 py-2 text-sm font-semibold text-white border-b border-gray-700/30">Apuestas a 1 cifra (solo puestos 1 al 10)</div>
            <table className="w-full text-xs">
              <thead className="bg-gray-700/50">
                <tr className="text-gray-300">
                  <th className="p-2 text-left">Rango elegido</th>
                  <th className="p-2 text-right">Premio unitario</th>
                  <th className="p-2 text-right">Ej. $100 acertando 1 vez</th>
                </tr>
              </thead>
              <tbody>
                {singleDigitPayout.map((r) => (
                  <tr key={r.range} className="border-t border-gray-700/30 text-gray-200">
                    <td className="p-2">{r.range}</td>
                    <td className="p-2 text-right">{r.mult.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 3 })} ×</td>
                    <td className="p-2 text-right">${Number(100 * r.mult).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {Object.keys(aciertos).length === 0 ? (
        <div className="bg-gray-800/30 rounded-2xl p-12 text-center text-gray-400">
          No hay aciertos registrados
        </div>
      ) : (
        Object.entries(aciertos).map(([drawName, results]) => (
          <div key={drawName} className="bg-gray-800/40 backdrop-blur-sm border border-indigo-500/10 rounded-2xl overflow-hidden">
            <button
              onClick={() => setOpenDraw(openDraw === drawName ? null : drawName)}
              className="w-full flex items-center justify-between p-4 text-white font-semibold hover:bg-gray-700/20 transition"
            >
              <span>{drawName} <span className="text-sm text-gray-400 font-normal">({results.length} aciertos)</span></span>
              {openDraw === drawName ? <FiChevronUp size={18} className="text-gray-400" /> : <FiChevronDown size={18} className="text-gray-400" />}
            </button>
            {openDraw === drawName && (
              <div className="p-4 pt-0 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-700/30">
                    <tr className="text-gray-400">
                      <th className="p-2 text-left">Turno</th>
                      <th className="p-2 text-left">Loteria</th>
                      <th className="p-2 text-left">Pasador</th>
                      <th className="p-2 text-left">Numero</th>
                      <th className="p-2 text-center">Pos</th>
                      <th className="p-2 text-right">Apuesta</th>
                      <th className="p-2 text-right">Premio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r) => (
                      <tr key={r.id} className="border-t border-gray-700/30 text-gray-200">
                        <td className="p-2 text-xs text-indigo-300 whitespace-nowrap">{r.extract?.draw?.name || '-'}</td>
                        <td className="p-2 text-xs">{r.extract?.lottery?.initials || '-'}</td>
                        <td className="p-2 text-xs">{r.bet?.user?.name || '-'}</td>
                        <td className="p-2 font-mono font-bold text-white">
                          {r.bet_item_id
                            ? r.bet_item?.number
                            : r.redoblona_id
                              ? `${String(r.redoblona?.first_number).padStart(2, '0')}-${String(r.redoblona?.second_number).padStart(2, '0')}`
                              : '-'}
                        </td>
                        <td className="p-2 text-center text-xs text-gray-400">
                          {r.position
                            ? `#${r.position}`
                            : r.redoblona_id
                              ? `${String(r.redoblona?.first_range).padStart(2, '0')} y ${String(r.redoblona?.second_range).padStart(2, '0')}`
                              : '-'}
                        </td>
                        <td className="p-2 text-right">${fmt(r.bet?.total || 0)}</td>
                        <td className="p-2 text-right text-green-400 font-bold">${fmt(r.prize_amount)}</td>

                      </tr>
                    ))}
                  </tbody>
                   <tfoot>
                    <tr className="border-t border-indigo-500/30 bg-indigo-900/20">
                      <td colSpan={6} className="p-2 text-right text-white font-bold text-sm">TOTAL PREMIOS</td>
                      <td className="p-2 text-right text-green-400 font-bold text-sm">
                        ${fmt(results.reduce((sum, r) => sum + Number(r.prize_amount), 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )
      )
    )}
      {recalc.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-gray-800 border border-indigo-500/20 rounded-2xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center gap-2">
              <FiRotateCcw size={18} className={recalc.running ? 'animate-spin text-indigo-400' : 'text-indigo-400'} />
              <h3 className="text-lg font-bold text-white">Recalculando aciertos</h3>
            </div>

            {!recalc.error ? (
              <>
                <p className="text-sm text-gray-400">
                  {recalc.running
                    ? 'Procesando extractos del día…'
                    : recalc.done
                      ? 'Cálculo finalizado.'
                      : 'Listo para recalcular.'}
                </p>
                <div className="w-full bg-gray-700 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-indigo-500 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${recalc.total ? Math.round((recalc.processed / recalc.total) * 100) : 0}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 text-center">
                  {recalc.processed} / {recalc.total} extractos procesados
                </p>
              </>
            ) : (
              <p className="text-sm text-red-400">{recalc.error}</p>
            )}

            {!recalc.running && (
              <button
                onClick={() => setRecalc({ open: false, running: false, processed: 0, total: 0, done: false, error: null })}
                className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition"
              >
                Cerrar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
