'use client';

import { useEffect, useState, ReactNode, createContext, useContext } from 'react';
import { usePathname } from 'next/navigation';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const LenisContext = createContext<{ lenis: Lenis | null }>({ lenis: null });

export function useLenis() {
  return useContext(LenisContext);
}

export function LenisProvider({ children }: { children: ReactNode }) {
  const [lenis, setLenis] = useState<Lenis | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (lenis) lenis.scrollTo(0, { immediate: true });
  }, [pathname, lenis]);

  useEffect(() => {
    const l = new Lenis({
      duration: 1.2,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    });

    setLenis(l);

    // Critical: connect Lenis to GSAP ScrollTrigger
    l.on('scroll', ScrollTrigger.update);

    gsap.ticker.add((time) => {
      l.raf(time * 1000);
    });
    gsap.ticker.lagSmoothing(0);

    return () => {
      l.destroy();
      setLenis(null);
    };
  }, []);

  return (
    <LenisContext.Provider value={{ lenis }}>
      {children}
    </LenisContext.Provider>
  );
}
