/* eslint-disable no-unused-vars */
/* eslint-disable no-empty */
// src/contexts/AuthProvider.jsx
import React, { useEffect, useState, useCallback, useRef } from 'react';
import axios from 'axios';
import AuthContext from './AuthContext';

/**
 * AuthProvider
 *
 * Responsibilities:
 * - persist token, refreshToken, user to localStorage
 * - keep axios.defaults.headers.common['Authorization'] in sync
 * - automatically refresh access token while refresh token remains valid
 * - retry failed requests (401) once after refreshing access token
 *
 * Notes:
 * - Exposes refreshAccessToken() and refreshAllTokens() for manual use if needed.
 * - Uses a single "refreshPromiseRef" to coalesce concurrent refresh attempts.
 */

const LS_TOKEN = 'token';
const LS_REFRESH = 'refresh_token';
const LS_USER = 'user';

// small buffer before expiry to attempt refresh (ms)
const REFRESH_BUFFER_MS = 60 * 1000; // 60 seconds

// decode JWT payload safely (browser)
function decodeJwt(token) {
  try {
    const parts = String(token || '').split('.');
    if (parts.length < 2) return null;
    // base64 decode (handle URL-safe chars)
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    // atob may produce binary string for unicode chars; try JSON.parse direct
    const json = atob(payload);
    try {
      return JSON.parse(json);
    } catch (err) {
      // fallback for possible unicode
      const decoded = decodeURIComponent(
        json
          .split('')
          .map(function (c) {
            const code = c.charCodeAt(0).toString(16).padStart(2, '0');
            return '%' + code;
          })
          .join('')
      );
      return JSON.parse(decoded);
    }
  } catch {
    return null;
  }
}

