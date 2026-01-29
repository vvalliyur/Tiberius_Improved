import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    // Only initialize if Supabase is configured
    if (!supabaseUrl || !supabaseAnonKey) {
      setLoading(false);
      return;
    }

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('Error getting session:', error);
        // Don't block the app if Supabase is misconfigured
        if (error.message && error.message.includes('Invalid API key')) {
          console.warn('Supabase API key may be invalid. Check your .env file.');
        }
        setLoading(false);
        return;
      }
      if (session) {
        setUser(session.user);
        setToken(session.access_token);
        localStorage.setItem('supabase_token', session.access_token);
      }
      setLoading(false);
    }).catch((err) => {
      console.error('Error in getSession:', err);
      // If it's a network error, the backend/Supabase might not be available
      if (err.message && (err.message.includes('Failed to fetch') || err.message.includes('NetworkError'))) {
        console.warn('Network error - Supabase may not be accessible. Check your connection and Supabase URL.');
      }
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // Suppress token refresh errors if Supabase is not properly configured
      if (event === 'TOKEN_REFRESHED' && !session) {
        console.warn('Token refresh failed - Supabase may not be configured correctly');
        return;
      }
      
      if (session) {
        setUser(session.user);
        setToken(session.access_token);
        localStorage.setItem('supabase_token', session.access_token);
        console.log('Auth state changed - Token stored:', session.access_token ? 'Yes' : 'No');
      } else {
        setUser(null);
        setToken(null);
        localStorage.removeItem('supabase_token');
        console.log('Auth state changed - User logged out');
      }
      setLoading(false);
    });

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  const login = (accessToken) => {
    console.log('Login called with token:', accessToken ? 'Token provided' : 'No token');
    setToken(accessToken);
    if (accessToken) {
      localStorage.setItem('supabase_token', accessToken);
      console.log('Token stored in localStorage');
    }
    supabase.auth.getUser().then(({ data: { user }, error }) => {
      if (error) {
        console.error('Error getting user:', error);
      } else {
        setUser(user);
        console.log('User set:', user?.email);
      }
    });
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Error signing out:', err);
    }
    setUser(null);
    setToken(null);
    localStorage.removeItem('supabase_token');
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

