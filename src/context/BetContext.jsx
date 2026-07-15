import { createContext, useContext, useState, useCallback } from 'react';
import api from '../services/api';

const BetContext = createContext(null);

export function BetProvider({ children }) {
  const [lotteries, setLotteries] = useState([]);
  const [draws, setDraws] = useState([]);
  const [cart, setCart] = useState([]);
  const [selectedDraws, setSelectedDraws] = useState([]);
  const [selectedLotteries, setSelectedLotteries] = useState([]);

  const fetchLotteries = useCallback(async () => {
    const { data } = await api.get('/lotteries');
    setLotteries(data);
  }, []);

  const fetchDraws = useCallback(async () => {
    const { data } = await api.get('/draws');
    setDraws(data);
  }, []);

  const addToCart = (item) => {
    setCart((prev) => [...prev, { ...item, id: Date.now() }]);
  };

  const removeFromCart = (id) => {
    setCart((prev) => prev.filter((i) => i.id !== id));
  };

  const clearCart = () => setCart([]);

  const submitBet = async () => {
    const payload = {
      draw_ids: selectedDraws,
      draw_date: new Date().toISOString().split('T')[0],
      lottery_ids: selectedLotteries,
      items: cart.filter((i) => !i.isRedoblona).map(({ id, isRedoblona, ...rest }) => rest),
      redoblonas: cart.filter((i) => i.isRedoblona).map(({ id, isRedoblona, ...rest }) => rest),
    };
    const { data } = await api.post('/bets', payload);
    clearCart();
    return data;
  };

  return (
    <BetContext.Provider
      value={{
        lotteries, draws, cart, selectedDraws, selectedLotteries,
        setSelectedDraws, setSelectedLotteries,
        fetchLotteries, fetchDraws,
        addToCart, removeFromCart, clearCart, submitBet,
      }}
    >
      {children}
    </BetContext.Provider>
  );
}

export const useBet = () => useContext(BetContext);
