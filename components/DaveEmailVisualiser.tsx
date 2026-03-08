'use client';

import { useEffect, useRef, useState } from 'react';
import { C, FONT, MONO } from '@/lib/constants';

/**
 * DaveEmailVisualiser
 *
 * 4-phase animation showing how the AI reads "Dave's email":
 *   Phase 0 → dormant
 *   Phase 1 → email text types in (typewriter)
 *   Phase 2 → orange parse bar sweeps across
 *   Phase 3 → teal field highlights appear (staggered)
 *   Phase 4 → parsed card slides in from right
 */

const EMAIL_TEXT = 'hi can u do the usual for wensday but not the chicken this time cheers dave';

// Fields highlighted and their positions in the email string
const FIELDS = [
  { label: 'Customer', value: 'Dave',    start: 71, end: 75, color: C.accent },
  { label: 'Route',    value: 'Usual',   start: 16, end: 22, color: C.teal   },
  { label: 'Day',      value: 'Wed',     start: 27, end: 35, color: C.accent },
  { label: 'Exclude',  value: 'Chicken', start: 45, end: 52, color: C.teal   },
];

export function DaveEmailVisualiser() {
  const ref = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState(0);
  const [typedLength, setTypedLength] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => { setIsMobile(window.innerWidth < 768); }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && phase === 0) {
          // Start phase 1 — typewriter
          setPhase(1);
        }
      },
      { threshold: 0.4 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [phase]);

  // Typewriter effect
  useEffect(() => {
    if (phase !== 1) return;
    if (typedLength >= EMAIL_TEXT.length) {
      // Done typing → phase 2
      timerRef.current = setTimeout(() => setPhase(2), 300);
      return;
    }
    timerRef.current = setTimeout(() => {
      setTypedLength((n) => n + 1);
    }, 28);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [phase, typedLength]);

  // Phase 2 → 3 → 4 with delays
  useEffect(() => {
    if (phase === 2) {
      timerRef.current = setTimeout(() => setPhase(3), 900);
    } else if (phase === 3) {
      timerRef.current = setTimeout(() => setPhase(4), 1400);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [phase]);

  // Render email text with highlights (phase 3+)
  function renderEmail() {
    if (phase < 1) return null;
    const text = EMAIL_TEXT.slice(0, typedLength);

    if (phase < 3) {
      return (
        <span style={{ color: 'rgba(245,242,239,0.85)' }}>
          {text}
          {phase === 1 && (
            <span style={{
              display: 'inline-block',
              width: 2,
              height: '1.1em',
              background: C.accent,
              marginLeft: 2,
              verticalAlign: 'text-bottom',
              animation: 'typewriterCursor 0.8s step-end infinite',
            }} />
          )}
        </span>
      );
    }

    // Phase 3+: highlight specific ranges
    const parts: React.ReactNode[] = [];
    let cursor = 0;
    const sortedFields = [...FIELDS].sort((a, b) => a.start - b.start);

    sortedFields.forEach((f, idx) => {
      if (cursor < f.start) {
        parts.push(
          <span key={`plain-${idx}`} style={{ color: 'rgba(245,242,239,0.7)' }}>
            {EMAIL_TEXT.slice(cursor, f.start)}
          </span>
        );
      }
      const fieldIdx = FIELDS.indexOf(f);
      parts.push(
        <span
          key={f.label}
          style={{
            background: `${f.color}22`,
            border: `1px solid ${f.color}55`,
            borderRadius: 4,
            padding: '1px 4px',
            color: f.color,
            fontWeight: 700,
            animation: `fieldHighlightIn 0.35s ease ${fieldIdx * 0.18}s both`,
          }}
        >
          {EMAIL_TEXT.slice(f.start, f.end)}
        </span>
      );
      cursor = f.end;
    });

    if (cursor < EMAIL_TEXT.length) {
      parts.push(
        <span key="plain-end" style={{ color: 'rgba(245,242,239,0.7)' }}>
          {EMAIL_TEXT.slice(cursor)}
        </span>
      );
    }

    return <>{parts}</>;
  }

  return (
    <div
      ref={ref}
      style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
        gap: 24,
        maxWidth: 780,
        margin: '0 auto',
      }}
    >
      {/* Left: raw email */}
      <div
        style={{
          background: 'rgba(11,17,32,0.95)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 12,
          padding: '20px 22px',
          position: 'relative',
          overflow: 'hidden',
          minHeight: 160,
        }}
      >
        {/* Email header bar */}
        <div style={{
          display: 'flex',
          gap: 6,
          marginBottom: 14,
          paddingBottom: 14,
          borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}>
          {['#FF5F57','#FEBC2E','#28C840'].map((c) => (
            <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c, opacity: 0.7 }} />
          ))}
          <span style={{ fontFamily: MONO, fontSize: '0.62rem', color: 'rgba(255,255,255,0.3)', marginLeft: 8 }}>
            inbox · dave@daves-haulage.co.uk
          </span>
        </div>

        {/* Email subject */}
        <div style={{
          fontFamily: MONO,
          fontSize: '0.65rem',
          color: 'rgba(255,255,255,0.25)',
          marginBottom: 12,
          letterSpacing: '0.04em',
        }}>
          Subject: (no subject)
        </div>

        {/* Email body — typewriter */}
        <p style={{
          fontFamily: MONO,
          fontSize: '0.88rem',
          lineHeight: 1.7,
          margin: 0,
          minHeight: 60,
        }}>
          {renderEmail()}
        </p>

        {/* Parse sweep bar (phase 2) */}
        {phase === 2 && (
          <div style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            width: '30%',
            background: `linear-gradient(90deg, transparent, ${C.accent}22, transparent)`,
            animation: 'parseSweep 0.85s ease forwards',
            pointerEvents: 'none',
          }} />
        )}

        {/* AI label */}
        <div style={{
          marginTop: 14,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          opacity: phase >= 2 ? 1 : 0,
          transition: 'opacity 0.4s ease',
        }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.teal, boxShadow: `0 0 8px ${C.teal}` }} />
          <span style={{ fontFamily: MONO, fontSize: '0.6rem', color: C.teal, letterSpacing: '0.08em' }}>
            AI AGENT READING...
          </span>
        </div>
      </div>

      {/* Right: parsed result card (phase 4) */}
      <div
        style={{
          background: C.bgWhite,
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          padding: '20px 22px',
          opacity: phase >= 4 ? 1 : 0,
          transform: phase >= 4 ? 'translateX(0)' : 'translateX(40px)',
          transition: 'opacity 0.5s ease, transform 0.5s ease',
          minHeight: 160,
        }}
      >
        {/* Card header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          paddingBottom: 12,
          borderBottom: `1px solid ${C.border}`,
        }}>
          <span style={{ fontFamily: FONT, fontSize: '0.72rem', fontWeight: 800, color: C.text, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Parsed Order
          </span>
          <span style={{
            fontFamily: MONO,
            fontSize: '0.58rem',
            background: `${C.teal}15`,
            color: C.teal,
            border: `1px solid ${C.teal}30`,
            borderRadius: 4,
            padding: '2px 8px',
            fontWeight: 700,
          }}>
            3.2s
          </span>
        </div>

        {/* Parsed fields */}
        {FIELDS.map((f, i) => (
          <div
            key={f.label}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '7px 0',
              borderBottom: i < FIELDS.length - 1 ? `1px solid ${C.borderLight}` : 'none',
              opacity: phase >= 4 ? 1 : 0,
              transition: `opacity 0.35s ease ${i * 0.1 + 0.2}s`,
            }}
          >
            <span style={{ fontFamily: FONT, fontSize: '0.75rem', color: C.textDim, fontWeight: 600 }}>
              {f.label}
            </span>
            <span style={{
              fontFamily: FONT,
              fontSize: '0.82rem',
              fontWeight: 800,
              color: f.color,
            }}>
              {f.value}
            </span>
          </div>
        ))}

        {/* Confidence score */}
        <div style={{
          marginTop: 14,
          padding: '10px 14px',
          background: `${C.teal}0D`,
          border: `1px solid ${C.teal}22`,
          borderRadius: 8,
          opacity: phase >= 4 ? 1 : 0,
          transition: 'opacity 0.4s ease 0.6s',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: MONO, fontSize: '0.62rem', color: C.teal, letterSpacing: '0.06em' }}>CONFIDENCE</span>
            <span style={{ fontFamily: FONT, fontSize: '0.9rem', fontWeight: 900, color: C.teal }}>97.4%</span>
          </div>
          <div style={{ marginTop: 6, height: 4, background: 'rgba(45,139,139,0.15)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: phase >= 4 ? '97.4%' : '0%',
              background: C.teal,
              borderRadius: 2,
              transition: 'width 0.8s ease 0.7s',
            }} />
          </div>
        </div>
      </div>
    </div>
  );
}
