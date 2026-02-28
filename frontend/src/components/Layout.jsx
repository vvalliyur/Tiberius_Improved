import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import {
  Moon,
  Sun,
  LayoutDashboard,
  BarChart3,
  Clock,
  Settings2,
  ShieldCheck,
  Database,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const NAV_ITEMS = [
  { key: 'dashboard',   label: 'Dashboard',  Icon: LayoutDashboard },
  { key: 'reporting',   label: 'Reporting',  Icon: BarChart3 },
  { key: 'history',     label: 'History',    Icon: Clock },
  { key: 'management',  label: 'Management', Icon: Settings2 },
  { key: 'check',       label: 'Check',      Icon: ShieldCheck },
  { key: 'raw-data',    label: 'Raw Data',   Icon: Database },
];

function getSidebarCollapsed() {
  try { return localStorage.getItem('sidebarCollapsed') === 'true'; }
  catch { return false; }
}

export default function Layout({ children, activePage, onPageChange }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(getSidebarCollapsed);

  const userInitial = user?.email ? user.email.charAt(0).toUpperCase() : 'U';

  const handleNavChange = (page) => {
    onPageChange(page);
    // Leave mobile menu open — user closes it explicitly by clicking outside
  };

  const handleToggleCollapse = () => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem('sidebarCollapsed', String(next)); } catch {}
      return next;
    });
  };

  const sidebarClass = [
    'sidebar',
    isSidebarCollapsed ? 'sidebar--collapsed' : '',
    isMobileMenuOpen ? 'sidebar--open' : '',
  ].filter(Boolean).join(' ');

  const mainClass = [
    'main-content',
    isSidebarCollapsed ? 'main-content--collapsed' : '',
  ].filter(Boolean).join(' ');

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'hsl(var(--background))' }}>

      {/* ── Mobile top bar (replaces floating button — shown only on ≤768px) ── */}
      <div className="mobile-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{
            width: 26, height: 26, borderRadius: 6, flexShrink: 0,
            background: 'linear-gradient(135deg, hsl(213 94% 46%) 0%, hsl(213 80% 55%) 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="13" height="13" viewBox="0 0 15 15" fill="none">
              <path d="M7.5 1L13.5 7.5L7.5 14L1.5 7.5L7.5 1Z" fill="white" fillOpacity="0.92"/>
            </svg>
          </div>
          <span style={{ fontSize: '0.9375rem', fontWeight: 600, letterSpacing: '-0.01em', color: 'hsl(var(--foreground))' }}>
            Tiberius
          </span>
        </div>
        <button
          className="mobile-topbar-btn"
          onClick={() => setIsMobileMenuOpen(v => !v)}
          aria-label="Toggle menu"
        >
          {isMobileMenuOpen ? <X size={17} /> : <Menu size={17} />}
        </button>
      </div>

      {/* ── Mobile nav dropdown (replaces slide-in sidebar on ≤768px) ── */}
      <div className={`mobile-nav-dropdown${isMobileMenuOpen ? ' mobile-nav-dropdown--open' : ''}`}>
        {NAV_ITEMS.map(({ key, label, Icon }) => (
          <button
            key={key}
            className={`mobile-nav-item${activePage === key ? ' active' : ''}`}
            onClick={() => handleNavChange(key)}
          >
            <Icon className="mobile-nav-item-icon" />
            <span>{label}</span>
          </button>
        ))}
        <div className="mobile-nav-divider" />
        <button
          className="mobile-nav-item"
          onClick={() => { toggleTheme(); setIsMobileMenuOpen(false); }}
        >
          {theme === 'light'
            ? <Moon className="mobile-nav-item-icon" />
            : <Sun  className="mobile-nav-item-icon" />}
          <span>{theme === 'light' ? 'Dark mode' : 'Light mode'}</span>
        </button>
        <div className="mobile-nav-divider" />
        <div className="mobile-nav-user-row">
          <div style={{
            width: 20, height: 20, borderRadius: '50%',
            backgroundColor: 'hsl(var(--primary))',
            color: 'hsl(var(--primary-foreground))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.5rem', fontWeight: 700, flexShrink: 0,
          }}>
            {userInitial}
          </div>
          <span>{user?.email || 'Account'}</span>
        </div>
        <button
          className="mobile-nav-item"
          onClick={() => { logout(); setIsMobileMenuOpen(false); }}
        >
          <span>Logout</span>
        </button>
      </div>

      {/* ── Mobile dropdown backdrop ── */}
      {isMobileMenuOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 58, top: 52 }}
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* ── Sidebar (desktop only — hidden on mobile via CSS) ── */}
      <aside className={sidebarClass}>

        {/* Logo + collapse toggle */}
        <div className="sidebar-logo">
          <div
            className="sidebar-logo-icon"
            onClick={() => handleNavChange('dashboard')}
            title="Dashboard"
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <path d="M7.5 1L13.5 7.5L7.5 14L1.5 7.5L7.5 1Z" fill="white" fillOpacity="0.92"/>
            </svg>
          </div>
          {!isSidebarCollapsed && (
            <span
              className="sidebar-logo-text"
              onClick={() => handleNavChange('dashboard')}
            >
              Tiberius
            </span>
          )}
          <button
            className="sidebar-collapse-btn"
            onClick={handleToggleCollapse}
            title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isSidebarCollapsed
              ? <ChevronRight size={12} />
              : <ChevronLeft size={12} />}
          </button>
        </div>

        {/* Nav */}
        <div className="sidebar-nav">
          {NAV_ITEMS.map(({ key, label, Icon }) => (
            <button
              key={key}
              className={`nav-item${activePage === key ? ' active' : ''}`}
              onClick={() => handleNavChange(key)}
              title={isSidebarCollapsed ? label : undefined}
            >
              <Icon className="nav-item-icon" />
              <span className="nav-item-label">{label}</span>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="sidebar-footer">
          <button
            className="nav-item"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            title={isSidebarCollapsed ? (theme === 'light' ? 'Dark mode' : 'Light mode') : undefined}
          >
            {theme === 'light'
              ? <Moon className="nav-item-icon" />
              : <Sun  className="nav-item-icon" />}
            <span className="nav-item-label nav-item-footer-label">
              {theme === 'light' ? 'Dark mode' : 'Light mode'}
            </span>
          </button>

          <div style={{ position: 'relative' }}>
            <button
              className="nav-item"
              onClick={() => setIsUserMenuOpen(v => !v)}
              title={isSidebarCollapsed ? (user?.email || 'Account') : undefined}
            >
              <div style={{
                width: 22, height: 22, borderRadius: '50%',
                backgroundColor: 'hsl(var(--primary))',
                color: 'hsl(var(--primary-foreground))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.5625rem', fontWeight: 700, flexShrink: 0,
                border: '1px solid hsl(var(--primary) / 0.3)',
              }}>
                {userInitial}
              </div>
              <span className="nav-item-label nav-item-footer-label" style={{
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                fontSize: '0.8125rem', flex: 1, textAlign: 'left',
              }}>
                {user?.email || 'Account'}
              </span>
            </button>

            {isUserMenuOpen && createPortal(
              <>
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
                  onClick={() => setIsUserMenuOpen(false)}
                />
                <div
                  className="animate-in"
                  style={{
                    position: 'fixed', bottom: 80, left: 12, width: 216,
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '0.625rem',
                    boxShadow: '0 4px 16px -4px rgba(0,0,0,0.12), 0 1px 4px -1px rgba(0,0,0,0.08)',
                    zIndex: 9999, overflow: 'hidden',
                  }}
                >
                  <div style={{
                    padding: '0.5rem 0.875rem',
                    fontSize: '0.75rem',
                    color: 'hsl(var(--muted-foreground))',
                    borderBottom: '1px solid hsl(var(--border))',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {user?.email}
                  </div>
                  <button
                    style={{
                      width: '100%', padding: '0.5rem 0.875rem',
                      textAlign: 'left', fontSize: '0.875rem',
                      color: 'hsl(var(--foreground))',
                      backgroundColor: 'transparent', border: 'none', cursor: 'pointer',
                    }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'hsl(var(--muted))'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    onClick={() => { logout(); setIsUserMenuOpen(false); }}
                  >
                    Logout
                  </button>
                </div>
              </>,
              document.body
            )}
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className={mainClass}>
        {children}
      </main>
    </div>
  );
}
