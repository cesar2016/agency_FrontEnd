import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBet } from '../context/BetContext';
import { FiPlus, FiCheck, FiX, FiArrowLeft, FiTrash2, FiChevronDown, FiChevronUp, FiEye, FiArrowDown, FiAlertTriangle } from 'react-icons/fi';
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
  const { selectedByDraw, selectedDraws, lotteries, draws, cart, extractStatus, addToCart, removeFromCart, clearCart, submitBet, totalMultiplier, lotteryCountForDraw, consumeCopiedBet, copiedBet } = useBet();
  const navigate = useNavigate();
  const copiedBetRef = useRef(null);

  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!result && selectedDraws.length === 0) {
      navigate('/', { replace: true });
    }
  }, [result, selectedDraws, navigate]);

  // Auto-populate cart from copied bet
  useEffect(() => {
    if (copiedBet && copiedBet !== copiedBetRef.current) {
      copiedBetRef.current = copiedBet;
      const bet = consumeCopiedBet();
      if (bet?.items?.length) {
        bet.items.forEach(item => {
          const numLen = String(item.number).length;
          const max = numLen === 4 ? 1000 : 10000;
          addToCart({ ...item, amount: Math.min(item.amount, max), id: Date.now() + Math.random() });
        });
      }
      if (bet?.redoblonas?.length) {
        bet.redoblonas.forEach(item => {
          addToCart({ ...item, isRedoblona: true, amount: Math.min(item.amount, 10000), id: Date.now() + Math.random() });
        });
      }
    }
  }, [copiedBet, consumeCopiedBet, addToCart]);

  const [number, setNumber] = useState('');
  const [position, setPosition] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');

  const [redFirst, setRedFirst] = useState('');
  const [redSecond, setRedSecond] = useState('');
  const [redFirstRange, setRedFirstRange] = useState(1);
  const [redSecondRange, setRedSecondRange] = useState(5);
  const [redAmount, setRedAmount] = useState('');
  const [redModalOpen, setRedModalOpen] = useState(false);

  const numberInputRef = useRef(null);
  const redSecondInputRef = useRef(null);

  // Foco inicial del modal Redoblona: siempre en el input 2° Numero.
  useEffect(() => {
    if (redModalOpen) {
      const t = setTimeout(() => redSecondInputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [redModalOpen]);

  const rangeLabel = { 1: 'A la cabeza', 5: 'A los 5', 10: 'A los 10', 15: 'A los 15', 20: 'A los 20' };

  // El 2° rango (Posicion) solo admite 5/10/15/20 y debe ser >= al 1° rango.
  useEffect(() => {
    if (redSecondRange < redFirstRange || ![5, 10, 15, 20].includes(redSecondRange)) {
      const valid = [5, 10, 15, 20].filter((r) => r >= redFirstRange);
      setRedSecondRange(valid[0]);
    }
  }, [redFirstRange, redSecondRange]);

  const [openSimple, setOpenSimple] = useState(true);
  const [openRedoblona, setOpenRedoblona] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showParaguayAlert, setShowParaguayAlert] = useState(false);
  const paraguayAlertShownRef = useRef(false);

  const allSelectedLotteryIds = Array.from(new Set(Object.values(selectedByDraw).flat()));
  const drawNames = draws.filter((d) => selectedDraws.includes(d.id)).map((d) => d.name).join(' / ');
  const lotteryLabels = lotteries.filter((l) => allSelectedLotteryIds.includes(l.id)).map((l) => l.initials).join(', ');
  const subtotal = cart.reduce((acc, i) => acc + Number(i.amount), 0);
  const total = subtotal * totalMultiplier;

  // Mostrar alerta de Paraguay una sola vez al montar la página si PAR está seleccionado
  const hasParaguay = lotteries
    .filter((l) => allSelectedLotteryIds.includes(l.id))
    .some((l) => l.initials === 'PAR');

  useEffect(() => {
    if (hasParaguay && !paraguayAlertShownRef.current) {
      paraguayAlertShownRef.current = true;
      setShowParaguayAlert(true);
    }
  }, [hasParaguay]);

  const closingTimeFor = (drawId, lotteryId) => {
    const l = lotteries.find((x) => x.id === lotteryId);
    const matching = (l?.schedules || []).filter((s) => s.draw_id === drawId);
    if (matching.length === 0) return null;
    const latest = matching.reduce((a, s) => (!a || s.draw_time > a.draw_time ? s : a));
    return latest?.closing_time || null;
  };

  const isClosedFor = (drawId, lotteryId) => {
    // 1. Verificar si el extracto ya fue cargado (al nivel que tenga algún número cargado)
    const drawStatus = extractStatus?.find(d => d.draw_id === drawId);
    if (drawStatus) {
      const lotStatus = drawStatus.lotteries.find(l => l.lottery_id === lotteryId);
      if (lotStatus && lotStatus.count > 0) {
        return true; // Ya tiene números cargados, se cierra la apuesta
      }
    }

    const ct = closingTimeFor(drawId, lotteryId);
    // Sin horario cargado para ese sorteo => se considera cerrada.
    if (!ct) return true;
    const now = new Date();
    const [h, m] = ct.split(':').map(Number);
    const close = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
    return now > close;
  };

  const closedSelection = selectedDraws.find((drawId) =>
    (selectedByDraw[drawId] || []).some((lotId) => isClosedFor(drawId, lotId))
  );
  const hasClosedSelection = closedSelection !== undefined;

  // Paraguay completa su grilla con:
  //   CAT La Previa  → posiciones 1 y 15-20 ("La Primera")
  //   SGO turno anterior → posiciones 2-14
  // La condición correcta es verificar CAT en el draw "La Previa" (distinto al draw de PAR)
  // y SGO en cualquier draw donde realmente tenga horario y haya cerrado.
  // Se ubica DESPUÉS de isClosedFor para evitar TDZ.
  const parComplementClosed = (() => {
    if (!hasParaguay) return false;
    const catLot = lotteries.find((l) => l.initials === 'CAT');
    const sgoLot = lotteries.find((l) => l.initials === 'SGO');
    if (!catLot && !sgoLot) return false;

    // 1. CAT La Previa: buscar el draw cuyo nombre contiene "Previa"
    const laPreviaDraw = draws.find((d) => /previa/i.test(d.name));
    if (catLot && laPreviaDraw && isClosedFor(laPreviaDraw.id, catLot.id)) {
      return true;
    }

    // 2. SGO en el mismo draw de PAR (si SGO realmente tiene horario ahí)
    //    Evitar el false-positive de isClosedFor: solo aplica si hay schedule real
    if (sgoLot) {
      const sgoSchedules = sgoLot.schedules || [];
      const closed = selectedDraws.some((drawId) => {
        const hasPar = (selectedByDraw[drawId] || []).some(
          (lotId) => lotteries.find((l) => l.id === lotId)?.initials === 'PAR'
        );
        if (!hasPar) return false;
        // Solo chequear si SGO tiene horario real en este draw
        const sgoHasSchedule = sgoSchedules.some((s) => s.draw_id === drawId);
        if (!sgoHasSchedule) return false;
        return isClosedFor(drawId, sgoLot.id);
      });
      if (closed) return true;
    }

    return false;
  })();

  // Límite de posición para apuesta simple cuando Paraguay tiene complemento cerrado
  const parMaxPos = hasParaguay && parComplementClosed ? 14 : 20;

  const mapPositionToType = (pos) => {
    if (pos <= 1) return 'primera';
    if (pos <= 5) return 'a_los_5';
    if (pos <= 10) return 'a_los_10';
    if (pos <= 15) return 'a_los_15';
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
    // Restricción especial Paraguay: máximo posición 14 cuando complemento cerró
    if (hasParaguay && parComplementClosed && pos > 14) {
      setError('PARAGUAY: Las loterías complementarias ya cerraron. Solo se permiten jugadas hasta la posición 14.');
      return;
    }
    // Las apuestas a 1 cifra solo se permiten hasta el puesto 10.
    if (number.length === 1 && pos > 10) {
      setError('Las apuestas a 1 cifra solo se permiten hasta el puesto 10');
      return;
    }
    const val = parseFloat(amount.replace(/\./g, ''));
    if (!val || val <= 0) {
      setError('Ingrese un importe valido');
      return;
    }
    const maxSimple = number.length === 4 ? 1000 : 10000;
    if (val > maxSimple) {
      setError(`El importe maximo para ${number.length} cifra${number.length > 1 ? 's' : ''} es $${maxSimple.toLocaleString('es-AR')}`);
      return;
    }
    // 1 cifra: solo a cabeza (pos 1) o a los 10. Nunca a los 5.
    const type =
      number.length === 1
        ? pos === 1
          ? 'primera'
          : 'a_los_10'
        : mapPositionToType(pos);
    addToCart({ number, position: pos, type, amount: val });
    setError('');
    numberInputRef.current?.focus();
  };

  const handleAddSimpleReduced = () => {
    const lastSimple = [...cart].reverse().find((i) => !i.isRedoblona);
    const baseNumber = lastSimple ? lastSimple.number : number;
    const basePos = lastSimple ? String(lastSimple.position) : position;
    const baseAmount = lastSimple ? String(lastSimple.amount) : amount;

    if (!baseNumber) {
      setError('No hay ninguna jugada para replicar');
      return;
    }
    // Reducir sobre el numero tal cual se ingreso: 0003 -> 003 -> 03.
    // No strippear ceros a la izquierda: son parte de la jugada.
    const raw = baseNumber.trim();
    if (raw.length <= 2) {
      setError('La jugada ya tiene el minimo de 2 cifras');
      return;
    }
    const reduced = raw.slice(1);
    const pos = parseInt(basePos);
    const val = parseFloat(baseAmount.replace(/\./g, ''));
    if (!val || val <= 0) {
      setError('Importe invalido');
      return;
    }
    const maxReduced = reduced.length === 4 ? 1000 : 10000;
    if (val > maxReduced) {
      setError(`El importe maximo para ${reduced.length} cifra${reduced.length > 1 ? 's' : ''} es $${maxReduced.toLocaleString('es-AR')}`);
      return;
    }
    const type =
      reduced.length === 1
        ? pos === 1
          ? 'primera'
          : 'a_los_10'
        : mapPositionToType(pos);
    addToCart({ number: reduced, position: pos, type, amount: val });
    setNumber(reduced);
    setPosition(basePos);
    setAmount(baseAmount);
    setError('');
    numberInputRef.current?.focus();
  };

  const handleAddRedoblona = () => {
    if (redFirst.length !== 2 || redSecond.length !== 2) {
      setError('Ambos numeros deben tener exactamente 2 digitos');
      return;
    }
    const allowedFirstRanges = hasParaguay && parComplementClosed ? [1, 5, 10] : [1, 5, 10, 15, 20];
    const allowedSecondRanges = hasParaguay && parComplementClosed ? [5, 10] : [5, 10, 15, 20];
    if (!allowedFirstRanges.includes(redFirstRange)) {
      setError(hasParaguay && parComplementClosed
        ? 'PARAGUAY: El Rango 1° solo puede ser 1, 5 o 10 (complemento cerrado)'
        : 'El Rango 1° debe ser 1, 5, 10, 15 o 20');
      return;
    }
    if (!allowedSecondRanges.includes(redSecondRange) || redSecondRange < redFirstRange) {
      setError(hasParaguay && parComplementClosed
        ? 'PARAGUAY: La Posicion solo puede ser 5 o 10 (complemento cerrado)'
        : 'La Posicion debe ser 5, 10, 15 o 20 y mayor o igual al Rango 1°');
      return;
    }
    const val = parseFloat(redAmount.replace(/\./g, ''));
    if (!val || val <= 0) {
      setError('Ingrese un importe valido');
      return;
    }
    if (val > 10000) {
      setError('El importe maximo para Redoblona es $10.000');
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
    setRedSecond('');
    setRedSecondRange(0);
    setError('');
  };

  const handleGenerate = async () => {
    if (submitting) return; // double-click edge case protection
    if (hasClosedSelection) {
      setError('No se pueden registrar apuestas: el horario de cierre de uno o más sorteos pasó o sus resultados ya fueron cargados.');
      return;
    }
    for (const item of cart) {
      if (item.isRedoblona) {
        if (item.amount > 10000) {
          setError('El importe maximo para Redoblona es $10.000');
          return;
        }
      } else {
        const numLen = String(item.number).length;
        const max = numLen === 4 ? 1000 : 10000;
        if (item.amount > max) {
          setError(`El importe maximo para ${numLen} cifra${numLen > 1 ? 's' : ''} es $${max.toLocaleString('es-AR')}`);
          return;
        }
      }
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
    if (actionLoading) return;
    setActionLoading(true);
    try {
      const blob = await getTicketBlob(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `boleta-${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      console.error(e);
      alert('Error descargando boleta');
    } finally {
      setActionLoading(false);
    }
  };

  const shareTicket = async (id, sequence) => {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      const blob = await getTicketBlob(id);
      const file = new File([blob], `boleta-${sequence}.pdf`, { type: 'application/pdf' });
      
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Boleta Agencia' });
        return;
      }
      
      // Fallback: Si no puede compartir el archivo (ej. PC), forzar descarga
      const url = window.URL.createObjectURL(blob);
      const a2 = document.createElement('a');
      a2.href = url;
      a2.download = `boleta-${sequence}.pdf`;
      document.body.appendChild(a2);
      a2.click();
      a2.remove();
      
      // Intentar abrir WhatsApp web para que pegue el manual
      const a = document.createElement('a');
      a.href = `https://wa.me/?text=${encodeURIComponent('Adjunte el PDF descargado para enviarlo.')}`;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      a.remove();
      
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      if (e.name !== 'AbortError') {
        console.error(e);
        alert('Error compartiendo boleta');
      }
    } finally {
      setActionLoading(false);
    }
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
          <p className="text-indigo-300 text-xs truncate max-w-[180px] sm:max-w-none">
            {lotteryLabels}
            {allSelectedLotteryIds.length > 0 && (
              <span className="ml-1.5 bg-indigo-600/40 text-indigo-200 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {allSelectedLotteryIds.length} Lot
              </span>
            )}
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-2 rounded-lg">
          {error}
        </div>
      )}

      <Accordion title="Apuesta Simple" open={openSimple} onToggle={() => setOpenSimple(!openSimple)}>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-gray-400 block mb-1 text-center">Numero</label>
            <input
              ref={numberInputRef}
              type="text"
              inputMode="numeric"
              maxLength={4}
              value={number}
              onChange={(e) => setNumber(e.target.value.replace(/\D/g, ''))}
              className="no-spinner w-full bg-gray-700/50 border border-gray-600 rounded-lg text-center font-bold text-xl text-white focus:outline-none focus:border-indigo-500"
              style={{ padding: '1.5rem 0.5rem' }}
              placeholder="47 o 7"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1 text-center">
              Posicion{hasParaguay && parComplementClosed && (
                <span className="text-amber-400 ml-1">(máx. {parMaxPos})</span>
              )}
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={2}
              value={position}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '');
                if (hasParaguay && parComplementClosed && val !== '' && parseInt(val, 10) > parMaxPos) {
                  setError(
                    `⚠ PARAGUAY: Catamarca La Previa ya cerró. Las posiciones 15 al 20 las completa la lotería complementaria. Solo se admiten jugadas hasta la posición ${parMaxPos}.`
                  );
                  return; // no actualizar el campo
                }
                setError('');
                setPosition(val);
              }}
              className={`no-spinner w-full bg-gray-700/50 border rounded-lg text-center font-bold text-xl text-white focus:outline-none transition ${hasParaguay && parComplementClosed ? 'border-amber-500/50 focus:border-amber-400' : 'border-gray-600 focus:border-indigo-500'}`}
              style={{ padding: '1.5rem 0.5rem' }}
              placeholder={hasParaguay && parComplementClosed ? `1-${parMaxPos}` : '1-20'}
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
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={handleAddSimple}
            className="flex items-center gap-1 text-sm bg-indigo-600/40 hover:bg-indigo-600/60 text-indigo-200 px-4 py-2 rounded-lg transition"
          >
            <FiPlus size={14} /> Agregar
          </button>
          <button
            onClick={handleAddSimpleReduced}
            title="Replicar jugada con una cifra menos"
            className="flex items-center justify-center bg-white hover:bg-gray-100 text-black border border-gray-300 px-3 py-2 rounded-lg transition"
          >
            <FiArrowDown size={16} className="font-bold" />
          </button>
        </div>
      </Accordion>

      <Accordion title="La Redoblona" open={openRedoblona} onToggle={() => setOpenRedoblona(!openRedoblona)}>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-gray-400 block mb-1 text-center">1° Numero</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={2}
              value={redFirst}
              onChange={(e) => setRedFirst(e.target.value.replace(/\D/g, ''))}
              className="no-spinner w-full bg-gray-700/50 border border-gray-600 rounded-lg text-center font-bold text-xl text-white focus:outline-none focus:border-indigo-500"
              style={{ padding: '1.5rem 0.5rem' }}
              placeholder="01"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1 text-center">Rango 1°</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={2}
              value={redFirstRange || ''}
              onChange={(e) => {
                const raw = e.target.value.replace(/\D/g, '');
                const v = Number(raw);
                if (raw === '' || [1, 2, 5, 10, 15, 20].includes(v)) {
                  setRedFirstRange(v);
                }
              }}
              className="no-spinner w-full bg-gray-700/50 border border-gray-600 rounded-lg text-center font-bold text-xl text-white focus:outline-none focus:border-indigo-500"
              style={{ padding: '1.5rem 0.5rem' }}
              placeholder="1/5/10/15/20"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1 text-center">Importe $</label>
            <input
              type="text"
              inputMode="numeric"
              value={displayAmount(redAmount)}
              onChange={(e) => handleAmountChange(e.target.value, setRedAmount)}
              className="no-spinner w-full bg-gray-700/50 border border-gray-600 rounded-lg text-center font-bold text-xl text-white focus:outline-none focus:border-indigo-500"
              style={{ padding: '1.5rem 0.5rem' }}
              placeholder="$"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => setRedModalOpen(true)}
          className="mt-3 w-full flex items-center justify-center rounded-lg bg-white text-gray-900 font-bold text-lg hover:bg-gray-200 transition"
          style={{ padding: '1.25rem 0' }}
        >
          R
        </button>
      </Accordion>

      {/* Modal de advertencia: Lotería Paraguay */}
      {showParaguayAlert && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md bg-gray-900 border border-amber-500/40 rounded-2xl shadow-2xl overflow-hidden animate-[fadeInScale_0.2s_ease-out]">
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 bg-amber-500/10 border-b border-amber-500/20">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                <FiAlertTriangle size={22} className="text-amber-400" />
              </div>
              <div>
                <h3 className="text-amber-300 font-bold text-base tracking-wide">⚠ ATENCIÓN — Lotería PARAGUAY</h3>
                <p className="text-amber-400/70 text-xs mt-0.5">Información importante sobre la jugada</p>
              </div>
            </div>
            {/* Body */}
            <div className="px-5 py-5 space-y-3">
              <p className="text-gray-100 text-sm leading-relaxed">
                Recuerde que la lotería de <span className="text-amber-300 font-bold">PARAGUAY</span> completa
                sus jugadas para las <span className="font-semibold text-white">4 cifras</span> y del{' '}
                <span className="font-semibold text-white">15 al 20</span> en{' '}
                <span className="text-amber-300 font-semibold">La Primera</span> con la jugada de{' '}
                <span className="font-semibold text-white">CATAMARCA</span> y las restantes con{' '}
                <span className="font-semibold text-white">Santiago</span> del turno pasado.
              </p>
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-3">
                <p className="text-amber-300 text-xs font-semibold uppercase tracking-wider mb-1">Ejemplo</p>
                <p className="text-gray-300 text-sm">
                  Paraguay en <span className="font-bold text-white">Matutina</span> completa con
                  Santiago de <span className="font-bold text-white">La Previa</span>.
                </p>
              </div>
            </div>
            {/* Footer */}
            <div className="px-5 py-4 border-t border-gray-700/50 flex justify-end">
              <button
                onClick={() => setShowParaguayAlert(false)}
                className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-gray-900 font-bold px-6 py-2.5 rounded-lg text-sm transition shadow-lg shadow-amber-500/20"
              >
                <FiCheck size={16} /> Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {redModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-gray-900 border border-indigo-500/20 rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-700/50">
              <h3 className="text-base font-semibold text-white">Completar Redoblona</h3>
              <p className="text-xs text-gray-400">Ingresá el 2° numero y su posicion (5, 10, 15 o 20).</p>
            </div>
            <div className="p-5 grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1 text-center">2° Numero</label>
                <input
                  ref={redSecondInputRef}
                  type="text"
                  inputMode="numeric"
                  maxLength={2}
                  value={redSecond}
                  onChange={(e) => setRedSecond(e.target.value.replace(/\D/g, ''))}
                  className="no-spinner w-full bg-gray-700/50 border border-gray-600 rounded-lg text-center font-bold text-xl text-white focus:outline-none focus:border-indigo-500"
                  style={{ padding: '1.5rem 0.5rem' }}
                  placeholder="01"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1 text-center">Posicion (2° rango)</label>
                {hasParaguay && parComplementClosed && (
                  <p className="text-amber-400 text-xs mb-1 text-center">⚠ PAR: solo hasta posición 10</p>
                )}
                <div className="flex gap-2">
                  {(hasParaguay && parComplementClosed ? [5, 10] : [5, 10, 15, 20]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRedSecondRange(r)}
                      className={`flex-1 text-center font-bold text-xl rounded-lg border transition ${
                        redSecondRange === r
                          ? 'bg-indigo-600 border-indigo-500 text-white'
                          : 'bg-gray-700/50 border-gray-600 text-gray-300 hover:bg-gray-700'
                      }`}
                      style={{ padding: '1.25rem 0' }}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-700/50">
              <button
                onClick={() => setRedModalOpen(false)}
                className="text-sm text-gray-300 hover:text-white bg-gray-700/60 hover:bg-gray-700 px-4 py-2 rounded-lg transition"
              >
                Cancelar
              </button>
              <button
                onClick={() => { setRedModalOpen(false); handleAddRedoblona(); }}
                className="flex items-center gap-1 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-lg transition"
              >
                <FiPlus size={14} /> Agregar Redoblona
              </button>
            </div>
          </div>
        </div>
      )}

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
                    {item.isRedoblona ? `${String(item.first_number).padStart(2, '0')}-${String(item.second_number).padStart(2, '0')}` : item.number}
                  </td>
                  <td className="p-2 text-gray-300 text-center text-xs">
                    {item.isRedoblona ? `${String(item.first_range).padStart(2, '0')} y ${String(item.second_range).padStart(2, '0')}` : `#${item.position}`}
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
                const simpleItems = cart.filter(i => !i.isRedoblona);
                const redItems = cart.filter(i => i.isRedoblona);
                const simpleBase = simpleItems.reduce((acc, i) => acc + Number(i.amount || 0), 0);
                const redBase = redItems.reduce((acc, r) => acc + Number(r.amount || 0), 0);
                return (
                  <div key={draw.id}>
                    <p className="text-center text-white font-bold text-sm mb-1">{draw.name}</p>
                    <p className="text-center text-indigo-300 font-bold mb-2">
                      {lotInitials.join(' · ')}
                      <span className="ml-2 bg-indigo-600/30 text-indigo-200 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                        {n} Lot
                      </span>
                    </p>
                    {simpleItems.length > 0 && (
                      <>
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-dashed border-gray-600/50 text-gray-400">
                              <th className="text-left py-1">NUMERO</th>
                              <th className="text-center py-1">POS</th>
                              <th className="text-right py-1">IMPORTE</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr><td colSpan="3" className="text-center text-indigo-300 font-bold py-1">Jugada Simple</td></tr>
                            {simpleItems.map((item) => (
                              <tr key={item.id}>
                                <td className="py-1 text-white font-bold">{item.number}</td>
                                <td className="py-1 text-center text-gray-400">#{item.position}</td>
                                <td className="py-1 text-right text-white">${fmt(item.amount)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <div className="flex justify-between text-gray-300 pt-1 border-t border-dashed border-gray-600/50">
                          <span>Jugada Simple x {n} Lot</span>
                          <span>${fmt(simpleBase * n)}</span>
                        </div>
                      </>
                    )}
                    {redItems.length > 0 && (
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
                            <tr><td colSpan="3" className="text-center text-indigo-300 font-bold py-1">REDOBLONA</td></tr>
                            {redItems.map((item) => (
                              <tr key={item.id}>
                                <td className="py-1 text-white font-bold">{String(item.first_number).padStart(2, '0')}-{String(item.second_number).padStart(2, '0')}</td>
                                <td className="py-1 text-center text-gray-400">{String(item.first_range).padStart(2, '0')} y {String(item.second_range).padStart(2, '0')}</td>
                                <td className="py-1 text-right text-white">${fmt(item.amount)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <div className="flex justify-between text-gray-300 pt-1 border-t border-dashed border-gray-600/50">
                          <span>Redoblona x {n} Lot</span>
                          <span>${fmt(redBase * n)}</span>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
              <div className="border-t border-dashed border-indigo-500/40 pt-2">
                <div className="flex justify-between text-white font-bold text-base pt-1">
                  <span>TOTAL</span>
                  <span className="text-indigo-300">${fmt(total)}</span>
                </div>
              </div>
            </div>
            <div className="p-4 pt-0 flex gap-3">
              {submitting ? (
                <div className="w-full flex items-center justify-center py-2.5 bg-gray-800/80 rounded-lg text-green-400 font-bold border border-green-500/20 shadow-[0_0_15px_rgba(34,197,94,0.2)]">
                  <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Generando PDF...
                </div>
              ) : (
                <>
                  <button
                    onClick={() => setShowPreview(false)}
                    className="flex-1 flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-gray-200 font-medium py-2.5 rounded-lg text-sm transition"
                  >
                    <FiX size={16} className="text-red-400" /> Rechazar
                  </button>
                  <button
                    onClick={handleGenerate}
                    disabled={hasClosedSelection || submitting}
                    className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm transition shadow-lg shadow-green-500/20"
                  >
                    {submitting ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Procesando...
                      </>
                    ) : (
                      <>
                        <FiCheck size={16} /> Aceptar
                      </>
                    )}
                  </button>
                </>
              )}
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
            <p className="text-indigo-300 font-mono text-sm mb-4">Secuencia: {result[0]?.sequence}</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => shareTicket(result[0]?.id, result[0]?.sequence)}
                disabled={actionLoading}
                className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm transition"
              >
                {actionLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generando PDF...
                  </>
                ) : (
                  'Compartir por WhatsApp'
                )}
              </button>
              <button
                onClick={() => downloadTicket(result[0]?.id)}
                disabled={actionLoading}
                className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-600 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm transition"
              >
                Descargar PDF
              </button>
              <button
                onClick={() => { setResult(null); clearCart(); navigate('/'); }}
                disabled={actionLoading}
                className="flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:opacity-50 text-gray-200 font-medium py-2 rounded-lg text-sm transition"
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
