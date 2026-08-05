import axios from 'axios';

console.log('[API] Base URL:', import.meta.env.VITE_API_URL || 'http://localhost:8383/api');

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8383/api',
  headers: { Accept: 'application/json' },
  timeout: 25000,
});

// Cache ligero de respuestas GET en sessionStorage para no recargar datos
// que no cambian al navegar entre secciones (loterias, horarios, draws).
// Reduce el delay perceptivo en produccion (la BD remota tarda ~0.8s por query).
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos
const GET_CACHE_KEY = 'api_get_cache_v6';

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

// Endpoints que NUNCA se cachean:
// - `/me` son la identidad y los ROLES del usuario. Es autorizacion, no datos.
const SIN_CACHE_EXACTO = ['/me'];

// Estos endpoints representan datos dinámicos altamente cambiantes. 
// En lugar de no cachearlos, usamos un TTL corto (15 seg) para que la
// navegación tipo "ida y vuelta" en la UI se sienta instantánea sin sacrificar frescura.
const DYNAMIC_PREFIXES = ['/extracts/', '/externos/dashboard/', '/bets', '/aciertos'];

function getUrlTTL(url) {
  if (DYNAMIC_PREFIXES.some((prefijo) => url.startsWith(prefijo))) {
    return 15 * 1000; // 15 segundos para datos vivos
  }
  return CACHE_TTL; // 5 minutos para loterias, horarios, etc.
}

function cacheable(config) {
  const url = config.url || '';
  if (!url || (config.method || 'get').toLowerCase() !== 'get') return false;
  if (SIN_CACHE_EXACTO.includes(url)) return false;
  return true;
}

function cacheKey(url, params) {
  // Incluir los params en la clave: sino, /bets?date=X y /bets?draw_ids=Y
  // compartirian el mismo cache y los filtros no se reflejarian.
  const qs = params && Object.keys(params).length
    ? '?' + Object.entries(params)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(Array.isArray(v) ? v.join(',') : v)}`)
        .join('&')
    : '';
  return url + qs;
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Para GET, devolver cache fresco si existe (sin tocar la red).
  if (cacheable(config)) {
    const map = readCache();
    const entry = map[cacheKey(config.url, config.params)];
    const ttl = getUrlTTL(config.url);
    if (entry && Date.now() - entry.t < ttl) {
      // Se marca la respuesta como servida del cache para que el interceptor
      // de respuesta NO la vuelva a guardar: al reescribir la entrada le
      // renovaba el TTL, asi que un dato viejo se quedaba pegado para siempre
      // mientras siguieras usando la app (nunca cumplia los 5 minutos).
      config.desdeCache = true;
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
    if (cacheable(response.config) && !response.config.desdeCache) {
      const map = readCache();
      map[cacheKey(response.config.url, response.config.params)] = { t: Date.now(), data: response.data };
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
      // Con los params: sin ellos se borraba una clave que no existia y la
      // entrada rota de /bets?date=X quedaba igual en el cache.
      delete map[cacheKey(error.config.url, error.config.params)];
      writeCache(map);
    }
    // Si el token expira o es invalido (ej. base de datos reiniciada), redirigir.
    // Ignoramos el 401 si viene del propio /login para no entorpecer los mensajes.
    if (error.response?.status === 401 && !error.config.url?.endsWith('/login')) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
