/* eslint-disable no-empty */
// src/contexts/AuthProvider.jsx
import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import AuthContext from './AuthContext';

/**
 * AuthProvider
 * - Keeps axios.defaults.headers.common['Authorization'] in sync
 * - Persists token, refresh_token, user to localStorage
 * - Exposes `ready` flag to avoid route-redirect races
 */
export default function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('token') || null);
  const [refreshToken, setRefreshToken] = useState(() => localStorage.getItem('refresh_token') || null);
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem('user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      try { localStorage.setItem('token', token); } catch {}
    } else {
      delete axios.defaults.headers.common['Authorization'];
      try { localStorage.removeItem('token'); } catch {}
    }
  }, [token]);

  useEffect(() => {
    try {
      if (refreshToken) localStorage.setItem('refresh_token', refreshToken);
      else localStorage.removeItem('refresh_token');
    } catch {}
  }, [refreshToken]);

  useEffect(() => {
    try {
      if (user) localStorage.setItem('user', JSON.stringify(user));
      else localStorage.removeItem('user');
    } catch {}
  }, [user]);

  // mark ready after mount (avoid immediate redirect race)
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 0);
    return () => clearTimeout(t);
  }, []);

  const refreshAccessToken = useCallback(async () => {
    if (!refreshToken) return false;
    try {
      const res = await axios.post('http://localhost:3000/auth/access', { refreshToken });
      const newAccess = res.data?.access_token;
      if (!newAccess) return false;
      setToken(newAccess);
      axios.defaults.headers.common['Authorization'] = `Bearer ${newAccess}`;
      try { localStorage.setItem('token', newAccess); } catch {}
      return true;
    } catch (err) {
      console.warn('refreshAccessToken failed', err?.response?.data ?? err.message);
      return false;
    }
  }, [refreshToken]);

  const refreshAllTokens = useCallback(async () => {
    if (!refreshToken) return false;
    try {
      const res = await axios.post('http://localhost:3000/auth/refresh', { refreshToken });
      const { access_token, refresh_token } = res.data ?? {};
      if (!access_token || !refresh_token) return false;
      setToken(access_token);
      setRefreshToken(refresh_token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      try {
        localStorage.setItem('token', access_token);
        localStorage.setItem('refresh_token', refresh_token);
      } catch {}
      return true;
    } catch (err) {
      console.warn('refreshAllTokens failed', err?.response?.data ?? err.message);
      return false;
    }
  }, [refreshToken]);

  const login = (userData, accessToken, maybeRefreshToken) => {
    if (!userData || !accessToken) {
      console.error('AuthProvider.login invalid args', { userData, accessToken });
      return false;
    }

    // normalize user shape
    const normalizedUser = {
      id: userData.id ?? userData._id ?? null,
      username: userData.username ?? userData.userName ?? userData.name ?? null,
      __raw: userData,
    };

    setUser(normalizedUser);
    setToken(accessToken);
    if (maybeRefreshToken) setRefreshToken(maybeRefreshToken);

    // immediate side-effects to avoid race
    axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
    try {
      localStorage.setItem('token', accessToken);
      if (maybeRefreshToken) localStorage.setItem('refresh_token', maybeRefreshToken);
      localStorage.setItem('user', JSON.stringify(normalizedUser));
    } catch (err) {
      console.warn('localStorage write failed', err?.message);
    }

    console.log('AuthProvider.login saved', normalizedUser);
    return true;
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setRefreshToken(null);
    delete axios.defaults.headers.common['Authorization'];
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
    } catch {}
  };

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
