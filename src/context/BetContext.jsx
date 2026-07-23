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
  // "Todas" activado explícitamente por turno: { [drawId]: true }
  const [selectedAllByDraw, setSelectedAllByDraw] = useState({});
  // Bet copiada desde Dashboard para reutilizar jugadas
  const [copiedBet, setCopiedBet] = useState(null);
  // Stats del dashboard
  const [stats, setStats] = useState(null);
  // Filtros del dashboard - fecha por defecto hoy (Argentina)
  const [filterDate, setFilterDate] = useState(() => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }));
  const [filterDrawIds, setFilterDrawIds] = useState([]);
  // Bets del dashboard
  const [bets, setBets] = useState([]);
  // Modal view bet / delete
  const [viewBet, setViewBet] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  const clearDateFilter = useCallback(() => {
    setFilterDate('');
    setFilterDrawIds([]);
  }, []);

  const setFilterDateWithFetch = useCallback((date) => {
    setFilterDate(date);
  }, []);

  const setFilterDrawIdsWithFetch = useCallback((ids) => {
    setFilterDrawIds(ids);
  }, []);

  const fetchLotteries = useCallback(async () => {
    const { data } = await api.get('/lotteries');
    setLotteries(data);
  }, []);

  const fetchDraws = useCallback(async () => {
    const { data } = await api.get('/draws');
    setDraws(data);
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const { data } = await api.get('/dashboard/stats');
      setStats(data);
    } catch (e) {
      console.error('Error fetching stats:', e);
      // Set empty stats to unblock spinner
      setStats({ bets_count: 0, total_bets: 0, aciertos_count: 0, extracts_count: 0 });
    }
  }, []);

  const fetchBets = useCallback(async (params = {}) => {
    try {
      const { data } = await api.get('/bets', { params });
      const betsData = data.data || data;
      setBets(betsData);
      return betsData;
    } catch (e) {
      console.error('Error fetching bets:', e);
      setBets([]);
      return [];
    }
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
    const currentGroups = selectedGroupsByDraw[drawId] ? [...selectedGroupsByDraw[drawId]] : [];
    const willActivate = !currentGroups.includes(groupNum);
    setSelectedGroupsByDraw((prevGroups) => {
      const g = prevGroups[drawId] ? [...prevGroups[drawId]] : [];
      const next = willActivate ? [...g, groupNum] : g.filter((x) => x !== groupNum);
      const copyGroups = { ...prevGroups };
      if (next.length === 0) delete copyGroups[drawId];
      else copyGroups[drawId] = next;
      return copyGroups;
    });
    setManyInDraw(drawId, ids, willActivate);
  }, [selectedGroupsByDraw, setManyInDraw]);

  // Activa/desactiva "Todas". Recibe el estado deseado (select) para ser
  // idempotente: marca todas si no estaban todas, o las desmarca si ya lo estaban.
  const toggleAllInDraw = useCallback((drawId, ids, select) => {
    setSelectedAllByDraw((prev) => {
      const copy = { ...prev };
      if (select) copy[drawId] = true;
      else delete copy[drawId];
      return copy;
    });
    setManyInDraw(drawId, ids, select);
  }, [setManyInDraw]);

  const addToCart = (item) => {
    setCart((prev) => [...prev, { ...item, id: Date.now() }]);
  };

  const removeFromCart = (id) => {
    setCart((prev) => prev.filter((i) => i.id !== id));
  };

  const clearCart = () => setCart([]);

  // Copiar una apuesta desde Dashboard: guarda items + redoblonas
  const copyBet = useCallback((items, redoblonas) => {
    setCopiedBet({ items, redoblonas });
  }, []);

  // Consumir la apuesta copiada (la limpia después de usar)
  const consumeCopiedBet = useCallback(() => {
    const bet = copiedBet;
    setCopiedBet(null);
    return bet;
  }, [copiedBet]);

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
      // Fecha en zona America/Argentina/Buenos_Aires (no UTC): las jugadas
      // posteriores a las 21hs deben seguir contando para el dia local en curso,
      // no pasarse al dia siguiente por el corrimiento UTC de toISOString().
      draw_date: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }),
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
        bets,
        selectedByDraw, selectedDraws, selectedLotteries,
        selectedGroupsByDraw, toggleGroupInDraw,
        selectedAllByDraw, toggleAllInDraw,
        toggleLotteryInDraw, setAllInDraw, setManyInDraw, clearSelection,
        lotteryCountForDraw, totalMultiplier,
        fetchLotteries, fetchDraws, fetchStats, fetchBets,
        addToCart, removeFromCart, clearCart, submitBet,
        copyBet, consumeCopiedBet, copiedBet,
        stats,
        filterDate, setFilterDate: setFilterDateWithFetch,
        filterDrawIds, setFilterDrawIds: setFilterDrawIdsWithFetch,
        clearDateFilter,
      }}
    >
      {children}
    </BetContext.Provider>
  );
}

export const useBet = () => useContext(BetContext);
