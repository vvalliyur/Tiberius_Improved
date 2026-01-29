import { useState } from 'react';
import { supabase, signInWithEmailOrUsername, signUpWithEmailOrUsername } from '../utils/supabase';
import './Login.css';

export default function Login({ onLogin }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (isSignUp) {
        // For signup, require email and optionally username
        if (!identifier.includes('@')) {
          setError('Please use your email address to sign up');
          return;
        }

        const { data, error: signUpError } = await signUpWithEmailOrUsername(
          identifier,
          password,
          username || null
        );

        if (signUpError) throw signUpError;

        if (data.user && !data.session) {
          setMessage('Check your email to confirm your account!');
        } else if (data.session) {
          // If we have a username, create the mapping
          if (username) {
            try {
              const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
              await fetch(`${API_BASE_URL}/auth/create-username`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${data.session.access_token}`,
                },
                body: JSON.stringify({ username }),
              });
            } catch (err) {
              console.warn('Failed to create username mapping:', err);
            }
          }
          onLogin(data.session.access_token);
        }
      } else {
        // For signin, can use either email or username
        const { data, error: signInError } = await signInWithEmailOrUsername(
          identifier,
          password
        );

        if (signInError) throw signInError;

        if (data.session) {
          onLogin(data.session.access_token);
        }
      }
    } catch (err) {
      // Provide more helpful error messages
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
    <div className="login-container">
      <div className="login-card">
        <h1>Poker Accounting System</h1>
        <h2>{isSignUp ? 'Sign Up' : 'Sign In'}</h2>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="identifier">
              {isSignUp ? 'Email' : 'Email or Username'}
            </label>
            <input
              id="identifier"
              type={isSignUp ? 'email' : 'text'}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              placeholder={isSignUp ? 'your.email@example.com' : 'email@example.com or username'}
              disabled={loading}
            />
          </div>

          {isSignUp && (
            <div className="form-group">
              <label htmlFor="username">Username (optional)</label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Choose a username"
                disabled={loading}
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter your password"
              disabled={loading}
              minLength={6}
            />
          </div>

          {error && <div className="error-message">{error}</div>}
          {message && <div className="success-message">{message}</div>}

          <button type="submit" disabled={loading} className="submit-button">
            {loading ? 'Loading...' : isSignUp ? 'Sign Up' : 'Sign In'}
          </button>
        </form>

        <div className="login-footer">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
              setMessage(null);
            }}
            className="toggle-button"
            disabled={loading}
          >
            {isSignUp
              ? 'Already have an account? Sign In'
              : "Don't have an account? Sign Up"}
          </button>
        </div>
      </div>
    </div>
  );
}

