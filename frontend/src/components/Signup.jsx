import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';

export default function Signup() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [role, setRole] = useState('user');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleSignup = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setError(null);

    if (!username.trim() || !password || !phoneNumber.trim()) {
      setError('Please enter username, password and phone number');
      return;
    }

    setLoading(true);
    try {
      await axios.post('http://localhost:3000/users/signup', {
        name: username.trim(),
        password,
        phoneNumber: phoneNumber.trim(),
        role,
      });

      alert('Signup successful! Please login.');
      navigate('/login');
    } catch (err) {
      console.error('Signup failed', err.response?.data ?? err.message ?? err);
      const msg = err.response?.data?.message || err.response?.data || err.message || 'Signup failed';
      setError(String(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h2 style={styles.title}>Signup</h2>

        <form onSubmit={handleSignup} style={styles.form}>
          <input
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
          <input
            placeholder="Phone Number"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            style={styles.input}
            disabled={loading}
          />

          <select value={role} onChange={(e) => setRole(e.target.value)} style={styles.input} disabled={loading}>
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>

          {error && <div style={styles.error}>{error}</div>}

          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button type="submit" style={styles.button} disabled={loading}>
              {loading ? 'Signing up…' : 'Signup'}
            </button>
            <button
              type="button"
              style={styles.secondary}
              onClick={() => {
                setUsername('');
                setPassword('');
                setPhoneNumber('');
                setRole('user');
                setError(null);
              }}
              disabled={loading}
            >
              Clear
            </button>
          </div>
        </form>

        <p style={styles.footerText}>
          Already have an account? <Link to="/login" style={styles.link}>Login</Link>
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
