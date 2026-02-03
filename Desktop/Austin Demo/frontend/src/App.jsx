import { useState, useLayoutEffect, useRef, useEffect } from 'react';
import { useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import Login from './components/Login';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import RawData from './pages/RawData';
import Management from './pages/Management';
import AgentReports from './pages/AgentReports';
import History from './pages/History';
import Check from './pages/Check';

function App() {
  const { user, token, loading: authLoading } = useAuth();
  const [activePage, setActivePage] = useState('dashboard');
  const prevPageRef = useRef(activePage);

  // Lock scroll position during page transitions
  useLayoutEffect(() => {
    if (prevPageRef.current !== activePage) {
      // Lock body scroll
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
      
      // Reset scroll position
      window.scrollTo(0, 0);
      
      // Unlock after a frame
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          document.body.style.position = '';
          document.body.style.top = '';
          document.body.style.width = '';
          document.body.style.overflow = '';
          window.scrollTo(0, 0);
        });
      });
      
      prevPageRef.current = activePage;
    }
  }, [activePage]);

  // Ensure scroll is at top on mount and page changes
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activePage]);

  const handlePageChange = (page) => {
    setActivePage(page);
  };

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="bg-background p-8 rounded-lg border max-w-lg">
          <h2 className="text-2xl font-bold text-destructive mb-4">Configuration Error</h2>
          <p className="text-muted-foreground mb-4">
            Missing Supabase environment variables. Please create a <code>.env</code> file in the frontend directory with:
          </p>
          <pre className="bg-muted p-4 rounded overflow-auto text-sm">
{`VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key`}
          </pre>
          <p className="text-muted-foreground mt-4 text-sm">
            After adding the variables, restart the dev server.
          </p>
        </div>
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="spinner"></div>
        <p className="ml-4">Loading...</p>
      </div>
    );
  }

  if (!user || !token) {
    return <Login />;
  }

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':
        return <Dashboard />;
      case 'raw-data':
        return <RawData />;
      case 'reporting':
        return <AgentReports />;
      case 'management':
        return <Management />;
      case 'history':
        return <History />;
      case 'check':
        return <Check />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <ThemeProvider>
      <Layout activePage={activePage} onPageChange={handlePageChange}>
        {renderPage()}
      </Layout>
    </ThemeProvider>
  );
}

export default App;
