'use client';

import { useState, useEffect, useRef, ReactNode, CSSProperties } from 'react';
import { C, FONT, MONO } from '@/lib/constants';

// ─── Fade-in on scroll ───────────────────────────────────────────────────────

function useFade() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.08 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return [ref, visible] as const;
}

export function Fade({
  children,
  delay = 0,
  style = {},
}: {
  children: ReactNode;
  delay?: number;
  style?: CSSProperties;
}) {
  const [ref, visible] = useFade();
  return (
    <div
      ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
        transition: `opacity 0.6s ease ${delay}s, transform 0.6s ease ${delay}s`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ─── Animated counter ────────────────────────────────────────────────────────

export function Counter({
  end,
  suffix = '',
  prefix = '',
  label,
  dur = 2200,
}: {
  end: number;
  suffix?: string;
  prefix?: string;
  label: string;
  dur?: number;
}) {
  const [count, setCount] = useState(0);
  const [ref, visible] = useFade();
  useEffect(() => {
    if (!visible) return;
    let s = 0;
    const step = Math.ceil(end / (dur / 16));
    const t = setInterval(() => {
      s += step;
      if (s >= end) { setCount(end); clearInterval(t); }
      else setCount(s);
    }, 16);
    return () => clearInterval(t);
  }, [visible, end, dur]);
  return (
    <div ref={ref} style={{ textAlign: 'center' }}>
      <div style={{ fontFamily: FONT, fontSize: '2.8rem', fontWeight: 800, color: C.accent, lineHeight: 1 }}>
        {prefix}{count.toLocaleString()}{suffix}
      </div>
      <div style={{ fontSize: '0.78rem', color: C.textDim, marginTop: 10, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>
        {label}
      </div>
    </div>
  );
}

// ─── Button ──────────────────────────────────────────────────────────────────

export function Btn({
  children,
  primary,
  teal: isTeal,
  onClick,
  style: s = {},
  type = 'button',
}: {
  children: ReactNode;
  primary?: boolean;
  teal?: boolean;
  onClick?: () => void;
  style?: CSSProperties;
  type?: 'button' | 'submit';
}) {
  const [hovered, setHovered] = useState(false);
  const bg = isTeal
    ? (hovered ? '#267878' : C.teal)
    : primary
    ? (hovered ? C.accentHover : C.accent)
    : 'transparent';
  const color = primary || isTeal ? '#FFFFFF' : C.accent;
  const border = primary || isTeal ? 'none' : `2px solid ${C.accent}`;
  return (
    <button
      type={type}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      style={{
        background: bg,
        color,
        border,
        fontFamily: FONT,
        fontSize: 'clamp(0.88rem, 2.5vw, 0.95rem)',
        padding: 'clamp(11px, 3vw, 14px) clamp(20px, 5vw, 32px)',
        minHeight: '44px',
        borderRadius: 8,
        cursor: 'pointer',
        fontWeight: 700,
        letterSpacing: '0.01em',
        transition: 'all 0.2s ease',
        transform: hovered ? 'translateY(-1px)' : 'none',
        boxShadow: hovered
          ? primary
            ? '0 6px 20px rgba(232,97,45,0.25)'
            : isTeal
            ? '0 6px 20px rgba(45,139,139,0.25)'
            : 'none'
          : 'none',
        ...s,
      }}
    >
      {children}
    </button>
  );
}

// ─── Layout primitives ───────────────────────────────────────────────────────

export function Section({
  children,
  style = {},
  dark,
}: {
  children: ReactNode;
  style?: CSSProperties;
  dark?: boolean;
}) {
  return (
    <section
      style={{
        padding: 'clamp(40px, 6vw, 80px) clamp(16px, 5vw, 24px)',
        maxWidth: 880,
        margin: '0 auto',
        ...(dark ? { color: '#F5F2EF' } : {}),
        ...style,
      }}
    >
      {children}
    </section>
  );
}

export function Card({
  children,
  style = {},
  accent,
}: {
  children: ReactNode;
  style?: CSSProperties;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        background: C.bgCard,
        border: `1px solid ${accent ? C.accentBorder : C.border}`,
        borderRadius: 12,
        padding: '28px 24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function TealCard({ children, style = {} }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ background: C.tealDim, border: `1px solid ${C.tealBorder}`, borderRadius: 12, padding: '28px 24px', ...style }}>
      {children}
    </div>
  );
}

export function Divider() {
  return <div style={{ height: 1, background: C.borderLight, margin: '56px auto', maxWidth: 200 }} />;
}

export function Tag({ children, teal: isTeal }: { children: ReactNode; teal?: boolean }) {
  const color = isTeal ? C.teal : C.accent;
  const bg = isTeal ? C.tealDim : C.accentDim;
  return (
    <span style={{ fontFamily: FONT, fontSize: '0.72rem', letterSpacing: '0.1em', textTransform: 'uppercase', color, background: bg, padding: '5px 14px', borderRadius: 6, display: 'inline-block', fontWeight: 700 }}>
      {children}
    </span>
  );
}

export function Quote({ children }: { children: ReactNode }) {
  return (
    <blockquote style={{ borderLeft: `3px solid ${C.teal}`, paddingLeft: 24, margin: '28px 0', color: C.textMid, fontStyle: 'italic', fontSize: '1.05rem', lineHeight: 1.7 }}>
      {children}
    </blockquote>
  );
}

// ─── Typography ──────────────────────────────────────────────────────────────

export function H2({
  children,
  sub,
  dark,
}: {
  children: ReactNode;
  sub?: string;
  dark?: boolean;
}) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h2 style={{ fontFamily: FONT, fontSize: 'clamp(1.5rem, 5vw, 2rem)', fontWeight: 800, color: dark ? '#F5F2EF' : C.text, lineHeight: 1.2, margin: 0 }}>
        {children}
      </h2>
      {sub && <p style={{ color: dark ? 'rgba(245,242,239,0.7)' : C.textMid, fontSize: '1.05rem', marginTop: 10, lineHeight: 1.6 }}>{sub}</p>}
    </div>
  );
}

export function P({
  children,
  style = {},
  dark,
}: {
  children: ReactNode;
  style?: CSSProperties;
  dark?: boolean;
}) {
  return (
    <p style={{ color: dark ? 'rgba(245,242,239,0.75)' : C.textMid, fontSize: '1.02rem', lineHeight: 1.75, margin: '14px 0', ...style }}>
      {children}
    </p>
  );
}

export function Strong({ children }: { children: ReactNode }) {
  return <span style={{ color: C.text, fontWeight: 700 }}>{children}</span>;
}

export function Acc({ children }: { children: ReactNode }) {
  return <span style={{ color: C.accent, fontWeight: 700 }}>{children}</span>;
}

export function Mono({ children }: { children: ReactNode }) {
  return (
    <span style={{ fontFamily: MONO, fontSize: '0.88rem', color: C.teal, background: C.tealDim, padding: '2px 8px', borderRadius: 4 }}>
      {children}
    </span>
  );
}
