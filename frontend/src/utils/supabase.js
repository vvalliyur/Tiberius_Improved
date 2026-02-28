import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Create client with fallback values to prevent crashes
// The app will show an error message if these aren't set properly
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : createClient('https://placeholder.supabase.co', 'placeholder-key');

// Helper function to check if input is an email
const isEmail = (input) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
};

// Sign in with either email or username
export const signInWithEmailOrUsername = async (identifier, password) => {
  if (isEmail(identifier)) {
    // If it's an email, use standard email auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email: identifier,
      password,
    });
    return { data, error };
  } else {
    // If it's a username, look up the email via backend endpoint
    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const response = await fetch(
        `${API_BASE_URL}/auth/lookup-email?username=${encodeURIComponent(identifier)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        // If backend is not available, return a helpful error
        if (response.status === 0 || response.type === 'opaque') {
          return {
            data: null,
            error: { message: 'Cannot connect to server. Please make sure the backend is running on http://localhost:8000' },
          };
        }
        const errorData = await response.json().catch(() => ({}));
        return {
          data: null,
          error: { message: errorData.detail || 'Invalid username or password' },
        };
      }

      const { email } = await response.json();

      // Now sign in with the found email
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { data, error };
    } catch (err) {
      // Network error - backend likely not running
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        return {
          data: null,
          error: { message: 'Cannot connect to server. Please make sure the backend is running on http://localhost:8000' },
        };
      }
      return {
        data: null,
        error: { message: 'Failed to look up username. Please try again.' },
      };
    }
  }
};


