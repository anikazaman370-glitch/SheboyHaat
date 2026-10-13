const API_BASE = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api').replace(/\/$/, '');
const TOKEN_KEY = 'sheboyhaat_token';
const USER_KEY = 'sheboyhaat_user';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function setStoredUser(user) {
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_KEY);
}

async function rawRequest(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...options, headers, credentials: 'include' });
  } catch (error) {
    throw new Error('Cannot connect to SheboyHaat server. Please start the backend and keep it running.');
  }
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

let refreshPromise = null;

export async function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const { response, data } = await rawRequest('/auth/refresh', { method: 'POST' });
      if (!response.ok) {
        setToken(null);
        return null;
      }
      setToken(data.token || data.accessToken || null);
      if (data.user) setStoredUser(data.user);
      return data;
    })().finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

const isAuthEndpoint = (path) => /^\/auth\/(login|register|refresh|logout)$/.test(path);

export async function api(path, options = {}, retry = true) {
  let result = await rawRequest(path, options);
  if (result.response.status === 401 && retry && !isAuthEndpoint(path)) {
    const refreshed = await refreshSession();
    if (refreshed) result = await rawRequest(path, options);
  }
  if (!result.response.ok) throw new Error(result.data.message || `Request failed (${result.response.status})`);
  return result.data;
}
