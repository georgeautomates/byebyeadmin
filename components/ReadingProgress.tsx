'use client';

import { useEffect, useState } from 'react';
import { C } from '@/lib/constants';

export function ReadingProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const fn = () => {
      const scrolled = window.scrollY;
      const total = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(total > 0 ? (scrolled / total) * 100 : 0);
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
        height: 3,
        width: `${progress}%`,
        background: C.accent,
        transition: 'width 0.08s linear',
        pointerEvents: 'none',
      }}
    />
  );
}
