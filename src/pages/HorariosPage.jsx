import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { FiClock, FiChevronDown, FiChevronUp, FiRefreshCw, FiAlertTriangle } from 'react-icons/fi';

const LOTTERY_ORDER = [
  'NAC', 'PBA', 'SF', 'CBA', 'CBAT', 'ER', 'ERT', 'MZA', 'CTES', 'CH', 'CAT', 'FSA', 'FSAQ',
  'JUJ', 'LR', 'MIS', 'NQN', 'RN', 'SAL', 'SALR', 'SL', 'SC', 'SGO', 'TUC',
  'CT', 'SJ', 'URU', 'PAR',
];

function lotteryRank(initials) {
  const i = LOTTERY_ORDER.indexOf(initials);
  return i === -1 ? 999 : i;
}

const DRAW_ORDER = ['La Previa', 'Primera', 'Matutina', 'Vespertina', 'Noctura'];

export default function HorariosPage() {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  const flash = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/schedules/status');
      setSections(data.sections || []);
    } catch {
      flash('Error al cargar los horarios');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const refresh = async () => {
    setBusy(true);
    try {
      const { data } = await api.post('/schedules/scrape');
      flash(data.message + (data.defects?.length ? ` · defectos: ${data.defects.map((d) => d.initials).join(', ')}` : ''));
      await load();
    } catch {
      flash('Error al actualizar los horarios');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center pt-20"><FiClock className="animate-spin text-indigo-400" size={28} /></div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {toast && (
        <div className="bg-indigo-500/15 border border-indigo-500/30 text-indigo-200 px-4 py-2 rounded-lg text-sm">
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Horarios por lotería</h2>
          <p className="text-sm text-gray-400">Horario de sorteo y cierre de cada turno. Las casillas en rojo marcan un “defect” (la fuente no tiene horario o no matcheó).</p>
        </div>
        <button
          onClick={refresh}
          disabled={busy}
          className="flex items-center gap-1.5 text-sm bg-indigo-600/40 hover:bg-indigo-600/60 text-indigo-200 px-3 py-1.5 rounded-lg transition disabled:opacity-50"
        >
          {busy ? <FiRefreshCw size={14} className="animate-spin" /> : <FiClock size={14} />}
          Actualizar horarios
        </button>
      </div>

      <div className="space-y-6">
        {sections.map((section) => {
          const sorted = [...section.lotteries].sort(
            (a, b) => lotteryRank(a.initials) - lotteryRank(b.initials)
          );
          return (
            <div key={section.scope} className="bg-gray-800/40 backdrop-blur-sm border border-indigo-500/10 rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-indigo-500/20 flex items-center gap-2">
                <span className="text-sm font-semibold text-white uppercase tracking-wide">{section.label}</span>
                <span className="text-[10px] text-indigo-300 bg-indigo-500/15 px-1.5 py-0.5 rounded-full">
                  {section.scope === 'sunday' ? 'Solo domingo' : 'Lun–Sáb'}
                </span>
              </div>
              <div className="grid grid-cols-[80px_1fr] gap-2 px-5 py-3 border-b border-gray-700/30 text-xs text-gray-400 uppercase">
                <span>Lotería</span>
                <span>Turnos</span>
              </div>
              <div className="divide-y divide-gray-700/20">
                {sorted.map((lot) => (
                  <div key={lot.lottery_id} className="px-5 py-3">
                    <div className="flex items-start gap-3">
                      <div className="flex items-center gap-2 w-[80px] shrink-0">
                        <span className="font-mono font-bold text-indigo-300">{lot.initials}</span>
                        {lot.defect && (
                          <span className="flex items-center gap-1 text-[10px] text-red-300 bg-red-500/15 px-1.5 py-0.5 rounded-full" title="Hay turnos con defect">
                            <FiAlertTriangle size={11} /> defect
                          </span>
                        )}
                      </div>
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {lot.schedules
                          .slice()
                          .sort((a, b) => DRAW_ORDER.indexOf(a.draw) - DRAW_ORDER.indexOf(b.draw))
                          .map((s, i) => {
                            const isDefect = !!s.defect || !s.draw_time;
                            return (
                            <div
                              key={i}
                              className={
                                'rounded-lg px-3 py-2 border text-sm ' +
                                (isDefect
                                  ? 'border-red-500/40 bg-red-500/10'
                                  : 'border-gray-700/30 bg-gray-900/30')
                              }
                            >
                              <div className="flex items-center justify-between">
                                <span className={isDefect ? 'text-red-300 font-semibold' : 'text-gray-200'}>{s.draw}</span>
                                {isDefect && <FiAlertTriangle size={13} className="text-red-400" />}
                              </div>
                              <div className="text-xs mt-1">
                                {isDefect ? (
                                  <span className="text-red-300">{s.defect_note || 'Sin horario'}</span>
                                ) : (
                                  <span className="text-gray-400">
                                    Sorteo <span className="text-gray-200 font-medium">{s.draw_time}</span> · Cierre{' '}
                                    <span className="text-yellow-300 font-medium">{s.closing_time}</span>
                                  </span>
                                )}
                              </div>
                            </div>
                            );
                          })}
                        {lot.schedules.length === 0 && (
                          <span className="text-xs text-red-300 bg-red-500/10 border border-red-500/40 rounded-lg px-3 py-2">
                            <FiAlertTriangle size={12} className="inline mr-1" /> Sin horarios en la fuente
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-500 flex items-center gap-1">
        <FiAlertTriangle size={12} className="text-red-400" /> Marca roja “defect”: la fuente no publica el horario de ese turno o no matcheó con nuestros turnos.
      </p>
    </div>
  );
}
