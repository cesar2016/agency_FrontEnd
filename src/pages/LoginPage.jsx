import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
      navigate('/');
    } catch {
      setError('Credenciales incorrectas');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-gray-800/50 backdrop-blur-sm border border-indigo-500/20 rounded-2xl p-8 shadow-2xl">
        <div className="flex items-center justify-center gap-3 mb-6">
          <img src="/logo.png" alt="Logo" className="h-12 w-12 object-contain" />
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            AGENCIA
          </h1>
        </div>
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-2 rounded-lg mb-4">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-gray-300 block mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 transition"
              placeholder="correo@ejemplo.com"
              required
            />
          </div>
          <div>
            <label className="text-sm text-gray-300 block mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 transition"
              placeholder="••••••"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium py-2.5 rounded-lg transition shadow-lg shadow-indigo-500/25"
          >
            Ingresar
          </button>
        </form>
      </div>
    </div>
  );
}