export default function AuthProvider({ children }) {
  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem(LS_TOKEN) || null;
    } catch {
      return null;
    }
  });
  const [refreshToken, setRefreshToken] = useState(() => {
    try {
      return localStorage.getItem(LS_REFRESH) || null;
    } catch {
      return null;
    }
  });
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem(LS_USER);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [ready, setReady] = useState(false);

  // refs for timers/interceptor/coalescing
  const refreshTimeoutRef = useRef(null);
  const refreshPromiseRef = useRef(null);
  const axiosResponseInterceptorRef = useRef(null);

  // keep axios default header in sync whenever token changes
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      try {
        localStorage.setItem(LS_TOKEN, token);
      } catch {}
    } else {
      delete axios.defaults.headers.common['Authorization'];
      try {
        localStorage.removeItem(LS_TOKEN);
      } catch {}
    }
    // schedule refresh whenever token changes
    scheduleTokenRefresh(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // keep refresh token in localStorage
  useEffect(() => {
    try {
      if (refreshToken) localStorage.setItem(LS_REFRESH, refreshToken);
      else localStorage.removeItem(LS_REFRESH);
    } catch {}
  }, [refreshToken]);

  // keep user in localStorage
  useEffect(() => {
    try {
      if (user) localStorage.setItem(LS_USER, JSON.stringify(user));
      else localStorage.removeItem(LS_USER);
    } catch {}
  }, [user]);

  // mark ready after mount (avoid immediate redirect race)
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 0);
    return () => clearTimeout(t);
  }, []);

  // Helper: schedule a refresh based on access token exp
  const scheduleTokenRefresh = (accessToken) => {
    // clear existing
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }
    if (!accessToken) return;

    const payload = decodeJwt(accessToken);
    if (!payload || !payload.exp) {
      // can't decode -> no scheduling
      return;
    }
    const expiresAtMs = payload.exp * 1000;
    const now = Date.now();
    let msUntilRefresh = expiresAtMs - now - REFRESH_BUFFER_MS;
    // if already expired or near-expiry, refresh immediately
    if (msUntilRefresh <= 0) msUntilRefresh = 0;

    refreshTimeoutRef.current = setTimeout(async () => {
      try {
        await refreshAccessToken();
      } catch (err) {
        // refresh failed -> logout
        console.warn('scheduled refresh failed, logging out', err);
        logout();
      }
    }, msUntilRefresh);
  };

  // Attempt to refresh only access token using refreshToken (/auth/access)
  const refreshAccessToken = useCallback(async () => {
    if (!refreshToken) {
      return false;
    }

    // coalesce concurrent refresh attempts
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    const p = (async () => {
      try {
        const res = await axios.post('http://localhost:3000/auth/access', { refreshToken });
        const newAccess = res.data?.access_token ?? null;
        if (!newAccess) {
          // treat as failure
          return false;
        }
        setToken(newAccess);
        axios.defaults.headers.common['Authorization'] = `Bearer ${newAccess}`;
        try {
          localStorage.setItem(LS_TOKEN, newAccess);
        } catch {}
        return true;
      } catch (err) {
        console.warn('refreshAccessToken failed, trying full refresh if available', err?.response?.data ?? err.message);
        // try full refresh flow as fallback
        const ok = await refreshAllTokens();
        return ok;
      } finally {
        // ensure promise ref cleared after completion
        refreshPromiseRef.current = null;
      }
    })();

    refreshPromiseRef.current = p;
    return p;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshToken]);

  // Full refresh (get new access + refresh token) endpoint (/auth/refresh)
  const refreshAllTokens = useCallback(async () => {
    if (!refreshToken) return false;
    try {
      const res = await axios.post('http://localhost:3000/auth/refresh', { refreshToken });
      const access_token = res.data?.access_token ?? null;
      const refresh_token = res.data?.refresh_token ?? null;
      if (!access_token || !refresh_token) return false;
      setToken(access_token);
      setRefreshToken(refresh_token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      try {
        localStorage.setItem(LS_TOKEN, access_token);
        localStorage.setItem(LS_REFRESH, refresh_token);
      } catch {}
      return true;
    } catch (err) {
      console.warn('refreshAllTokens failed', err?.response?.data ?? err.message);
      return false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshToken]);

  // login: set tokens and user (normalizes shape)
  const login = (userData, accessToken, maybeRefreshToken) => {
    if (!userData || !accessToken) {
      console.error('AuthProvider.login invalid args', { userData, accessToken });
      return false;
    }

    const normalizedUser = {
      id: userData.id ?? userData._id ?? null,
      username: userData.username ?? userData.userName ?? userData.name ?? null,
      __raw: userData,
    };

    setUser(normalizedUser);
    setToken(accessToken);
    if (maybeRefreshToken) setRefreshToken(maybeRefreshToken);

    axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
    try {
      localStorage.setItem(LS_TOKEN, accessToken);
      if (maybeRefreshToken) localStorage.setItem(LS_REFRESH, maybeRefreshToken);
      localStorage.setItem(LS_USER, JSON.stringify(normalizedUser));
    } catch (err) {
      console.warn('localStorage write failed', err?.message);
    }

    console.log('AuthProvider.login saved', normalizedUser);
    return true;
  };

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    setRefreshToken(null);
    delete axios.defaults.headers.common['Authorization'];
    try {
      localStorage.removeItem(LS_TOKEN);
      localStorage.removeItem(LS_REFRESH);
      localStorage.removeItem(LS_USER);
    } catch {}
    // clear scheduled refresh
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }
  }, []);

  // Setup axios response interceptor for auto-refresh on 401
  useEffect(() => {
    // remove existing interceptors if re-running
    if (axiosResponseInterceptorRef.current !== null) {
      axios.interceptors.response.eject(axiosResponseInterceptorRef.current);
      axiosResponseInterceptorRef.current = null;
    }

    const id = axios.interceptors.response.use(
      (resp) => resp,
      async (error) => {
        const originalRequest = error?.config;
        if (!originalRequest) return Promise.reject(error);

        // if we already retried, do not loop infinitely
        if (originalRequest._retry) {
          return Promise.reject(error);
        }

        const status = error?.response?.status;
        // only attempt refresh on 401 Unauthorized
        if (status === 401) {
          originalRequest._retry = true;
          try {
            const ok = await refreshAccessToken();
            if (ok) {
              // update header & retry original request
              originalRequest.headers['Authorization'] = `Bearer ${localStorage.getItem(LS_TOKEN) || token}`;
              return axios(originalRequest);
            }
          } catch (err) {
            console.warn('Auto refresh failed', err);
          }
          // refresh failed -> logout
          logout();
        }
        return Promise.reject(error);
      }
    );

    axiosResponseInterceptorRef.current = id;
    return () => {
      if (axiosResponseInterceptorRef.current !== null) {
        axios.interceptors.response.eject(axiosResponseInterceptorRef.current);
        axiosResponseInterceptorRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshAccessToken, token, logout]);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
      refreshPromiseRef.current = null;
      // eject axios interceptor if still set
      if (axiosResponseInterceptorRef.current !== null) {
        axios.interceptors.response.eject(axiosResponseInterceptorRef.current);
        axiosResponseInterceptorRef.current = null;
      }
    };
  }, []);

  const value = {
    user,
    token,
    ready,
    login,
    logout,
    refreshAccessToken,
    refreshAllTokens,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
