const API_BASE = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api').replace(/\/$/, '');

async function request(path, options = {}) {
  const token = localStorage.getItem('sheboyhaat_token');
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch (error) {
    throw new Error('Cannot connect to SheboyHaat server. Please start the app using START-SHEBOYHAAT.bat and keep its windows open.');
  }
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

export async function api(path, options = {}) {
  let result = await request(path, options);

  // Make the prototype admin panel open without requiring a separate manual login.
  if (path.startsWith('/admin') && (result.response.status === 401 || result.response.status === 403)) {
    const login = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@sheboyhaat.local', password: 'Admin123!' })
    });
    const authData = await login.json().catch(() => ({}));
    if (login.ok && authData.token) {
      localStorage.setItem('sheboyhaat_token', authData.token);
      result = await request(path, options);
    }
  }

  if (!result.response.ok) throw new Error(result.data.message || `Request failed (${result.response.status})`);
  return result.data;
}
