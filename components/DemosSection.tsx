'use client';

import { useEffect, useRef, useState } from 'react';
import { Fade, Section, H2, P, Tag } from '@/components/ui';
import { C, FONT, MONO } from '@/lib/constants';

interface Demo {
  id: string;
  title: string;
  thumbnail: string;
}

const DRIFT_WORDS = [
  { w: 'POD', l: '8%', dur: '24s', del: '0s' },
  { w: 'CMR', l: '18%', dur: '31s', del: '4s' },
  { w: 'manifest', l: '30%', dur: '22s', del: '8s' },
  { w: 'invoice', l: '42%', dur: '28s', del: '2s' },
  { w: 'driver log', l: '55%', dur: '26s', del: '11s' },
  { w: 'DVSA', l: '65%', dur: '33s', del: '6s' },
  { w: 'consignment', l: '74%', dur: '20s', del: '14s' },
  { w: 'tachograph', l: '84%', dur: '29s', del: '3s' },
  { w: 'VAT return', l: '12%', dur: '25s', del: '16s' },
  { w: 'hire & reward', l: '48%', dur: '30s', del: '9s' },
  { w: 'delivery note', l: '90%', dur: '23s', del: '7s' },
  { w: 'job sheet', l: '36%', dur: '27s', del: '13s' },
];

