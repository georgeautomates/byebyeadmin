'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import { CalendlyModal } from '@/components/CalendlyModal';

interface CalendlyContextType {
  openCalendly: () => void;
}

const CalendlyContext = createContext<CalendlyContextType>({ openCalendly: () => {} });

export function CalendlyProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <CalendlyContext.Provider value={{ openCalendly: () => setIsOpen(true) }}>
      {children}
      {isOpen && <CalendlyModal onClose={() => setIsOpen(false)} />}
    </CalendlyContext.Provider>
  );
}

export const useCalendly = () => useContext(CalendlyContext);
