'use client';

import { useEffect, useState } from 'react';
import { C } from '@/lib/constants';

export function ReadingProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const fn = () => {
      const scrolled = window.scrollY;
      const total = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(total > 0 ? Math.min((scrolled / total) * 100, 100) : 0);
    };
    window.addEventListener('scroll', fn, { passive: true });
    fn();
    return () => window.removeEventListener('scroll', fn);
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 1001,
        height: 4,
        width: `${progress}%`,
        background: `linear-gradient(90deg, ${C.accent}, #F0824A)`,
        transition: 'width 0.08s linear',
        pointerEvents: 'none',
      }}
    >
      {/* Moving dot at leading edge */}
      {progress > 1 && progress < 99.5 && (
        <div
          style={{
            position: 'absolute',
            right: -5,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: C.accent,
            boxShadow: `0 0 8px ${C.accent}`,
          }}
        />
      )}
    </div>
  );
}
