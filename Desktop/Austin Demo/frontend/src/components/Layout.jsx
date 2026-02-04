import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Moon, Sun } from 'lucide-react';
import { Button } from './ui/button';

export default function Layout({ children, activePage, onPageChange }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuButtonRef = useRef(null);
  const dropdownRef = useRef(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });

  const updateDropdownPosition = () => {
    if (userMenuButtonRef.current) {
      const buttonRect = userMenuButtonRef.current.getBoundingClientRect();
      const scrollY = window.scrollY;
      const scrollX = window.scrollX;
      
      setDropdownPosition({
        top: buttonRect.bottom + scrollY + 8,
        right: window.innerWidth - buttonRect.right - scrollX,
      });
    }
  };

  useEffect(() => {
    if (isUserMenuOpen) {
      updateDropdownPosition();
      
      const handleScroll = () => updateDropdownPosition();
      const handleResize = () => updateDropdownPosition();
      
      window.addEventListener('scroll', handleScroll, true);
      window.addEventListener('resize', handleResize);
      
      return () => {
        window.removeEventListener('scroll', handleScroll, true);
        window.removeEventListener('resize', handleResize);
      };
    }
  }, [isUserMenuOpen]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        userMenuButtonRef.current &&
        !userMenuButtonRef.current.contains(event.target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target)
      ) {
        setIsUserMenuOpen(false);
      }
    };

    if (isUserMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isUserMenuOpen]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <nav 
        className="nav-bar"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          width: '100%',
          height: '100px',
          zIndex: 50,
          backgroundColor: 'hsl(var(--background))',
          borderBottom: '1px solid hsl(var(--border))',
          boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)',
        }}
      >
        <div 
          className="nav-container"
          style={{
            maxWidth: '1280px',
            margin: '0 auto',
            padding: '0 1rem',
            height: '100px',
          }}
        >
          <div 
            className="nav-content"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              height: '100px',
              gap: '2rem',
            }}
          >
            <div 
              className="nav-logo" 
              onClick={() => onPageChange('dashboard')}
              style={{
                flexShrink: 0,
                cursor: 'pointer',
                height: '100px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <img 
                src="/logo.png" 
                alt="Tiberius Accounting"
                style={{
                  height: '100px',
                  width: 'auto',
                  objectFit: 'contain',
                }}
              />
            </div>
            
            <div 
              className="nav-links"
              style={{
                alignItems: 'center',
                gap: '0.5rem',
                flex: 1,
                justifyContent: 'center',
              }}
            >
              <button
                className={`nav-link ${activePage === 'dashboard' ? 'active' : ''}`}
                onClick={() => onPageChange('dashboard')}
              >
                Dashboard
              </button>
              <button
                className={`nav-link ${activePage === 'reporting' ? 'active' : ''}`}
                onClick={() => onPageChange('reporting')}
              >
                Reporting
              </button>
              <button
                className={`nav-link ${activePage === 'history' ? 'active' : ''}`}
                onClick={() => onPageChange('history')}
              >
                History
              </button>
              <button
                className={`nav-link ${activePage === 'management' ? 'active' : ''}`}
                onClick={() => onPageChange('management')}
              >
                Management
              </button>
              <button
                className={`nav-link ${activePage === 'check' ? 'active' : ''}`}
                onClick={() => onPageChange('check')}
              >
                Check
              </button>
              <button
                className={`nav-link ${activePage === 'raw-data' ? 'active' : ''}`}
                onClick={() => onPageChange('raw-data')}
              >
                Raw Data
              </button>
            </div>

            <div 
              className="nav-actions"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                flexShrink: 0,
              }}
            >
              <button
                className="nav-action-icon"
                onClick={toggleTheme}
                aria-label="Toggle theme"
              >
                {theme === 'light' ? <Moon className="icon" /> : <Sun className="icon" />}
              </button>
              <button
                ref={userMenuButtonRef}
                className="nav-action-user"
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                aria-label="User menu"
              >
                <div className="user-avatar">
                  {user?.email ? user.email.charAt(0).toUpperCase() : 'U'}
                </div>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="main-content">
        {children}
      </main>

      {isUserMenuOpen && createPortal(
        <div
          ref={dropdownRef}
          className="fixed bg-popover border rounded-xl shadow-elevated-lg z-[9999] min-w-[160px] overflow-hidden animate-in fade-in-0 zoom-in-95"
          style={{
            top: `${dropdownPosition.top}px`,
            right: `${dropdownPosition.right}px`,
          }}
        >
          <div className="px-4 py-2 text-sm text-muted-foreground border-b">
            {user?.email}
          </div>
          <button
            className="w-full text-left px-4 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
            onClick={() => {
              logout();
              setIsUserMenuOpen(false);
            }}
          >
            Logout
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}

