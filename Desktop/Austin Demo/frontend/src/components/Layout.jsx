import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Moon, Sun } from 'lucide-react';
import { Button } from './ui/button';

export default function Layout({ children, activePage, onPageChange }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <nav className="border-b bg-background fixed top-0 left-0 right-0 z-50 shadow-sm" style={{ height: '80px', minHeight: '80px', maxHeight: '80px', width: '100%', position: 'fixed', top: 0, left: 0, right: 0 }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8" style={{ height: '80px', minHeight: '80px', maxHeight: '80px' }}>
          <div className="flex items-center justify-between" style={{ height: '80px', minHeight: '80px', maxHeight: '80px' }}>
            <div className="flex-shrink-0">
              <h1 
                className="text-3xl font-bold tracking-tight gradient-text cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => onPageChange('dashboard')}
              >
                Tiberius
              </h1>
            </div>
            
            <div className="hidden md:flex flex-1 items-center justify-center gap-2">
              <Button
                variant={activePage === 'dashboard' ? 'default' : 'ghost'}
                size="lg"
                onClick={() => onPageChange('dashboard')}
                className="text-base px-6 py-3 rounded-full transition-colors duration-200"
                style={{ minWidth: '120px', width: '120px', height: '44px', maxWidth: '120px', maxHeight: '44px', minHeight: '44px', boxSizing: 'border-box' }}
              >
                Dashboard
              </Button>
              
              <Button
                variant={activePage === 'reporting' ? 'default' : 'ghost'}
                size="lg"
                onClick={() => onPageChange('reporting')}
                className="text-base px-6 py-3 rounded-full transition-colors duration-200"
                style={{ minWidth: '120px', width: '120px', height: '44px', maxWidth: '120px', maxHeight: '44px', minHeight: '44px', boxSizing: 'border-box' }}
              >
                Reporting
              </Button>
              
              <Button
                variant={activePage === 'history' ? 'default' : 'ghost'}
                size="lg"
                onClick={() => onPageChange('history')}
                className="text-base px-6 py-3 rounded-full transition-colors duration-200"
                style={{ minWidth: '120px', width: '120px', height: '44px', maxWidth: '120px', maxHeight: '44px', minHeight: '44px', boxSizing: 'border-box' }}
              >
                History
              </Button>
              
              <Button
                variant={activePage === 'management' ? 'default' : 'ghost'}
                size="lg"
                onClick={() => onPageChange('management')}
                className="text-base px-6 py-3 rounded-full transition-colors duration-200"
                style={{ minWidth: '120px', width: '120px', height: '44px', maxWidth: '120px', maxHeight: '44px', minHeight: '44px', boxSizing: 'border-box' }}
              >
                Management
              </Button>
              
              <Button
                variant={activePage === 'raw-data' ? 'default' : 'ghost'}
                size="lg"
                onClick={() => onPageChange('raw-data')}
                className="text-base px-6 py-3 rounded-full transition-colors duration-200"
                style={{ minWidth: '120px', width: '120px', height: '44px', maxWidth: '120px', maxHeight: '44px', minHeight: '44px', boxSizing: 'border-box' }}
              >
                Raw Data
              </Button>
            </div>

            <div className="flex items-center gap-3 flex-shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                className="h-10 w-10 rounded-full hover:bg-accent transition-colors"
              >
                {theme === 'light' ? (
                  <Moon className="h-5 w-5" />
                ) : (
                  <Sun className="h-5 w-5" />
                )}
              </Button>
              
              <div className="relative" ref={userMenuRef}>
                <Button
                  variant="ghost"
                  className="text-base px-4 py-2 rounded-full hover:bg-accent transition-colors"
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                >
                  <span className="hidden sm:inline">{user?.email}</span>
                  <span className="sm:hidden">User</span>
                </Button>
                {isUserMenuOpen && (
                  <div className="absolute top-full right-0 mt-2 bg-popover border rounded-xl shadow-elevated-lg z-50 min-w-[160px] overflow-hidden animate-in fade-in-0 zoom-in-95">
                    <div className="px-4 py-2 text-sm text-muted-foreground border-b">
                      {user?.email}
                    </div>
                    <button
                      className="w-full text-left px-4 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                      onClick={logout}
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10" style={{ paddingTop: '100px', minHeight: 'calc(100vh - 80px)', marginTop: 0 }}>
        <div className="w-full" style={{ minHeight: 'calc(100vh - 200px)' }}>
          {children}
        </div>
      </main>
    </div>
  );
}

