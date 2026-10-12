const API_BASE = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api').replace(/\/$/, '');

async function request(path, options = {}) {
  const token = localStorage.getItem('sheboyhaat_token');
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch (error) {
    throw new Error('Cannot connect to SheboyHaat server. Please start the backend and keep it running.');
  }
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

export async function api(path, options = {}) {
  const result = await request(path, options);
  if (!result.response.ok) throw new Error(result.data.message || `Request failed (${result.response.status})`);
  return result.data;
}
