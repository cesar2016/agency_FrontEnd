import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8383/api',
  headers: { Accept: 'application/json' },
  timeout: 25000,
});

// Cache ligero de respuestas GET en sessionStorage para no recargar datos
// que no cambian al navegar entre secciones (loterias, horarios, me, draws).
// Reduce el delay perceptivo en produccion (la BD remota tarda ~0.8s por query).
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos
const GET_CACHE_KEY = 'api_get_cache_v4';

function readCache() {
  try {
    return JSON.parse(sessionStorage.getItem(GET_CACHE_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeCache(map) {
  try {
    sessionStorage.setItem(GET_CACHE_KEY, JSON.stringify(map));
  } catch {
    /* sessionStorage lleno o no disponible: ignorar */
  }
}

function cacheKey(url) {
  return url;
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Para GET, devolver cache fresco si existe (sin tocar la red).
  if ((config.method || 'get').toLowerCase() === 'get' && config.url) {
    const map = readCache();
    const entry = map[cacheKey(config.url)];
    if (entry && Date.now() - entry.t < CACHE_TTL) {
      config.adapter = () =>
        Promise.resolve({
          data: entry.data,
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
          request: {},
        });
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    const url = response.config.url || '';
    if ((response.config.method || 'get').toLowerCase() === 'get' && url) {
      const map = readCache();
      map[cacheKey(url)] = { t: Date.now(), data: response.data };
      writeCache(map);
    }
    // Las mutaciones invalidan el cache de GET para refrescar al recargar.
    if (['post', 'put', 'patch', 'delete'].includes((response.config.method || '').toLowerCase())) {
      writeCache({});
    }
    return response;
  },
  (error) => {
    // Si la peticion GET fallo (timeout/red), limpiamos la cache de ese
    // endpoint para no quedar atrapados con una respuesta vieja/rota.
    if (error?.config && (error.config.method || 'get').toLowerCase() === 'get' && error.config.url) {
      const map = readCache();
      delete map[cacheKey(error.config.url)];
      writeCache(map);
    }
    return Promise.reject(error);
  }
);

export default api;
