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
        // Don't block the app if Supabase is misconfigured
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
      // If it's a network error, the backend/Supabase might not be available
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // Suppress token refresh errors if Supabase is not properly configured
      if (event === 'TOKEN_REFRESHED' && !session) {
        return;
      }
      
      if (session) {
        setUser(session.user);
        setToken(session.access_token);
        localStorage.setItem('supabase_token', session.access_token);
      } else {
        setUser(null);
        setToken(null);
        localStorage.removeItem('supabase_token');
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
    setToken(accessToken);
    if (accessToken) {
      localStorage.setItem('supabase_token', accessToken);
    }
    supabase.auth.getUser().then(({ data: { user }, error }) => {
      if (!error) {
        setUser(user);
      }
    });
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      // Error handled silently
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

