import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useBet } from '../context/BetContext';
import { useAuth } from '../context/AuthContext';
import { FiTrendingUp, FiDollarSign, FiCheckCircle, FiFileText, FiRefreshCw, FiEye, FiTrash2, FiX, FiLock, FiChevronDown, FiChevronRight } from 'react-icons/fi';

const fmt = (n) => Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function DashboardPage() {
  const { stats, bets, draws, filterDate, filterDrawIds, viewBet, viewBetEntries, openViewBet, closeViewBet, fetchBets, fetchStats, fetchDraws, copyBet, clearDateFilter, setFilterDate, setFilterDrawIds, page, setPage, pageSize, setPageSize, totalBets } = useBet();
  const navigate = useNavigate();
  const [deleteEntry, setDeleteEntry] = useState(null);
  const [globalFilter, setGlobalFilter] = useState('');
  const [statsOpen, setStatsOpen] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.roles?.includes('admin') || currentUser?.roles?.includes('super_admin');

  const expandBetsByDraw = useCallback(() => {
    const seqCounters = {};
    return bets.flatMap((bet) => {
      const drawList = (bet.draws || []).length > 0 ? bet.draws : (bet.draw ? [bet.draw] : []);
      const hasItems = (bet.items || []).length > 0;
      const hasRedoblonas = (bet.redoblonas || []).length > 0;
      const itemsBase = (bet.items || []).reduce((acc, i) => acc + Number(i.amount || 0), 0);
      const redBase = (bet.redoblonas || []).reduce((acc, r) => acc + Number(r.amount || 0), 0);
      if (!seqCounters[bet.sequence]) seqCounters[bet.sequence] = 0;
      return drawList.flatMap((draw) => {
        const lotteryCount = (bet.draw_lotteries || []).filter((dl) => dl.draw_id === draw.id).length || 1;
        const rows = [];
        if (hasItems) {
          seqCounters[bet.sequence]++;
          const isDeleted = bet.deleted_at || (bet.items && bet.items.every(i => i.deleted_at));
          rows.push({ ...bet, draw, displaySequence: `${bet.sequence}-${seqCounters[bet.sequence]}`, section: 'items', sectionTotal: itemsBase * lotteryCount, isDeleted });
        }
        if (hasRedoblonas) {
          seqCounters[bet.sequence]++;
          const isDeleted = bet.deleted_at || (bet.redoblonas && bet.redoblonas.every(i => i.deleted_at));
          rows.push({ ...bet, draw, displaySequence: `${bet.sequence}-${seqCounters[bet.sequence]}`, section: 'redoblonas', sectionTotal: redBase * lotteryCount, isDeleted });
        }
        return rows;
      });
    });
  }, [bets]);

  const expandedBets = expandBetsByDraw();
  
  const displayedBets = expandedBets.filter(entry => {
    if (showDeleted && !entry.isDeleted) return false;
    if (!globalFilter) return true;
    const search = globalFilter.toLowerCase();
    const searchableString = `
      ${entry.displaySequence} 
      ${entry.user?.name || ''} 
      ${entry.draw?.name || ''} 
      ${entry.created_at ? entry.created_at.split(' ')[1]?.slice(0, 5) : ''} 
      ${fmt(entry.sectionTotal)}
      ${entry.section}
    `.toLowerCase();
    return searchableString.includes(search);
  });

  const handleDeleteEntry = async () => {
    if (!deleteEntry) return;
    try {
      await api.delete(`/bets/${deleteEntry.id}`, { params: { section: deleteEntry.section } });
      setDeleteEntry(null);
      fetchBets({ date: filterDate, draw_ids: filterDrawIds });
    } catch (e) {
      console.error('Error deleting bet:', e);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchDraws();
    fetchBets({ date: filterDate, draw_ids: filterDrawIds });
  }, [fetchStats, fetchDraws, fetchBets, filterDate, filterDrawIds, page, pageSize]);

  if (!stats) {
    return <div className="flex justify-center pt-20"><FiRefreshCw className="animate-spin text-indigo-400" size={28} /></div>;
  }

  const cards = [
    { label: 'Boletas de Hoy', value: Number(stats.bets_count).toLocaleString('es-AR'), icon: FiFileText, color: 'from-blue-600 to-cyan-600' },
    { label: 'Total $ Recaudado', value: `$${fmt(stats.total_bets)}`, icon: FiDollarSign, color: 'from-green-600 to-emerald-600' },
    { label: 'Aciertos', value: Number(stats.aciertos_count).toLocaleString('es-AR'), icon: FiCheckCircle, color: 'from-purple-600 to-pink-600' },
    { label: 'Extractos', value: Number(stats.extracts_count).toLocaleString('es-AR'), icon: FiTrendingUp, color: 'from-orange-600 to-red-600' },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="bg-gray-800/40 backdrop-blur-sm border border-indigo-500/10 rounded-xl overflow-hidden">
        <button
          onClick={() => setStatsOpen((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-700/20 transition"
        >
          <span className="text-sm font-medium text-gray-300">Resumen del día</span>
          {statsOpen ? <FiChevronDown size={16} className="text-gray-400" /> : <FiChevronRight size={16} className="text-gray-400" />}
        </button>
        {statsOpen && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 pt-0">
            {cards.map((card) => (
              <div key={card.label} className="bg-gray-800/40 backdrop-blur-sm border border-indigo-500/10 rounded-xl p-4 text-center">
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${card.color} flex items-center justify-center mx-auto mb-3`}>
                  <card.icon className="text-white" size={18} />
                </div>
                <p className="text-2xl font-bold text-white">{card.value}</p>
                <p className="text-xs text-gray-400 mt-1">{card.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>


      <div className="bg-gray-800/40 backdrop-blur-sm border border-indigo-500/10 rounded-2xl p-4">
        <h3 className="text-white font-semibold mb-3">Ultimas Jugadas</h3>

        <div className="flex flex-col sm:flex-row justify-between gap-2 mb-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 w-full sm:w-40"
            />
            <button
              onClick={clearDateFilter}
              className={`text-xs px-3 py-2 rounded-lg border transition whitespace-nowrap ${
                filterDate === ''
                  ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-200'
                  : 'bg-gray-700/30 border-gray-600/50 text-gray-400 hover:border-gray-500'
              }`}
            >
              Todas
            </button>
            <div className="flex flex-wrap gap-2">
              {draws.map((d) => {
                const selected = filterDrawIds.includes(d.id);
                return (
                  <label
                    key={d.id}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs cursor-pointer transition ${
                      selected
                        ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-200'
                        : 'bg-gray-700/30 border-gray-600/50 text-gray-400 hover:border-gray-500'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
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
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              placeholder="🔍 Buscar..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 w-full sm:w-48"
            />
            <label className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs cursor-pointer transition bg-gray-700/30 border-gray-600/50 text-gray-400 hover:border-gray-500 whitespace-nowrap">
              <input
                type="checkbox"
                checked={showDeleted}
                onChange={(e) => setShowDeleted(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-gray-600 bg-gray-700 text-red-600 focus:ring-red-500"
              />
              Solo eliminadas
            </label>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              className="bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
            >
              {[5, 10, 20, 30, 50, 100].map((n) => (
                <option key={n} value={n}>{n} / pág</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700/50">
                <th className="text-left p-2">Secuencia</th>
                <th className="text-left p-2">Pasador</th>
                <th className="text-left p-2">Sorteo</th>
                <th className="text-left p-2">Hora</th>
                <th className="text-right p-2">Total</th>
                <th className="text-center p-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {displayedBets.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-gray-400">No hay jugadas</td></tr>
              ) : displayedBets.map((entry, index) => (
                <tr key={`${entry.id}-${entry.draw?.id || 0}-${entry.section || index}`} className={`border-b border-gray-700/30 hover:bg-gray-700/20 ${entry.isDeleted ? 'bg-red-900/40 opacity-75' : ''}`}>
                  <td className={`p-2 font-mono text-xs cursor-pointer hover:text-indigo-300 ${entry.isDeleted ? 'text-red-300 line-through' : 'text-white'}`}
                      onClick={() => { 
                          try {
                              const items = entry.section === 'items' ? (entry.items || []) : [];
                              const redoblonas = entry.section === 'redoblonas' ? (entry.redoblonas || []) : [];
                              copyBet(items, redoblonas); 
                              navigate('/'); 
                          } catch (e) {
                              console.error('Error copiando apuesta:', e);
                              navigate('/');
                          }
                      }} 
                      title="Copiar jugada">
                    {entry.displaySequence}
                  </td>
                  <td className="p-2 text-gray-300">{entry.user?.name}</td>
                  <td className="p-2 text-gray-300">{entry.draw?.name || '-'}</td>
                  <td className="p-2 text-gray-400 font-mono text-xs">{entry.created_at ? entry.created_at.split(' ')[1]?.slice(0, 5) : '-'}</td>
                  <td className="p-2 text-right text-white">${fmt(entry.sectionTotal)}</td>
                  <td className="p-2 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => openViewBet(entry)} className="text-indigo-400 hover:text-indigo-300 transition p-1" title="Ver boleta">
                        <FiEye size={16} />
                      </button>
                      {entry.isDeleted ? (
                        <span className="text-red-400 p-1" title="Boleta eliminada">
                          <FiX size={16} />
                        </span>
                      ) : (!isAdmin && entry.is_turn_closed) ? (
                        <span className="text-gray-500 p-1" title="Turno cerrado - no se puede eliminar">
                          <FiLock size={16} />
                        </span>
                      ) : (
                        <button onClick={() => setDeleteEntry(entry)} className="text-red-400 hover:text-red-300 transition p-1" title="Eliminar">
                          <FiTrash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {bets.length > 0 && (
          <div className="flex items-center justify-between mt-4 px-4 pb-4">
            <div className="text-sm text-gray-400">
              Mostrando {((page - 1) * pageSize) + 1} a {Math.min(page * pageSize, totalBets)} de {totalBets} jugadas
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition"
              >
                Anterior
              </button>
              <span className="px-3 text-sm text-gray-300">Pagina {page} de {Math.ceil(totalBets / pageSize)}</span>
              <button
                onClick={() => setPage(p => Math.min(Math.ceil(totalBets / pageSize), p + 1))}
                disabled={page === Math.ceil(totalBets / pageSize)}
                className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {deleteEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setDeleteEntry(null)}>
          <div className="bg-gray-800 border border-red-500/30 rounded-2xl w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-700/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center">
                  <FiTrash2 className="text-red-400" size={18} />
                </div>
                <div>
                  <h3 className="text-white font-bold text-sm">Eliminar Jugada</h3>
                  <p className="text-gray-400 text-xs font-mono">{deleteEntry.displaySequence}</p>
                </div>
              </div>
              <button onClick={() => setDeleteEntry(null)} className="text-gray-400 hover:text-white transition">
                <FiX size={18} />
              </button>
            </div>
            <div className="p-4 space-y-2">
              <div className="bg-gray-700/30 border border-gray-600/50 rounded-xl p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-white font-mono text-xs">{deleteEntry.displaySequence}</span>
                  <span className="text-white font-bold text-sm">${fmt(deleteEntry.subtotal || deleteEntry.total)}</span>
                </div>
                <p className="text-indigo-300 text-xs">{deleteEntry.draw?.name || '-'}</p>
                <div className="mt-1 space-y-0.5">
                  {deleteEntry.section === 'items' && (deleteEntry.items || []).map((item, i) => (
                    <p key={i} className="text-gray-400 text-xs">
                      {item.number} - #{item.type === 'primera' ? '1' : (item.type?.replace('a_los_', '') || '')} - ${fmt(item.amount)}
                    </p>
                  ))}
                  {deleteEntry.section === 'redoblonas' && (deleteEntry.redoblonas || []).map((r, i) => (
                    <p key={`r${i}`} className="text-gray-400 text-xs">
                      {String(r.first_number).padStart(2, '0')}-{String(r.second_number).padStart(2, '0')} - ${fmt(r.amount)}
                    </p>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-gray-700/50 flex gap-3">
              <button onClick={() => setDeleteEntry(null)} className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-200 font-medium py-2.5 rounded-lg text-sm transition">
                Cancelar
              </button>
              <button
                onClick={handleDeleteEntry}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white font-medium py-2.5 rounded-lg text-sm transition shadow-lg shadow-red-500/20"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {viewBet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={closeViewBet}>
          <div className="bg-gray-800 border border-indigo-500/20 rounded-2xl w-full max-w-sm shadow-2xl max-h-[95vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-700/50 flex items-center justify-between">
              <h3 className="text-white font-bold">Boleta</h3>
              <button onClick={closeViewBet} className="text-gray-400 hover:text-white transition">
                <FiX size={18} />
              </button>
            </div>
            <div className="p-4 font-mono text-xs space-y-3 text-gray-200">
              <p><span className="text-gray-400">Secuencia:</span> <span className="text-white">{viewBet.displaySequence || viewBet.sequence}</span></p>
              <p><span className="text-gray-400">Pasador:</span> <span className="text-white">{viewBet.user?.name}</span></p>
              <p><span className="text-gray-400">Fecha:</span> <span className="text-white">{viewBet.draw_date} {viewBet.created_at ? ` ${viewBet.created_at.split(' ')[1]}` : ''}</span></p>
              {(() => {
                let seqCounter = 0;
                return viewBetEntries.map((entry) => {
                  const drawName = entry.draw?.name || '-';
                  const lotInitials = (entry.draw_lotteries || []).map((dl) => dl.lottery_initials).filter(Boolean);
                  const items = entry.items || [];
                  const redoblonas = entry.redoblonas || [];
                  const n = (entry.draw_lotteries || []).length || 1;
                  const hasItems = items.length > 0 && (!viewBet.section || viewBet.section === 'items');
                  const hasRedoblonas = redoblonas.length > 0 && (!viewBet.section || viewBet.section === 'redoblonas');
                  const itemsSeq = hasItems ? viewBet.displaySequence : null;
                  const redSeq = hasRedoblonas ? viewBet.displaySequence : null;

                  return (
                    <div key={`${entry.bet_id || entry.id}-${entry.draw?.id || 0}`}>
                      <p className="text-center text-white font-bold text-sm">{drawName}</p>
                      {lotInitials.length > 0 && (
                        <p className="text-center text-indigo-300 font-bold mb-2">{lotInitials.join(' . ')}</p>
                      )}
                      {hasItems && (
                        <>
                          <table className="w-full">
                            <thead>
                              <tr className="border-b border-dashed border-gray-600/50 text-gray-400">
                                <th className="text-left py-1">NUMERO</th>
                                <th className="text-center py-1">TIPO</th>
                                <th className="text-right py-1">IMPORTE</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr><td colSpan="3" className="text-center text-indigo-300 font-bold py-1">Jugada Simple Secuencia: {itemsSeq}</td></tr>
                              {items.map((play, i) => (
                                <tr key={i}>
                                  <td className="py-1 text-white font-bold">{play.number}</td>
                                  <td className="py-1 text-center text-gray-400">#{play.type === 'primera' ? '1' : (play.type?.replace('a_los_', '') || '')}</td>
                                  <td className="py-1 text-right text-white">${fmt(play.amount)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <div className="flex justify-between text-gray-300 pt-1 border-t border-dashed border-gray-600/50">
                            <span>Jugada Simple x {n} Lot</span>
                            <span>${fmt((entry.items || []).reduce((acc, i) => acc + Number(i.amount || 0), 0) * n)}</span>
                          </div>
                        </>
                      )}
                      {hasRedoblonas && (
                        <>
                          <table className="w-full mt-2">
                            <thead>
                              <tr className="border-b border-dashed border-gray-600/50 text-gray-400">
                                <th className="text-left py-1">NUMERO</th>
                                <th className="text-center py-1">RANGOS</th>
                                <th className="text-right py-1">IMPORTE</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr><td colSpan="3" className="text-center text-indigo-300 font-bold py-1">REDOBLONA Secuencia: {redSeq}</td></tr>
                              {redoblonas.map((r, i) => (
                                <tr key={i}>
                                  <td className="py-1 text-white font-bold">{String(r.first_number).padStart(2, '0')}-{String(r.second_number).padStart(2, '0')}</td>
                                  <td className="py-1 text-center text-gray-400">{String(r.first_range).padStart(2, '0')} y {String(r.second_range).padStart(2, '0')}</td>
                                  <td className="py-1 text-right text-white">${fmt(r.amount)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <div className="flex justify-between text-gray-300 pt-1 border-t border-dashed border-gray-600/50">
                            <span>Redoblona x {n} Lot</span>
                            <span>${fmt((entry.redoblonas || []).reduce((acc, r) => acc + Number(r.amount || 0), 0) * n)}</span>
                          </div>
                        </>
                      )}
                    </div>
                  );
                });
              })()}
              <div className="border-t border-dashed border-indigo-500/40 pt-2 space-y-1">
                <div className="flex justify-between text-white font-bold text-base pt-1">
                  <span>TOTAL</span>
                  <span className="text-indigo-300">${fmt(viewBet.sectionTotal || viewBet.total)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
