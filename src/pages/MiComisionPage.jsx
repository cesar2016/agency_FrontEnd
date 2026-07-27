import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import CajaModal from '../components/CajaModal';

export default function MiComisionPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [toast, setToast] = useState(null);

  const flash = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  return (
    <>
      <CajaModal
        user={user}
        open
        onClose={() => navigate('/')}
        onError={flash}
      />
      {toast && (
        <div className="fixed bottom-4 right-4 bg-gray-800 border border-indigo-500/30 rounded-xl px-4 py-3 text-sm text-white shadow-2xl z-[70]">
          {toast}
        </div>
      )}
    </>
  );
}
