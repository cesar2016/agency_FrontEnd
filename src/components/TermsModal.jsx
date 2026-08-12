import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function TermsModal() {
  const { user, loading } = useAuth();
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState(null);

  if (loading || !user || user.accepted_terms) {
    return null;
  }

  const isSuperAdmin = Array.isArray(user.roles) && user.roles.includes('super_admin');
  if (!isSuperAdmin) {
    return null;
  }

  const handleAccept = async () => {
    setAccepting(true);
    setError(null);
    try {
      await api.post('/accept-terms');
      // Update user state directly or reload page
      window.location.reload();
    } catch (err) {
      setError(err?.response?.data?.message || 'Error al aceptar los términos.');
      setAccepting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await api.post('/logout');
    } catch (e) {
      // ignore
    } finally {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/95 backdrop-blur-sm overflow-y-auto">
      <div className="bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-gray-700">
          <h2 className="text-2xl font-bold text-white">Términos y Condiciones de Uso</h2>
          <p className="text-gray-400 text-sm mt-1">Plataforma AGENCIA</p>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1 text-gray-300 space-y-4 text-sm leading-relaxed">
          <p>
            Al acceder, registrarse o utilizar este sistema, el usuario declara haber leído, entendido y aceptado de manera expresa los siguientes términos y condiciones:
          </p>
          
          <div>
            <h3 className="font-bold text-white text-base">1. Naturaleza del Servicio (Proveedor de Software)</h3>
            <p className="mt-1">
              La plataforma AGENCIA opera exclusivamente como un sistema informático de software de gestión, administración y control de datos. El servicio consiste únicamente en el alquiler del espacio digital y herramientas tecnológicas para que los Administradores (bancas) gestionen sus actividades de manera organizada, fluida y eficiente.
            </p>
          </div>

          <div>
            <h3 className="font-bold text-white text-base">2. Ausencia de Sorteos y Elección de Azar</h3>
            <p className="mt-1">
              En esta plataforma no se generan, no se realizan ni se organizan sorteos, como así tampoco se exponen o utilizan métodos propios de elección al azar o algoritmos numéricos aleatorios. El sistema funciona estrictamente como una herramienta de registro, organización y procesamiento de información ingresada o consultada.
            </p>
          </div>

          <div>
            <h3 className="font-bold text-white text-base">3. Exención Absoluta de Responsabilidad sobre Premios y Saldos</h3>
            <p className="mt-1">
              La plataforma y sus desarrolladores quedan completamente eximidos de cualquier responsabilidad respecto al pago, liquidación o cumplimiento de premios, saldos o importes adeudados a los ganadores o usuarios.
            </p>
            <p className="mt-1">
              El pago de cualquier premio es obligación única, pura y exclusiva del Administrador (banca) que alquila el servicio para operar su gestión.
            </p>
            <p className="mt-1">
              La plataforma no interviene en la recaudación, pago, custodia de fondos ni en las transacciones financieras que se realicen entre los Administradores, pasadores y sus clientes.
            </p>
          </div>

          <div>
            <h3 className="font-bold text-white text-base">4. Aceptación y Deslinde</h3>
            <p className="mt-1">
              El uso del sistema implica el reconocimiento explícito de que cualquier reclamo, controversia o demanda relacionada con el pago de premios deberá dirigirse única y exclusivamente al Administrador a cargo, desvinculando por completo a los proveedores tecnológicos de la plataforma AGENCIA.
            </p>
          </div>
        </div>

        <div className="p-6 border-t border-gray-700 flex flex-col sm:flex-row gap-3">
          {error && <div className="w-full text-red-500 text-sm mb-3 sm:mb-0">{error}</div>}
          
          <button
            onClick={handleLogout}
            disabled={accepting}
            className="w-full sm:w-auto px-6 py-2.5 rounded-lg font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            No Acepto
          </button>
          
          <button
            onClick={handleAccept}
            disabled={accepting}
            className="w-full sm:flex-1 px-6 py-2.5 rounded-lg font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg hover:shadow-indigo-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {accepting ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Procesando...
              </>
            ) : (
              'He leído y Acepto los Términos'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
