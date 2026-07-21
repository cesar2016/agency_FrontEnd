import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import { FiArrowLeft, FiRefreshCw, FiGlobe, FiClock, FiSettings } from 'react-icons/fi';

const PAGES = [
  { path: 'lista_horarios.html', label: 'Horarios', icon: FiClock },
  { path: 'scrapear.html', label: 'Scraper', icon: FiGlobe },
  { path: 'admin.html', label: 'Admin', icon: FiSettings },
];

export default function ScraperDashboardPage() {
  const { path: pagePath } = useParams();
  const current = pagePath || 'scrapear.html';
  const [html, setHtml] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    api.get(`/externos/dashboard/${current}`, {
      responseType: 'text',
      headers: { Accept: 'text/html' },
    })
      .then(({ data }) => {
        if (active) { setHtml(data); setLoading(false); }
      })
      .catch((e) => {
        if (active) {
          setError(e?.response?.data?.message || e?.message || 'Error al cargar');
          setLoading(false);
        }
      });

    return () => { active = false; };
  }, [current]);

  const apiBase = useMemo(() => {
    const url = import.meta.env.VITE_API_URL || 'http://localhost:8383/api';
    return url.replace(/\/api$/, '');
  }, []);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';

  const injectedHtml = useMemo(() => {
    if (!html || !token) return '';
    return html.replace(
      '</head>',
      `<script>
        const __token__ = ${JSON.stringify(token)};
        const __apiBase__ = ${JSON.stringify(apiBase)};
        const origFetch = window.fetch.bind(window);
        window.fetch = function(url, opts = {}) {
          if (typeof url === 'string' && url.startsWith('/')) {
            url = __apiBase__ + url;
          }
          opts.headers = opts.headers || {};
          opts.headers['Authorization'] = 'Bearer ' + __token__;
          opts.headers['Accept'] = opts.headers['Accept'] || 'application/json, text/plain, */*';
          return origFetch(url, opts);
        };
      <\/script></head>`
    );
  }, [html, token, apiBase]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-50">
      <div className="flex items-center justify-between gap-2 px-4 py-2 bg-gray-900/90 backdrop-blur-sm border-b border-indigo-500/20 shrink-0">
        <Link
          to="/extracts/scrape"
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition"
        >
          <FiArrowLeft size={14} /> Volver
        </Link>
        <div className="flex items-center gap-2">
          {PAGES.map((p) => {
            const Icon = p.icon;
            return (
              <Link
                key={p.path}
                to={`/scraper-dashboard/${p.path}`}
                className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition font-medium ${
                  current === p.path
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                    : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50 hover:text-white'
                }`}
              >
                <Icon size={15} /> {p.label}
              </Link>
            );
          })}
        </div>
      </div>

      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <FiRefreshCw className="animate-spin text-indigo-600" size={32} />
        </div>
      )}

      {error && (
        <div className="flex-1 flex items-center justify-center bg-red-50">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {injectedHtml && (
        <iframe
          srcDoc={injectedHtml}
          className="flex-1 w-full border-none"
          title="Scraper Dashboard"
          sandbox="allow-scripts allow-same-origin allow-forms"
        />
      )}
    </div>
  );
}
