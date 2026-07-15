import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import api from '../services/api';

const BetContext = createContext(null);

export function BetProvider({ children }) {
  const [lotteries, setLotteries] = useState([]);
  const [draws, setDraws] = useState([]);
  const [cart, setCart] = useState([]);
  // Selección por turno: { [drawId]: [lotteryId, ...] }
  const [selectedByDraw, setSelectedByDraw] = useState({});

  const fetchLotteries = useCallback(async () => {
    const { data } = await api.get('/lotteries');
    setLotteries(data);
  }, []);

  const fetchDraws = useCallback(async () => {
    const { data } = await api.get('/draws');
    setDraws(data);
  }, []);

  const toggleLotteryInDraw = useCallback((drawId, lotteryId) => {
    setSelectedByDraw((prev) => {
      const current = prev[drawId] ? [...prev[drawId]] : [];
      const next = current.includes(lotteryId)
        ? current.filter((id) => id !== lotteryId)
        : [...current, lotteryId];
      const copy = { ...prev };
      if (next.length === 0) delete copy[drawId];
      else copy[drawId] = next;
      return copy;
    });
  }, []);

  const setAllInDraw = useCallback((drawId, lotteryIds, select) => {
    setSelectedByDraw((prev) => {
      const copy = { ...prev };
      if (select) copy[drawId] = [...lotteryIds];
      else delete copy[drawId];
      return copy;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedByDraw({}), []);

  const addToCart = (item) => {
    setCart((prev) => [...prev, { ...item, id: Date.now() }]);
  };

  const removeFromCart = (id) => {
    setCart((prev) => prev.filter((i) => i.id !== id));
  };

  const clearCart = () => setCart([]);

  // Turnos seleccionados (los que tienen al menos una lotería)
  const selectedDraws = useMemo(
    () => Object.keys(selectedByDraw).map(Number),
    [selectedByDraw]
  );

  // Unión de loterías seleccionadas (para etiquetas)
  const selectedLotteries = useMemo(
    () => Array.from(new Set(Object.values(selectedByDraw).flat())),
    [selectedByDraw]
  );

  // Cantidad de loterías elegidas POR cada turno
  const lotteryCountForDraw = useCallback(
    (drawId) => (selectedByDraw[drawId] ? selectedByDraw[drawId].length : 0),
    [selectedByDraw]
  );

  // Total = subtotal × Σ (loterías por turno)
  const totalMultiplier = useMemo(
    () => Object.values(selectedByDraw).reduce((acc, arr) => acc + arr.length, 0),
    [selectedByDraw]
  );

  const submitBet = async () => {
    const payload = {
      selections: selectedDraws.map((drawId) => ({
        draw_id: drawId,
        lottery_ids: selectedByDraw[drawId],
      })),
      draw_date: new Date().toISOString().split('T')[0],
      items: cart.filter((i) => !i.isRedoblona).map(({ id, isRedoblona, ...rest }) => rest),
      redoblonas: cart.filter((i) => i.isRedoblona).map(({ id, isRedoblona, ...rest }) => rest),
    };
    const { data } = await api.post('/bets', payload);
    clearCart();
    clearSelection();
    return data;
  };

  return (
    <BetContext.Provider
      value={{
        lotteries, draws, cart,
        selectedByDraw, selectedDraws, selectedLotteries,
        toggleLotteryInDraw, setAllInDraw, clearSelection,
        lotteryCountForDraw, totalMultiplier,
        fetchLotteries, fetchDraws,
        addToCart, removeFromCart, clearCart, submitBet,
      }}
    >
      {children}
    </BetContext.Provider>
  );
}

export const useBet = () => useContext(BetContext);
