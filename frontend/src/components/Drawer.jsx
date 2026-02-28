import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import './Drawer.css';

export default function Drawer({ isOpen, onClose, title, children }) {
  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div 
        className="drawer-backdrop" 
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Drawer */}
      <div className={`drawer ${isOpen ? 'drawer-open' : ''}`}>
        <div className="drawer-header">
          <h2 className="drawer-title">{title}</h2>
          <button 
            className="drawer-close-button"
            onClick={onClose}
            aria-label="Close drawer"
          >
            <X className="drawer-close-icon" />
          </button>
        </div>
        <div className="drawer-content">
          {children}
        </div>
      </div>
    </>,
    document.body
  );
}

