import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Moon, Sun } from 'lucide-react';
import { Button } from './ui/button';

export default function Layout({ children, activePage, onPageChange }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isManagementOpen, setIsManagementOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const managementRef = useRef(null);
  const userMenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (managementRef.current && !managementRef.current.contains(event.target)) {
        setIsManagementOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-20 items-center justify-between">
            <div className="flex-shrink-0">
              <h1 className="text-3xl font-bold tracking-tight gradient-text">Tiberius</h1>
            </div>
            
            <div className="hidden md:flex flex-1 items-center justify-center gap-2">
              <Button
                variant={activePage === 'dashboard' ? 'default' : 'ghost'}
                size="lg"
                onClick={() => onPageChange('dashboard')}
                className="text-base px-6 py-3 rounded-full transition-all duration-200"
              >
                Dashboard
              </Button>
              
              <Button
                variant={activePage === 'reporting' ? 'default' : 'ghost'}
                size="lg"
                onClick={() => onPageChange('reporting')}
                className="text-base px-6 py-3 rounded-full transition-all duration-200"
              >
                Reporting
              </Button>
              
              <div className="relative" ref={managementRef}>
                <Button
                  variant={activePage === 'agents' || activePage === 'players' ? 'default' : 'ghost'}
                  size="lg"
                  onClick={() => setIsManagementOpen(!isManagementOpen)}
                  className="text-base px-6 py-3 rounded-full transition-all duration-200"
                >
                  Management
                </Button>
                {isManagementOpen && (
                  <div className="absolute top-full left-0 mt-2 bg-popover border rounded-xl shadow-elevated-lg z-50 min-w-[180px] overflow-hidden animate-in fade-in-0 zoom-in-95">
                    <button
                      className="w-full text-left px-6 py-3 text-base hover:bg-accent hover:text-accent-foreground transition-colors"
                      onClick={() => {
                        onPageChange('agents');
                        setIsManagementOpen(false);
                      }}
                    >
                      Agents
                    </button>
                    <button
                      className="w-full text-left px-6 py-3 text-base hover:bg-accent hover:text-accent-foreground transition-colors border-t"
                      onClick={() => {
                        onPageChange('players');
                        setIsManagementOpen(false);
                      }}
                    >
                      Players
                    </button>
                  </div>
                )}
              </div>
              
              <Button
                variant={activePage === 'history' ? 'default' : 'ghost'}
                size="lg"
                onClick={() => onPageChange('history')}
                className="text-base px-6 py-3 rounded-full transition-all duration-200"
              >
                History
              </Button>
              
              <Button
                variant={activePage === 'audit' ? 'default' : 'ghost'}
                size="lg"
                onClick={() => onPageChange('audit')}
                className="text-base px-6 py-3 rounded-full transition-all duration-200"
              >
                Audit
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

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        {children}
      </main>
    </div>
  );
}

