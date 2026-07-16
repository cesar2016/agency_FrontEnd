import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBet } from '../context/BetContext';
import { FiTrash2, FiArrowLeft, FiCheck, FiDownload, FiX } from 'react-icons/fi';
import api from '../services/api';

export default function CartPage() {
  const { cart, removeFromCart, clearCart, submitBet, selectedByDraw, selectedDraws, draws, totalMultiplier, lotteryCountForDraw } = useBet();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const subtotal = cart.reduce((acc, item) => acc + item.amount, 0);
  const total = subtotal * totalMultiplier;
  const drawNames = draws.filter((d) => selectedDraws.includes(d.id)).map((d) => d.name).join(' / ');

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const data = await submitBet();
      setResult(data);
    } catch {
      alert('Error al enviar la apuesta');
    } finally {
      setSubmitting(false);
    }
  };

  const downloadTicket = async (id) => {
    const { data } = await api.get(`/tickets/${id}/download`, { responseType: 'blob' });
    const url = URL.createObjectURL(data);
    window.open(url, '_blank');
  };

  if (result) {
    return (
      <div className="max-w-md mx-auto mt-12 bg-gray-800/50 backdrop-blur-sm border border-green-500/20 rounded-2xl p-8 text-center">
        <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <FiCheck className="text-green-400" size={28} />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Apuesta Registrada</h2>
        <p className="text-indigo-300 text-lg font-mono mb-1">Secuencia: {result.sequence}</p>
        <p className="text-gray-400 text-sm mb-6">{drawNames} | Total: ${result.total}</p>
        <div className="flex gap-3 justify-center">
          <button onClick={() => downloadTicket(result.id)}
            className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm transition">
            <FiDownload size={16} /> Descargar Ticket
          </button>
          <button onClick={() => { setResult(null); navigate('/'); }}
            className="flex items-center gap-1 bg-gray-700 hover:bg-gray-600 text-gray-200 px-4 py-2 rounded-lg text-sm transition">
            <FiArrowLeft size={16} /> Nueva
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/bet')} className="flex items-center gap-1 text-gray-400 hover:text-white transition text-sm">
          <FiArrowLeft size={16} /> Seguir apostando
        </button>
        {cart.length > 0 && (
          <button onClick={clearCart} className="flex items-center gap-1 text-red-400 hover:text-red-300 text-sm transition">
            <FiX size={16} /> Limpiar
          </button>
        )}
      </div>

      {cart.length === 0 ? (
        <div className="bg-gray-800/30 rounded-2xl p-12 text-center">
          <p className="text-gray-400">No hay apuestas en la boleta</p>
          <button onClick={() => navigate('/bet')} className="mt-2 text-indigo-400 hover:text-indigo-300 text-sm">Agregar apuestas</button>
        </div>
      ) : (
        <>
          <div className="bg-gray-800/40 backdrop-blur-sm border border-indigo-500/10 rounded-2xl overflow-x-auto">
            <div className="p-4 border-b border-gray-700/50">
              <h3 className="text-white font-semibold">{drawNames}</h3>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-700/30">
                <tr>
                  <th className="text-left p-3 text-gray-300 font-medium">Numero</th>
                  <th className="text-center p-3 text-gray-300 font-medium">Pos</th>
                  <th className="text-right p-3 text-gray-300 font-medium">Importe</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {cart.map((item) => (
                  <tr key={item.id} className="border-t border-gray-700/30">
                    <td className="p-3 text-white font-mono">
                      {item.isRedoblona ? `${item.first_number}/${item.second_number}` : item.number}
                    </td>
                    <td className="p-3 text-gray-300 text-center text-xs">
                      {item.isRedoblona
                        ? `R${item.first_range}/${item.second_range}`
                        : `#${item.position}`}
                    </td>
                    <td className="p-3 text-right text-white">${item.amount.toFixed(2)}</td>
                    <td className="p-3 text-right">
                      <button onClick={() => removeFromCart(item.id)} className="text-red-400 hover:text-red-300">
                        <FiTrash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="p-4 border-t border-gray-700/50 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Subtotal</span>
                <span className="text-gray-300">${subtotal.toFixed(2)}</span>
              </div>
              {draws.filter((d) => selectedDraws.includes(d.id)).map((draw) => {
                const n = lotteryCountForDraw(draw.id);
                if (n === 0) return null;
                return (
                  <div key={draw.id} className="flex justify-between">
                    <span className="text-gray-400">{draw.name} × {n} Lot</span>
                    <span className="text-gray-300">${(subtotal * n).toFixed(2)}</span>
                  </div>
                );
              })}
              <div className="flex justify-between pt-1 border-t border-gray-700/30">
                <span className="text-white font-semibold">TOTAL A PAGAR</span>
                <span className="text-indigo-300 font-bold">${total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition shadow-lg shadow-indigo-500/20"
          >
            {submitting ? 'Procesando...' : `Emitir Ticket - $${total.toFixed(2)}`}
          </button>
        </>
      )}
    </div>
  );
}
