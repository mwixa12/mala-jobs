const API_BASE_URL = 'http://localhost:5000/api';

export function getTokens() {
  const accessToken = localStorage.getItem('malajobs_access_token');
  const refreshToken = localStorage.getItem('malajobs_refresh_token');
  return { accessToken, refreshToken };
}

export function setTokens({ accessToken, refreshToken }) {
  if (accessToken) localStorage.setItem('malajobs_access_token', accessToken);
  if (refreshToken) localStorage.setItem('malajobs_refresh_token', refreshToken);
}

export function clearTokens() {
  localStorage.removeItem('malajobs_access_token');
  localStorage.removeItem('malajobs_refresh_token');
  localStorage.removeItem('malajobs_user');
}

export async function apiFetch(endpoint, options = {}) {
  const { accessToken } = getTokens();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  let response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers
  });

  // Handle 401 token refresh if refresh token exists
  if (response.status === 401 && !options._isRetry) {
    const { refreshToken } = getTokens();
    if (refreshToken) {
      try {
        const refreshRes = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken })
        });

        if (refreshRes.ok) {
          const data = await refreshRes.json();
          setTokens(data.tokens);
          // Retry original request
          headers['Authorization'] = `Bearer ${data.tokens.accessToken}`;
          response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            _isRetry: true,
            headers
          });
        } else {
          clearTokens();
        }
      } catch (err) {
        clearTokens();
      }
    }
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

export default apiFetch;
