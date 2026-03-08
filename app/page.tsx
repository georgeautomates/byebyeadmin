'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { HeroScroll } from '@/components/HeroScroll';
import { LoadingScreen } from '@/components/LoadingScreen';
import { AgentShowcaseScroll } from '@/components/AgentShowcaseScroll';
import { FAQSection } from '@/components/FAQSection';
import { DemosSection } from '@/components/DemosSection';
import { Fade, Btn, Section, H2, P, Tag } from '@/components/ui';
import { C, FONT } from '@/lib/constants';
import Link from 'next/link';
import { useCalendly } from '@/lib/calendly-context';

// Dynamic imports for canvas-heavy components (browser-only)
const CTAParticleCanvas = dynamic(
  () => import('@/components/CTAParticleCanvas').then((m) => m.CTAParticleCanvas),
  { ssr: false, loading: () => null }
);

// ── Typewriter one-liner ───────────────────────────────────────────────────────
const FULL_TEXT = 'We use AI automation to do your admin for you.';
// Split into plain + highlighted segments
const HIGHLIGHT_START = 'We use AI automation to do your ';
const HIGHLIGHT_WORD  = 'admin';
const HIGHLIGHT_END   = ' for you.';

function TypewriterOneLiner() {
  const [typed, setTyped] = useState('');
  const [done, setDone]   = useState(false);
  const ref               = useRef<HTMLDivElement>(null);
  const started           = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          observer.disconnect();
          let i = 0;
          const interval = setInterval(() => {
            i++;
            setTyped(FULL_TEXT.slice(0, i));
            if (i >= FULL_TEXT.length) {
              clearInterval(interval);
              setDone(true);
            }
          }, 38);
        }
      },
      { threshold: 0.4 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Render typed text with highlight on the "haulage admin" segment
  function renderTyped(t: string) {
    const hsLen = HIGHLIGHT_START.length;
    const hwLen = HIGHLIGHT_START.length + HIGHLIGHT_WORD.length;

    if (t.length <= hsLen) {
      return <>{t}</>;
    } else if (t.length <= hwLen) {
      return (
        <>
          {HIGHLIGHT_START}
          <span style={{ color: C.accent }}>{t.slice(hsLen)}</span>
        </>
      );
    } else {
      return (
        <>
          {HIGHLIGHT_START}
          <span style={{ color: C.accent }}>{HIGHLIGHT_WORD}</span>
          {t.slice(hwLen)}
        </>
      );
    }
  }

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline' }}>
      <style>{`
        @keyframes cursorBlink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }
      `}</style>
      {renderTyped(typed)}
      {!done && (
        <span
          style={{
            display: 'inline-block',
            width: 3,
            height: '0.85em',
            background: C.accent,
            marginLeft: 3,
            verticalAlign: 'middle',
            borderRadius: 1,
            animation: 'cursorBlink 0.7s step-end infinite',
          }}
        />
      )}
    </div>
  );
}

export default function HomePage() {
  const [heroReady, setHeroReady] = useState(false);
  const { openCalendly } = useCalendly();

  return (
    <div>
      <LoadingScreen loaded={heroReady} />

      {/* ── 3D scroll-driven hero (500vh tall) ── */}
      <HeroScroll onReady={() => setHeroReady(true)} />

      {/* ── One-liner clarity statement ── */}
      <div style={{
        background: C.bgWhite,
        borderTop: `1px solid ${C.border}`,
        borderBottom: `2px solid ${C.border}`,
      }}>
        <div
          style={{
            padding: '68px 5% 48px',
            textAlign: 'left',
          }}
        >
          <div style={{ marginBottom: 10 }}>
            <Tag>What we do</Tag>
          </div>
          <p
            style={{
              fontFamily: FONT,
              fontSize: 'clamp(1.65rem, 4.2vw, 2.6rem)',
              fontWeight: 900,
              color: C.text,
              lineHeight: 1.25,
              letterSpacing: '-0.02em',
              margin: '0 0 12px',
            }}
          >
            <TypewriterOneLiner />
          </p>
          <p style={{
            fontFamily: FONT,
            fontSize: 'clamp(0.78rem, 1.6vw, 0.9rem)',
            color: C.textMid,
            margin: 0,
            fontWeight: 400,
          }}>
            No new software to learn. No extra headcount. Just less admin.
          </p>
        </div>
      </div>

      {/* ── Agent showcase — 400vh sticky scroll ── */}
      <AgentShowcaseScroll />

      {/* ── Demos ── */}
      <DemosSection />

      {/* ── FAQ section ── */}
      <FAQSection />

      {/* ── Final CTA — dark with particle convergence canvas ── */}
      <div data-section="cta" style={{ background: C.bgDark, position: 'relative', overflow: 'hidden' }}>
        {/* Particle convergence background */}
        <CTAParticleCanvas />

        <Section dark style={{ textAlign: 'center', paddingBottom: 100, position: 'relative', zIndex: 1 }}>
          <Fade>
            <h2
              style={{
                fontFamily: FONT,
                fontSize: 'clamp(1.6rem, 5vw, 2.2rem)',
                fontWeight: 900,
                color: '#F5F2EF',
                margin: '0 0 32px',
              }}
            >
              Find out how much this could save your fleet.
              <span style={{ display: 'block', color: C.accent }}>Five minutes. Free.</span>
            </h2>
            <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href="/assessment">
                <Btn primary>Take the Free Assessment →</Btn>
              </Link>
              <Btn onClick={openCalendly} style={{ color: '#F5F2EF', borderColor: 'rgba(245,242,239,0.3)' }}>Book a 15-Minute Call</Btn>
            </div>
          </Fade>
        </Section>
      </div>
    </div>
  );
}