export function DemosSection() {
  const [demos, setDemos] = useState<Demo[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [arrowHover, setArrowHover] = useState<'left' | 'right' | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    fetch('/api/demos')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setDemos(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const updateArrows = () => {
    const el = containerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  };

  useEffect(() => {
    const frame = requestAnimationFrame(updateArrows);
    return () => cancelAnimationFrame(frame);
  }, [demos]);

  const scrollBy = (dir: 1 | -1) => {
    const el = containerRef.current;
    if (!el) return;
    const card = el.querySelector('[data-card]') as HTMLElement | null;
    const amount = card ? card.offsetWidth + 20 : 260;
    el.scrollBy({ left: dir * amount, behavior: 'smooth' });
  };

  useEffect(() => {
    if (!activeId) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setActiveId(null); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [activeId]);

  const ArrowBtn = ({ dir, visible }: { dir: 'left' | 'right'; visible: boolean }) => {
    const hovered = arrowHover === dir;
    return (
      <button
        onClick={() => scrollBy(dir === 'left' ? -1 : 1)}
        onMouseEnter={() => setArrowHover(dir)}
        onMouseLeave={() => setArrowHover(null)}
        aria-label={dir === 'left' ? 'Previous' : 'Next'}
        style={{
          position: 'absolute',
          top: '42%',
          [dir]: -18,
          transform: 'translateY(-50%)',
          zIndex: 2,
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: hovered ? C.accent : 'rgba(255,255,255,0.1)',
          border: `1px solid ${hovered ? C.accent : 'rgba(255,255,255,0.2)'}`,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: '1.15rem',
          opacity: visible ? 1 : 0,
          pointerEvents: visible ? 'auto' : 'none',
          transition: 'opacity 0.2s ease, background 0.2s ease, border-color 0.2s ease',
        }}
      >
        {dir === 'left' ? '‹' : '›'}
      </button>
    );
  };

  return (
    <div style={{ background: C.bgDark, position: 'relative', overflow: 'hidden' }}>

      {/* Section divider from AgentShowcase */}
      <div style={{ height: 1, background: 'rgba(232,97,45,0.25)', position: 'relative', zIndex: 1 }} />

      {/* Grid background */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
        backgroundImage: `linear-gradient(rgba(45,139,139,0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(45,139,139,0.04) 1px, transparent 1px)`,
        backgroundSize: '48px 48px',
      }} />

      {/* Radial vignette */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: 'radial-gradient(ellipse at center, transparent 30%, rgba(31,41,55,0.75) 100%)',
      }} />

      {/* Floating ambient word field */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
        {DRIFT_WORDS.map(({ w, l, dur, del }) => (
          <span
            key={w}
            style={{
              position: 'absolute',
              bottom: '5%',
              left: l,
              fontFamily: MONO,
              fontSize: '0.58rem',
              color: `rgba(232,97,45,0.18)`,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              animation: `demoWordDrift ${dur} linear ${del} infinite`,
              whiteSpace: 'nowrap',
            }}
          >
            {w}
          </span>
        ))}
      </div>

      {/* Bottom fade into next section */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 80,
        background: `linear-gradient(to bottom, transparent, ${C.bg})`,
        pointerEvents: 'none', zIndex: 1,
      }} />

      <Section style={{ paddingTop: 'clamp(60px, 8vw, 100px)', position: 'relative', zIndex: 2 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <Fade>
            <Tag>Demos</Tag>
            <div style={{ marginTop: 16 }}>
              <H2 dark>Watch the automations in action</H2>
            </div>
          </Fade>
          <Fade delay={0.05}>
            <P style={{ color: 'rgba(245,242,239,0.65)', marginBottom: 20 }}>
              Short clips showing exactly what each agent does.
            </P>
          </Fade>
        </div>

        {/* Carousel */}
        <Fade delay={0.15}>
          <div style={{ position: 'relative', margin: '0 auto', maxWidth: 860 }}>
            <span className="demo-arrows">
              <ArrowBtn dir="left" visible={canScrollLeft} />
              <ArrowBtn dir="right" visible={canScrollRight} />
            </span>

            <div
              ref={containerRef}
              onScroll={updateArrows}
              className="demo-scroll"
              style={{
                display: 'flex',
                gap: 20,
                overflowX: 'scroll',
                scrollSnapType: 'x mandatory',
                padding: '8px 4px 80px',
              }}
            >
              {loading
                ? [0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      style={{
                        flex: '0 0 auto',
                        width: 'clamp(160px, 26vw, 240px)',
                        aspectRatio: '9/16',
                        background: 'rgba(255,255,255,0.06)',
                        borderRadius: 12,
                        animation: 'pulse 1.6s ease-in-out infinite',
                        animationDelay: `${i * 0.15}s`,
                      }}
                    />
                  ))
                : demos.map((demo, i) => (
                    <button
                      key={demo.id}
                      data-card
                      onClick={() => setActiveId(demo.id)}
                      onMouseEnter={() => setHoveredId(demo.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      style={{
                        flex: '0 0 auto',
                        width: 'clamp(160px, 26vw, 240px)',
                        scrollSnapAlign: 'start',
                        border: 'none',
                        background: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      {/* Card */}
                      <div
                        style={{
                          position: 'relative',
                          aspectRatio: '9/16',
                          borderRadius: 12,
                          overflow: 'hidden',
                          transform: hoveredId === demo.id ? 'scale(1.03)' : 'scale(1)',
                          boxShadow: hoveredId === demo.id
                            ? '0 0 0 1px rgba(232,97,45,0.35), 0 0 32px rgba(232,97,45,0.2), 0 16px 48px rgba(0,0,0,0.5)'
                            : '0 4px 24px rgba(0,0,0,0.35)',
                          transition: 'transform 0.2s ease, box-shadow 0.25s ease',
                        }}
                      >
                        <img
                          src={demo.thumbnail}
                          alt={demo.title}
                          style={{
                            width: '100%', height: '100%',
                            objectFit: 'cover', objectPosition: 'center top',
                            display: 'block',
                          }}
                        />

                        {/* Play button overlay */}
                        <div style={{
                          position: 'absolute', inset: 0,
                          background: hoveredId === demo.id ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.1)',
                          transition: 'background 0.2s ease',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <div style={{
                            width: 48, height: 48, borderRadius: '50%',
                            background: C.accent,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            opacity: hoveredId === demo.id ? 1 : 0.8,
                            transform: hoveredId === demo.id ? 'scale(1.12)' : 'scale(1)',
                            transition: 'opacity 0.2s ease, transform 0.2s ease',
                            boxShadow: hoveredId === demo.id ? `0 0 20px rgba(232,97,45,0.5)` : 'none',
                          }}>
                            <span style={{ color: '#fff', fontSize: '1.1rem', marginLeft: 3, lineHeight: 1 }}>▶</span>
                          </div>
                        </div>

                        {/* Title overlay */}
                        <div style={{
                          position: 'absolute', bottom: 0, left: 0, right: 0,
                          background: isMobile ? 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.6) 50%, rgba(0,0,0,0.15) 75%, transparent 100%)' : 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.45) 55%, transparent 100%)',
                          padding: isMobile ? '56px 12px 14px' : '44px 12px 14px',
                          pointerEvents: 'none',
                        }}>
                          <div style={{
                            fontFamily: MONO, fontSize: '0.58rem',
                            color: C.accent, letterSpacing: '0.14em',
                            textTransform: 'uppercase', marginBottom: 4,
                          }}>
                            {String(i + 1).padStart(2, '0')}
                          </div>
                          <div style={{
                            fontFamily: FONT, fontWeight: 700,
                            fontSize: '0.9rem', color: '#fff',
                            lineHeight: 1.35,
                            textShadow: isMobile ? '0 1px 6px rgba(0,0,0,0.7)' : 'none',
                          }}>
                            {demo.title}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
            </div>
          </div>
        </Fade>

        {!loading && demos.length === 0 && (
          <P style={{ color: 'rgba(245,242,239,0.5)', textAlign: 'center' }}>No demos available yet.</P>
        )}
      </Section>

      {/* Lightbox modal */}
      {activeId && (
        <div
          onClick={() => setActiveId(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.92)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <button
            onClick={() => setActiveId(null)}
            aria-label="Close video"
            style={{
              position: 'fixed', top: 20, right: 24,
              background: 'none', border: 'none',
              color: '#fff', fontSize: '2.2rem',
              cursor: 'pointer', lineHeight: 1, zIndex: 10000, opacity: 0.85,
            }}
          >
            ×
          </button>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ height: '88vh', aspectRatio: '9/16', borderRadius: 12, overflow: 'hidden' }}
          >
            <iframe
              src={`https://www.youtube.com/embed/${activeId}?autoplay=1&rel=0`}
              allow="autoplay; encrypted-media; fullscreen"
              allowFullScreen
              style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
            />
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
        @keyframes demoWordDrift {
          0%   { opacity: 0; transform: translateY(0); }
          15%  { opacity: 1; }
          80%  { opacity: 1; }
          100% { opacity: 0; transform: translateY(-130px); }
        }
        @keyframes demoPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%      { opacity: 0.45; transform: scale(0.75); }
        }
        .demo-scroll {
          scrollbar-width: none;
        }
        .demo-scroll::-webkit-scrollbar {
          display: none;
        }
        @media (hover: none) {
          .demo-arrows { display: none; }
        }
      `}</style>
    </div>
  );
}
