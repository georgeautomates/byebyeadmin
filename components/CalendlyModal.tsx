'use client';

import { useEffect } from 'react';
import { C } from '@/lib/constants';

export function CalendlyModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handler);
    };
  }, [onClose]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0,0,0,0.72)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '8px 12px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 'min(96vw, 1020px)',
          display: 'flex',
          flexDirection: 'column',
          height: 'min(92vh, 820px)',
          flexShrink: 0,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button row — sits above the iframe so it never overlaps Calendly's UI */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            height: 36,
            flexShrink: 0,
          }}
        >
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'rgba(255,255,255,0.15)',
              border: 'none',
              cursor: 'pointer',
              fontSize: '1.4rem',
              lineHeight: 1,
              color: '#fff',
              padding: '8px 14px',
              borderRadius: 6,
            }}
          >
            ×
          </button>
        </div>
        {/* Calendly iframe */}
        <div
          style={{
            flex: 1,
            background: '#fff',
            borderRadius: 12,
            overflow: 'hidden',
          }}
        >
          <iframe
            src="https://calendly.com/george-byebyeadmin/30min"
            style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
            title="Book a 30-minute call with George"
          />
        </div>
      </div>
    </div>
  );
}
