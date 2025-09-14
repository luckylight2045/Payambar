// src/components/Login.jsx
import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import useAuth from '../hooks/useAuth';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setError(null);

    if (!username.trim() || !password) {
      setError('Please enter username and password');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post('http://localhost:3000/users/login', { userName: username.trim(), password });
      const data = res?.data ?? {};

      const access_token = data.access_token ?? data.accessToken ?? data.token ?? null;
      const refresh_token = data.refresh_token ?? data.refreshToken ?? null;
      const userObj = data.user ?? data.userData ?? (data.username ? data : null) ?? data;

      if (!access_token || !userObj) {
        setError('Login failed: invalid server response');
        setLoading(false);
        return;
      }

      const normalizedUser = {
        id: userObj.id ?? userObj._id ?? null,
        username: userObj.username ?? userObj.userName ?? userObj.name ?? null,
        __raw: userObj,
      };

      // last fallback adjustments
      if (!normalizedUser.id) normalizedUser.id = userObj._id ?? userObj.id ?? null;
      if (!normalizedUser.username) normalizedUser.username = userObj.name ?? userObj.userName ?? userObj.username ?? null;

      const ok = login(normalizedUser, access_token, refresh_token);
      if (!ok) {
        setError('Login failed (client)');
        setLoading(false);
        return;
      }

      navigate('/chat', { replace: true });
    } catch (err) {
      console.error('Login error', err.response?.data ?? err.message ?? err);
      const msg = err.response?.data?.message ?? err.response?.data ?? err.message ?? 'Login failed';
      setError(String(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h2 style={styles.title}>Login</h2>

        <form onSubmit={handleLogin} style={styles.form}>
          <input
            autoFocus
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={styles.input}
            disabled={loading}
          />
          <input
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={styles.input}
            disabled={loading}
          />

          {error && <div style={styles.error}>{error}</div>}

          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button type="submit" style={styles.button} disabled={loading}>
              {loading ? 'Signing in…' : 'Login'}
            </button>
            <button
              type="button"
              style={styles.secondary}
              onClick={() => {
                setUsername('');
                setPassword('');
                setError(null);
              }}
              disabled={loading}
            >
              Clear
            </button>
          </div>
        </form>

        <p style={styles.footerText}>
          Don't have an account? <Link to="/signup" style={styles.link}>Signup</Link>
        </p>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(180deg,#071019,#051018)',
    padding: 20,
    boxSizing: 'border-box',
  },
  card: {
    width: 420,
    maxWidth: '95%',
    background: '#0b1420',
    borderRadius: 12,
    padding: 28,
    boxShadow: '0 8px 28px rgba(2,6,23,0.6)',
    color: '#e6eef6',
    border: '1px solid rgba(255,255,255,0.04)',
  },
  title: {
    margin: 0,
    marginBottom: 14,
    fontSize: 22,
    color: '#e6eef6',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  input: {
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.06)',
    background: 'rgba(255,255,255,0.02)',
    color: '#e6eef6',
    outline: 'none',
    fontSize: 14,
  },
  button: {
    background: 'linear-gradient(180deg,#2b6ef6,#1e4fd8)',
    color: 'white',
    padding: '10px 12px',
    borderRadius: 8,
    border: 'none',
    cursor: 'pointer',
    fontWeight: 600,
    flex: 1,
  },
  secondary: {
    background: 'transparent',
    color: '#9aa8b8',
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.04)',
    cursor: 'pointer',
    fontWeight: 500,
  },
  footerText: {
    marginTop: 14,
    fontSize: 13,
    color: '#9aa8b8',
  },
  link: {
    color: '#7fb1ff',
    textDecoration: 'underline',
  },
  error: {
    color: '#ffb4b4',
    fontSize: 13,
    background: 'rgba(255,180,180,0.03)',
    padding: '8px 10px',
    borderRadius: 8,
  },
};
