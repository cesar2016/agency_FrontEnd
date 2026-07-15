import { useState, useEffect } from 'react';
import api from '../services/api';
import { FiRefreshCw, FiChevronDown, FiChevronUp } from 'react-icons/fi';

const prizeTable = [
  { ubicacion: 1,  cuatro_cifras_todos_los_dias: 175000, tres_cifras_lunes_a_viernes: 30000, tres_cifras_sabados: 35000, dos_cifras_todos_los_dias: 3500 },
  { ubicacion: 2,  cuatro_cifras_todos_los_dias: 87500,  tres_cifras_lunes_a_viernes: 15000, tres_cifras_sabados: 17500, dos_cifras_todos_los_dias: 1750 },
  { ubicacion: 3,  cuatro_cifras_todos_los_dias: 58300,  tres_cifras_lunes_a_viernes: 10000, tres_cifras_sabados: 11650, dos_cifras_todos_los_dias: 1165 },
  { ubicacion: 4,  cuatro_cifras_todos_los_dias: 43750,  tres_cifras_lunes_a_viernes: 7500,  tres_cifras_sabados: 8750,  dos_cifras_todos_los_dias: 875 },
  { ubicacion: 5,  cuatro_cifras_todos_los_dias: 35000,  tres_cifras_lunes_a_viernes: 6000,  tres_cifras_sabados: 7000,  dos_cifras_todos_los_dias: 700 },
  { ubicacion: 10, cuatro_cifras_todos_los_dias: 17500,  tres_cifras_lunes_a_viernes: 3000,  tres_cifras_sabados: 3500,  dos_cifras_todos_los_dias: 350 },
  { ubicacion: 20, cuatro_cifras_todos_los_dias: 8750,   tres_cifras_lunes_a_viernes: 1500,  tres_cifras_sabados: 1750,  dos_cifras_todos_los_dias: 175 },
];

function fmt(n) {
  return Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function AciertosPage() {
  const [aciertos, setAciertos] = useState({});
  const [loading, setLoading] = useState(true);
  const [showTable, setShowTable] = useState(false);
  const [openDraw, setOpenDraw] = useState(null);

  useEffect(() => {
    api.get('/aciertos').then((r) => {
      setAciertos(r.data);
      const keys = Object.keys(r.data);
      if (keys.length > 0) setOpenDraw(keys[0]);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex justify-center pt-20"><FiRefreshCw className="animate-spin text-indigo-400" size={28} /></div>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Aciertos</h2>
        <button
          onClick={() => setShowTable(!showTable)}
          className="text-sm text-indigo-400 hover:text-indigo-300 transition"
        >
          {showTable ? 'Ocultar' : 'Ver'} tabla de premios
        </button>
      </div>

      {showTable && (
        <div className="bg-gray-800/40 backdrop-blur-sm border border-indigo-500/10 rounded-2xl overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-700/50">
              <tr className="text-gray-300">
                <th className="p-2 text-left">Ubic</th>
                <th className="p-2 text-right">4 cifras</th>
                <th className="p-2 text-right">3 cifras (Lu-Vi)</th>
                <th className="p-2 text-right">3 cifras (Sab)</th>
                <th className="p-2 text-right">2 cifras</th>
              </tr>
            </thead>
            <tbody>
              {prizeTable.map((row) => (
                <tr key={row.ubicacion} className="border-t border-gray-700/30 text-gray-200">
                  <td className="p-2 font-bold">#{row.ubicacion}</td>
                  <td className="p-2 text-right">${row.cuatro_cifras_todos_los_dias.toLocaleString('es-AR')}</td>
                  <td className="p-2 text-right">${row.tres_cifras_lunes_a_viernes.toLocaleString('es-AR')}</td>
                  <td className="p-2 text-right">${row.tres_cifras_sabados.toLocaleString('es-AR')}</td>
                  <td className="p-2 text-right">${row.dos_cifras_todos_los_dias.toLocaleString('es-AR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
                        <td className="p-2 text-xs">{r.extract?.lottery?.initials || '-'}</td>
                        <td className="p-2 text-xs">{r.bet?.user?.name || '-'}</td>
                        <td className="p-2 font-mono font-bold text-white">
                          {r.bet_item_id
                            ? r.bet_item?.number
                            : r.redoblona_id
                              ? `${r.redoblona?.first_number}/${r.redoblona?.second_number}`
                              : '-'}
                        </td>
                        <td className="p-2 text-center text-xs text-gray-400">
                          {r.position
                            ? `#${r.position}`
                            : r.redoblona_id
                              ? `R${r.redoblona?.first_range}/${r.redoblona?.second_range}`
                              : '-'}
                        </td>
                        <td className="p-2 text-right">${fmt(r.bet?.total || 0)}</td>
                        <td className="p-2 text-right text-green-400 font-bold">${fmt(r.prize_amount)}</td>

                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-indigo-500/30 bg-indigo-900/20">
                      <td colSpan={5} className="p-2 text-right text-white font-bold text-sm">TOTAL PREMIOS</td>
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
    </div>
  );
}
