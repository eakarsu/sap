import { useState } from 'react';
import { login } from '../api';
import { FiLogIn } from 'react-icons/fi';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await login(email, password);
      if (res && res.token) {
        localStorage.setItem('token', res.token);
        localStorage.setItem('user', JSON.stringify(res.user));
        onLogin(res.user);
      } else {
        setError((res && res.error) || 'Invalid credentials. Please try again.');
      }
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        {/* SAP Logo */}
        <div style={styles.logoContainer}>
          <svg width="100" height="50" viewBox="0 0 100 50">
            <rect x="0" y="0" width="100" height="50" rx="4" fill="#0070F2" />
            <text x="50" y="34" textAnchor="middle" fill="#fff" fontSize="24" fontWeight="bold" fontFamily="Arial, sans-serif">SAP</text>
          </svg>
        </div>

        <h1 style={styles.title}>SAP CRM</h1>
        <p style={styles.subtitle}>Customer Relationship Management</p>

        {error && (
          <div style={styles.errorBox}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
              style={styles.input}
            />
          </div>

          <div style={styles.fieldGroup}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              style={styles.input}
            />
          </div>

          <button
            type="button"
            onClick={() => { setEmail(import.meta.env.VITE_DEMO_EMAIL || ''); setPassword(import.meta.env.VITE_DEMO_PASSWORD || ''); }}
            disabled={!import.meta.env.VITE_DEMO_EMAIL || !import.meta.env.VITE_DEMO_PASSWORD}
            aria-label="Auto Fill Demo Credentials"
            style={{ width: '100%', marginBottom: '12px', padding: '10px 14px', borderRadius: '8px', border: '1px solid currentColor', background: 'transparent', cursor: 'pointer' }}
          >
            Auto Fill Demo Credentials
          </button>
          <button type="submit" disabled={loading} style={styles.loginBtn}>
            <FiLogIn style={{ marginRight: 8 }} />
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

        </form>

        <p style={styles.footer}>
          Powered by SAP Business Technology Platform
        </p>
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #354A5F 0%, #0070F2 100%)',
    padding: 20,
  },
  card: {
    background: '#fff',
    borderRadius: 12,
    padding: '48px 40px',
    width: '100%',
    maxWidth: 420,
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
    textAlign: 'center',
  },
  logoContainer: {
    marginBottom: 24,
  },
  title: {
    margin: 0,
    fontSize: 28,
    fontWeight: 700,
    color: '#1D2D3E',
    letterSpacing: '0.5px',
  },
  subtitle: {
    margin: '8px 0 32px',
    fontSize: 14,
    color: '#6A767D',
    letterSpacing: '0.3px',
  },
  errorBox: {
    background: '#FFF3F3',
    border: '1px solid #E74C3C',
    color: '#BB0000',
    borderRadius: 8,
    padding: '12px 16px',
    marginBottom: 20,
    fontSize: 13,
    textAlign: 'left',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  fieldGroup: {
    textAlign: 'left',
  },
  label: {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: '#354A5F',
    marginBottom: 6,
  },
  input: {
    width: '100%',
    padding: '12px 14px',
    fontSize: 14,
    border: '1px solid #D1D9E0',
    borderRadius: 8,
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box',
    background: '#F7F8FA',
  },
  loginBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '14px 20px',
    fontSize: 15,
    fontWeight: 600,
    color: '#fff',
    background: '#0070F2',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    transition: 'background 0.2s',
    marginTop: 4,
  },
  footer: {
    marginTop: 32,
    fontSize: 12,
    color: '#A0AAB4',
  },
};
