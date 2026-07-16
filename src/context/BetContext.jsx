import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import api from '../services/api';

const BetContext = createContext(null);

export function BetProvider({ children }) {
  const [lotteries, setLotteries] = useState([]);
  const [draws, setDraws] = useState([]);
  const [cart, setCart] = useState([]);
  // Selección por turno: { [drawId]: [lotteryId, ...] }
  const [selectedByDraw, setSelectedByDraw] = useState({});
  // Grupos de favoritos activados explícitamente por turno: { [drawId]: [groupNum, ...] }
  const [selectedGroupsByDraw, setSelectedGroupsByDraw] = useState({});

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

  const clearSelection = useCallback(() => {
    setSelectedByDraw({});
    setSelectedGroupsByDraw({});
  }, []);

  // Selecciona/deselecciona un conjunto de loterías en un turno (usado por "Loterías Principales")
  const setManyInDraw = useCallback((drawId, ids, select) => {
    setSelectedByDraw((prev) => {
      const current = prev[drawId] ? [...prev[drawId]] : [];
      const next = select
        ? Array.from(new Set([...current, ...ids]))
        : current.filter((id) => !ids.includes(id));
      const copy = { ...prev };
      if (next.length === 0) delete copy[drawId];
      else copy[drawId] = next;
      return copy;
    });
  }, []);

  // Activa/desactiva un grupo de favoritos explícitamente (no se deriva de la selección manual)
  const toggleGroupInDraw = useCallback((drawId, groupNum, ids) => {
    let willActivate = false;
    setSelectedGroupsByDraw((prevGroups) => {
      const currentGroups = prevGroups[drawId] ? [...prevGroups[drawId]] : [];
      willActivate = !currentGroups.includes(groupNum);
      const copyGroups = { ...prevGroups };
      if (willActivate) {
        copyGroups[drawId] = [...currentGroups, groupNum];
      } else {
        copyGroups[drawId] = currentGroups.filter((g) => g !== groupNum);
        if (copyGroups[drawId].length === 0) delete copyGroups[drawId];
      }
      return copyGroups;
    });
    setManyInDraw(drawId, ids, willActivate);
  }, [setManyInDraw]);

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
        selectedGroupsByDraw, toggleGroupInDraw,
        toggleLotteryInDraw, setAllInDraw, setManyInDraw, clearSelection,
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
