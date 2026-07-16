import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBet } from '../context/BetContext';
import { FiPlus, FiCheck, FiX, FiArrowLeft, FiTrash2, FiChevronDown, FiChevronUp, FiEye } from 'react-icons/fi';
import api from '../services/api';

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

function fmt(n) {
  return Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PlaceBetPage() {
  const { selectedByDraw, selectedDraws, lotteries, draws, cart, addToCart, removeFromCart, clearCart, submitBet, totalMultiplier, lotteryCountForDraw } = useBet();
  const navigate = useNavigate();

  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!result && selectedDraws.length === 0) {
      navigate('/', { replace: true });
    }
  }, [result, selectedDraws, navigate]);

  const [number, setNumber] = useState('');
  const [position, setPosition] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');

  const [redFirst, setRedFirst] = useState('');
  const [redSecond, setRedSecond] = useState('');
  const [redFirstRange, setRedFirstRange] = useState(1);
  const [redSecondRange, setRedSecondRange] = useState(5);
  const [redAmount, setRedAmount] = useState('');

  const rangeOptions = { 1: [{ v: 5, l: 'A los 5' }, { v: 10, l: 'A los 10' }, { v: 20, l: 'A los 20' }], 5: [{ v: 5, l: 'A los 5' }, { v: 10, l: 'A los 10' }, { v: 20, l: 'A los 20' }], 10: [{ v: 10, l: 'A los 10' }, { v: 20, l: 'A los 20' }], 20: [{ v: 20, l: 'A los 20' }] };
  const rangeLabel = { 1: 'A la cabeza', 5: 'A los 5', 10: 'A los 10', 20: 'A los 20' };

  useEffect(() => {
    const opts = rangeOptions[redFirstRange];
    if (!opts.find((o) => o.v === redSecondRange)) {
      setRedSecondRange(opts[0].v);
    }
  }, [redFirstRange]);

  const [openSimple, setOpenSimple] = useState(true);
  const [openRedoblona, setOpenRedoblona] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const allSelectedLotteryIds = Array.from(new Set(Object.values(selectedByDraw).flat()));
  const drawNames = draws.filter((d) => selectedDraws.includes(d.id)).map((d) => d.name).join(' / ');
  const lotteryLabels = lotteries.filter((l) => allSelectedLotteryIds.includes(l.id)).map((l) => l.initials).join(', ');
  const subtotal = cart.reduce((acc, i) => acc + i.amount, 0);
  const total = subtotal * totalMultiplier;

  const closingTimeFor = (drawId, lotteryId) => {
    const l = lotteries.find((x) => x.id === lotteryId);
    const matching = (l?.schedules || []).filter((s) => s.draw_id === drawId);
    if (matching.length === 0) return null;
    const latest = matching.reduce((a, s) => (!a || s.draw_time > a.draw_time ? s : a));
    return latest?.closing_time || null;
  };

  const isClosedFor = (drawId, lotteryId) => {
    const ct = closingTimeFor(drawId, lotteryId);
    if (!ct) return false;
    const now = new Date();
    const [h, m] = ct.split(':').map(Number);
    const close = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
    return now > close;
  };

  const closedSelection = selectedDraws.find((drawId) =>
    (selectedByDraw[drawId] || []).some((lotId) => isClosedFor(drawId, lotId))
  );
  const hasClosedSelection = closedSelection !== undefined;

  const mapPositionToType = (pos) => {
    if (pos <= 1) return 'primera';
    if (pos <= 5) return 'a_los_5';
    if (pos <= 10) return 'a_los_10';
    return 'a_los_20';
  };

  const handleAddSimple = () => {
    if (!number || number.length < 1 || number.length > 4) {
      setError('El numero debe tener entre 1 y 4 digitos');
      return;
    }
    const pos = parseInt(position);
    if (!pos || pos < 1 || pos > 20) {
      setError('La posicion debe ser un numero del 1 al 20');
      return;
    }
    const val = parseFloat(amount.replace(/\./g, ''));
    if (!val || val <= 0) {
      setError('Ingrese un importe valido');
      return;
    }
    addToCart({ number, position: pos, type: mapPositionToType(pos), amount: val });
    setNumber('');
    setPosition('');
    setAmount('');
    setError('');
  };

  const handleAddRedoblona = () => {
    if (redFirst.length !== 2 || redSecond.length !== 2) {
      setError('Ambos numeros deben tener exactamente 2 digitos');
      return;
    }
    const val = parseFloat(redAmount.replace(/\./g, ''));
    if (!val || val <= 0) {
      setError('Ingrese un importe valido');
      return;
    }
    addToCart({
      first_number: redFirst,
      second_number: redSecond,
      first_range: redFirstRange,
      second_range: redSecondRange,
      amount: val,
      isRedoblona: true,
    });
    setRedFirst('');
    setRedSecond('');
    setRedAmount('');
    setError('');
  };

  const handleGenerate = async () => {
    if (hasClosedSelection) {
      setError('No se pueden registrar apuestas: el horario de cierre de uno o más sorteos ya pasó.');
      return;
    }
    setSubmitting(true);
    try {
      const data = await submitBet();
      setResult(data);
      setShowPreview(false);
    } catch (e) {
      const msg = e?.response?.data?.message;
      alert(msg || 'Error al generar la boleta');
    } finally {
      setSubmitting(false);
    }
  };

  const getTicketBlob = async (id) => {
    const { data } = await api.get(`/tickets/${id}/download`, { responseType: 'blob' });
    return data;
  };

  const downloadTicket = async (id) => {
    const blob = await getTicketBlob(id);
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  const shareTicket = async (id, sequence) => {
    try {
      const blob = await getTicketBlob(id);
      const file = new File([blob], `boleta-${sequence}.pdf`, { type: 'application/pdf' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Boleta Agencia' });
        return;
      }
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
    downloadTicket(id);
  };

  const handleAmountChange = (val, setter) => {
    const digits = val.replace(/\D/g, '');
    if (digits === '') { setter(''); return; }
    setter(digits);
  };

  const displayAmount = (v) => {
    if (!v) return '';
    const n = parseInt(v, 10);
    return n.toLocaleString('es-AR');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-2">
        <button onClick={() => navigate('/')} className="flex items-center gap-1 text-gray-400 hover:text-white transition text-sm shrink-0">
          <FiArrowLeft size={16} /> Volver
        </button>
        <div className="text-right min-w-0">
          <p className="text-white font-medium text-sm truncate">{drawNames}</p>
          <p className="text-indigo-300 text-xs truncate max-w-[180px] sm:max-w-none">{lotteryLabels}</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-2 rounded-lg">
          {error}
        </div>
      )}

      <Accordion title="Apuesta Simple" open={openSimple} onToggle={() => setOpenSimple(!openSimple)}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-gray-400 block mb-1 text-center">Numero</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={4}
              value={number}
              onChange={(e) => setNumber(e.target.value.replace(/\D/g, ''))}
              className="no-spinner w-full bg-gray-700/50 border border-gray-600 rounded-lg text-center font-bold text-xl text-white focus:outline-none focus:border-indigo-500"
              style={{ padding: '1.5rem 0.5rem' }}
              placeholder="47"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1 text-center">Posicion</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={2}
              value={position}
              onChange={(e) => setPosition(e.target.value.replace(/\D/g, ''))}
              className="no-spinner w-full bg-gray-700/50 border border-gray-600 rounded-lg text-center font-bold text-xl text-white focus:outline-none focus:border-indigo-500"
              style={{ padding: '1.5rem 0.5rem' }}
              placeholder="1-20"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1 text-center">Importe $</label>
            <input
              type="text"
              inputMode="numeric"
              value={displayAmount(amount)}
              onChange={(e) => handleAmountChange(e.target.value, setAmount)}
              className="no-spinner w-full bg-gray-700/50 border border-gray-600 rounded-lg text-center font-bold text-xl text-white focus:outline-none focus:border-indigo-500"
              style={{ padding: '1.5rem 0.5rem' }}
              placeholder="$"
            />
          </div>
        </div>
        <button
          onClick={handleAddSimple}
          className="mt-3 flex items-center gap-1 text-sm bg-indigo-600/40 hover:bg-indigo-600/60 text-indigo-200 px-4 py-2 rounded-lg transition"
        >
          <FiPlus size={14} /> Agregar y seguir apostando
        </button>
      </Accordion>

      <Accordion title="La Redoblona" open={openRedoblona} onToggle={() => setOpenRedoblona(!openRedoblona)}>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div>
            <label className="text-xs text-gray-400 block mb-1">1er Numero</label>
            <input
              type="text"
              maxLength={2}
              value={redFirst}
              onChange={(e) => setRedFirst(e.target.value.replace(/\D/g, ''))}
              className="no-spinner w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">2do Numero</label>
            <input
              type="text"
              maxLength={2}
              value={redSecond}
              onChange={(e) => setRedSecond(e.target.value.replace(/\D/g, ''))}
              className="no-spinner w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Rango 1</label>
            <select value={redFirstRange} onChange={(e) => setRedFirstRange(Number(e.target.value))}
              className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500">
              {[1, 5, 10, 20].map((r) => <option key={r} value={r}>{rangeLabel[r]}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Rango 2</label>
            <select value={redSecondRange} onChange={(e) => setRedSecondRange(Number(e.target.value))}
              className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500">
              {rangeOptions[redFirstRange].map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Importe ($)</label>
            <input
              type="text"
              inputMode="numeric"
              value={displayAmount(redAmount)}
              onChange={(e) => handleAmountChange(e.target.value, setRedAmount)}
              className="no-spinner w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 text-center font-bold"
            />
          </div>
        </div>
        <button onClick={handleAddRedoblona}
          className="mt-3 flex items-center gap-1 text-sm bg-purple-600/40 hover:bg-purple-600/60 text-purple-200 px-4 py-2 rounded-lg transition">
          <FiPlus size={14} /> Agregar Redoblona
        </button>
      </Accordion>

      {cart.length > 0 && (
        <div className="bg-gray-800/40 backdrop-blur-sm border border-indigo-500/10 rounded-2xl overflow-x-auto">
          <div className="p-3 border-b border-gray-700/50 flex items-center justify-between">
            <h3 className="text-white font-semibold text-sm">Jugadas ({cart.length})</h3>
            <span className="text-gray-300 font-bold">Sub total $ {fmt(subtotal)}</span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-700/30">
              <tr>
                <th className="text-left p-2 text-gray-400 font-medium">Numero</th>
                <th className="text-center p-2 text-gray-400 font-medium">Pos</th>
                <th className="text-right p-2 text-gray-400 font-medium">Importe</th>
                <th className="p-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {cart.map((item) => (
                <tr key={item.id} className="border-t border-gray-700/30">
                  <td className="p-2 text-white font-mono">
                    {item.isRedoblona ? `${item.first_number}/${item.second_number}` : item.number}
                  </td>
                  <td className="p-2 text-gray-300 text-center text-xs">
                    {item.isRedoblona ? `R${item.first_range}/${item.second_range}` : `#${item.position}`}
                  </td>
                  <td className="p-2 text-right text-white">$ {fmt(item.amount)}</td>
                  <td className="p-2 text-right">
                    <button onClick={() => removeFromCart(item.id)} className="text-red-400 hover:text-red-300">
                      <FiTrash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="p-3 border-t border-gray-700/50 space-y-1 text-sm">
            <div className="flex justify-between text-gray-300">
              <span>Sub total ({cart.length} jugadas)</span>
              <span>$ {fmt(subtotal)}</span>
            </div>
            {draws.filter((d) => selectedDraws.includes(d.id)).map((draw) => {
              const n = lotteryCountForDraw(draw.id);
              if (n === 0) return null;
              return (
                <div key={draw.id} className="flex justify-between text-gray-300">
                  <span>{draw.name} × {n} Lot</span>
                  <span>$ {fmt(subtotal * n)}</span>
                </div>
              );
            })}
            <div className="flex justify-between text-white font-bold text-base pt-1 border-t border-dashed border-gray-600/50">
              <span>TOTAL</span>
              <span className="text-indigo-300">$ {fmt(total)}</span>
            </div>
            <button
              onClick={() => setShowPreview(true)}
              className="mt-2 w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium py-2.5 rounded-lg text-sm transition shadow-lg shadow-indigo-500/20"
            >
              <FiEye size={16} /> Vista previa de Boleta
            </button>
          </div>
        </div>
      )}

      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-indigo-500/20 rounded-2xl w-full max-w-sm shadow-2xl overflow-y-auto max-h-[95vh]">
            <div className="p-4 bg-gray-800/80 text-center border-b border-dashed border-gray-600/50">
              <p className="text-xs text-gray-400 font-mono">{new Date().toLocaleString('es-AR')}</p>
              <p className="text-white font-bold font-mono text-xs mt-1">BOLETA</p>
            </div>
            <div className="p-4 font-mono text-xs space-y-3 text-gray-200">
              {draws.filter((d) => selectedDraws.includes(d.id)).map((draw) => {
                const lotIds = selectedByDraw[draw.id] || [];
                if (lotIds.length === 0) return null;
                const lotInitials = lotIds
                  .map((id) => lotteries.find((l) => l.id === id)?.initials)
                  .filter(Boolean);
                const n = lotIds.length;
                const drawSubtotal = subtotal * n;
                return (
                  <div key={draw.id}>
                    <p className="text-center text-white font-bold text-sm mb-1">{draw.name}</p>
                    <p className="text-center text-indigo-300 font-bold mb-2">{lotInitials.join(' · ')}</p>
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-dashed border-gray-600/50 text-gray-400">
                          <th className="text-left py-1">NUMERO</th>
                          <th className="text-center py-1">POS</th>
                          <th className="text-right py-1">IMPORTE</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cart.map((item) => (
                          <tr key={item.id}>
                            <td className="py-1 text-white font-bold">
                              {item.isRedoblona ? `${item.first_number}/${item.second_number}` : item.number}
                            </td>
                            <td className="py-1 text-center text-gray-400">
                              {item.isRedoblona ? `R${item.first_range}/${item.second_range}` : `#${item.position}`}
                            </td>
                            <td className="py-1 text-right text-white">${fmt(item.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="flex justify-between text-gray-300 pt-1 border-t border-dashed border-gray-600/50">
                      <span>Subtotal {draw.name} × {n} Lot</span>
                      <span>${fmt(drawSubtotal)}</span>
                    </div>
                  </div>
                );
              })}
              <div className="border-t border-dashed border-indigo-500/40 pt-2 space-y-1">
                <div className="flex justify-between text-gray-300 font-bold">
                  <span>Sub total</span>
                  <span>${fmt(subtotal)}</span>
                </div>
                {draws.filter((d) => selectedDraws.includes(d.id)).map((draw) => {
                  const n = lotteryCountForDraw(draw.id);
                  if (n === 0) return null;
                  return (
                    <div key={draw.id} className="flex justify-between text-gray-300">
                      <span>{draw.name} × {n} Lot</span>
                      <span>${fmt(subtotal * n)}</span>
                    </div>
                  );
                })}
                <div className="flex justify-between text-white font-bold text-base pt-1 border-t border-dashed border-gray-600/50">
                  <span>TOTAL</span>
                  <span className="text-indigo-300">${fmt(total)}</span>
                </div>
              </div>
            </div>
            <div className="p-4 pt-0 flex gap-3">
              <button
                onClick={() => setShowPreview(false)}
                className="flex-1 flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-gray-200 font-medium py-2.5 rounded-lg text-sm transition"
              >
                <FiX size={16} className="text-red-400" /> Rechazar
              </button>
              <button
                onClick={handleGenerate}
                disabled={submitting || hasClosedSelection}
                className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm transition shadow-lg shadow-green-500/20"
              >
                <FiCheck size={16} /> {submitting ? 'Generando...' : 'Compartir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {result && !showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-gray-800 border border-indigo-500/20 rounded-2xl w-full max-w-sm shadow-2xl p-6 text-center">
            <div className="w-14 h-14 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <FiCheck className="text-green-400" size={24} />
            </div>
            <h3 className="text-white font-bold mb-1">Boleta Generada</h3>
            <p className="text-indigo-300 font-mono text-sm mb-4">Secuencia: {result.sequence}</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => shareTicket(result.id, result.sequence)}
                className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white font-medium py-2.5 rounded-lg text-sm transition"
              >
                Compartir por WhatsApp
              </button>
              <button
                onClick={() => downloadTicket(result.id)}
                className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 rounded-lg text-sm transition"
              >
                Descargar PDF
              </button>
              <button
                onClick={() => { setResult(null); clearCart(); navigate('/'); }}
                className="flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-gray-200 font-medium py-2 rounded-lg text-sm transition"
              >
                Nueva Apuesta
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
