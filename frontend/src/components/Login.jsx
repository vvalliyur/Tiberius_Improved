import { useState } from 'react';
import { signInWithEmailOrUsername } from '../utils/supabase';

export default function Login({ onLogin }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error: signInError } = await signInWithEmailOrUsername(
        identifier,
        password
      );

      if (signInError) throw signInError;

      if (data.session) {
        onLogin(data.session.access_token);
      }
    } catch (err) {
      if (err.message && (err.message.includes('Failed to fetch') || err.message.includes('NetworkError'))) {
        setError('Cannot connect to server. Please make sure the backend is running on http://localhost:8000');
      } else if (err.message && err.message.includes('Invalid API key')) {
        setError('Supabase configuration error. Please check your environment variables.');
      } else {
        setError(err.message || 'An error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'hsl(var(--background))',
        padding: '2rem',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '380px',
          background: 'hsl(var(--card))',
          border: '1px solid hsl(var(--border))',
          borderRadius: '1rem',
          boxShadow: '0 4px 24px -4px rgb(0 0 0 / 0.1)',
          padding: '2rem',
        }}
      >
        {/* Logo + brand */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: 'hsl(var(--primary))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 0.875rem',
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M5 12l4.5 4.5L19 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1
            style={{
              fontSize: '1.25rem',
              fontWeight: 600,
              color: 'hsl(var(--foreground))',
              margin: 0,
              letterSpacing: '-0.01em',
            }}
          >
            Tiberius
          </h1>
          <p
            style={{
              fontSize: '0.875rem',
              color: 'hsl(var(--muted-foreground))',
              margin: '0.25rem 0 0',
            }}
          >
            Welcome back
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label
              htmlFor="identifier"
              style={{
                display: 'block',
                fontSize: '0.8125rem',
                fontWeight: 500,
                color: 'hsl(var(--foreground))',
                marginBottom: '0.375rem',
              }}
            >
              Email or Username
            </label>
            <input
              id="identifier"
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              placeholder="email or username"
              disabled={loading}
              style={{
                width: '100%',
                height: '2.25rem',
                padding: '0 0.75rem',
                fontSize: '0.875rem',
                border: '1px solid hsl(var(--border))',
                borderRadius: '0.5rem',
                background: 'hsl(var(--background))',
                color: 'hsl(var(--foreground))',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 150ms ease',
              }}
              onFocus={e => e.target.style.borderColor = 'hsl(var(--primary))'}
              onBlur={e => e.target.style.borderColor = 'hsl(var(--border))'}
            />
          </div>

          <div>
            <label
              htmlFor="password"
              style={{
                display: 'block',
                fontSize: '0.8125rem',
                fontWeight: 500,
                color: 'hsl(var(--foreground))',
                marginBottom: '0.375rem',
              }}
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter your password"
              disabled={loading}
              minLength={6}
              style={{
                width: '100%',
                height: '2.25rem',
                padding: '0 0.75rem',
                fontSize: '0.875rem',
                border: '1px solid hsl(var(--border))',
                borderRadius: '0.5rem',
                background: 'hsl(var(--background))',
                color: 'hsl(var(--foreground))',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 150ms ease',
              }}
              onFocus={e => e.target.style.borderColor = 'hsl(var(--primary))'}
              onBlur={e => e.target.style.borderColor = 'hsl(var(--border))'}
            />
          </div>

          {error && (
            <div
              style={{
                borderLeft: '3px solid hsl(var(--destructive))',
                background: 'hsl(var(--destructive) / 0.05)',
                padding: '0.625rem 0.75rem',
                borderRadius: '0 0.375rem 0.375rem 0',
                fontSize: '0.8125rem',
                color: 'hsl(var(--destructive))',
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              height: '2.25rem',
              background: 'hsl(var(--primary))',
              color: 'hsl(var(--primary-foreground))',
              border: 'none',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              transition: 'opacity 150ms ease',
              marginTop: '0.25rem',
            }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
