'use client';

import { forwardRef, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { C, FONT } from '@/lib/constants';
import Link from 'next/link';
import { useCalendly } from '@/lib/calendly-context';

// Dynamic import — WebGL must not run on the server
const ThreeHero = dynamic(
  () => import('./ThreeHero').then((m) => m.ThreeHero),
  { ssr: false, loading: () => null }
);

gsap.registerPlugin(ScrollTrigger);

// ── 6 scroll acts matching the 6 camera acts in ThreeHero ────────────────────
interface Act {
  id: string;
  badge?: string;
  headline: string;
  highlight: string;
  sub: string;
  show: [number, number]; // [start, end] as fraction of 0–1
  showCTA?: boolean;
  lightBg?: boolean;     // true = renders on light background phase (acts 3-5)
  label: string;         // short label shown in progress bar tooltip on hover
}

const ACTS: Act[] = [
  {
    id: 'act-0',
    badge: 'For UK Haulage Operators · 3–100 Vehicles',
    headline: 'Your back office is the hardest-working part of your fleet.',
    highlight: 'And it\u2019s done manually.',
    sub: 'Orders typed by hand. Invoices chased. Portals checked every hour. That\u2019s about to change.',
    show: [0, 0.15],
    lightBg: true,
    label: 'The Problem',
  },
  {
    id: 'act-1',
    headline: 'You didn\u2019t get into haulage',
    highlight: 'to do data entry.',
    sub: 'But right now, data entry is running your office. Someone\u2019s typing every order by hand. Matching PODs at the end of the week. Logging into eight portals a day just to check nothing\u2019s been missed.',
    show: [0.17, 0.32],
    lightBg: true,
    label: 'The Reality',
  },
  {
    id: 'act-2',
    headline: 'Software was supposed to handle this.',
    highlight: 'It just moved the admin around.',
    sub: 'New system to manage. Data to keep clean. Staff to train on it. The jobs still got typed in by hand, just into a different screen. That\u2019s not a solution. That\u2019s a new problem.',
    show: [0.34, 0.49],
    lightBg: true,
    label: 'Software Fails',
  },
  {
    id: 'act-3',
    headline: 'AI automation does your admin for you. It\u2019s not software you work in.',
    highlight: 'It\u2019s software that does the work.',
    sub: 'It reads the emails. Matches the PODs. Checks the portals. Raises the invoices. Not a new screen to manage. Just the jobs, done. And it learns your operation as it goes: Mark\u2019s shorthand, Dave\u2019s usual order, the quirks only your team know.',
    show: [0.51, 0.66],
    lightBg: true,
    label: 'The Solution',
  },
  {
    id: 'act-4',
    headline: 'What would you do with',
    highlight: '60 hours a month back?',
    sub: 'Orders processed before you get in. Invoices out same day. Compliance green without anyone touching it. Your admin person doing work that actually needs a person.',
    show: [0.68, 0.83],
    lightBg: true,
    label: 'The Payoff',
  },
  {
    id: 'act-5',
    headline: 'We set it up.',
    highlight: 'You say bye-bye admin.',
    sub: 'No enterprise budget. No IT department. No big switch. We run it alongside your operation until you\u2019re confident it works, then it goes live.',
    show: [0.85, 1.0],
    showCTA: true,
    lightBg: true,
    label: 'Get Started',
  },
];

// ── Main component ────────────────────────────────────────────────────────────
export function HeroScroll({ onReady }: { onReady?: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const actRefs = useRef<(HTMLDivElement | null)[]>([]);
  const scrollIndicatorRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [currentAct, setCurrentAct] = useState(0);
  const [barOpacity, setBarOpacity] = useState(1);
  const { openCalendly } = useCalendly();
  // Always light scene — no dark phase
  const lightPhase = true;

  const scrollToAct = (actIndex: number) => {
    const container = containerRef.current;
    if (!container) return;
    const act = ACTS[actIndex];
    // Scroll 40% into the act's show range so text is fully faded in and visible
    const progress = act.show[0] + (act.show[1] - act.show[0]) * 0.4;
    const targetY = container.offsetTop + progress * container.offsetHeight;
    window.scrollTo({ top: targetY, behavior: 'smooth' });
  };

  useEffect(() => {
    setIsMobile(window.innerWidth < 768);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const mobile = window.innerWidth < 768;

    // Initialise all acts invisible
    actRefs.current.forEach((el) => {
      if (el) gsap.set(el, { opacity: 0, y: 36 });
    });
    // First act starts visible
    if (actRefs.current[0]) gsap.set(actRefs.current[0], { opacity: 1, y: 0 });

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: containerRef.current,
          start: 'top top',
          end: 'bottom bottom',
          scrub: mobile ? 1.0 : 2.5,
        },
      });

      const FADE = 0.055; // fade duration in timeline units (no overlap possible)

      // Act 0 starts visible — only needs a fade-out
      const el0 = actRefs.current[0];
      if (el0) {
        tl.to(el0, { opacity: 0, y: -24, duration: FADE, ease: 'power2.in' }, ACTS[0].show[1] - FADE);
      }

      // Scroll indicator fades out as Act 0 exits
      const elInd = scrollIndicatorRef.current;
      if (elInd) {
        tl.to(elInd, { opacity: 0, duration: FADE, ease: 'power2.in' }, ACTS[0].show[1] - FADE);
      }

      // Track current act for route progress bar
      ScrollTrigger.create({
        trigger: containerRef.current,
        start: 'top top',
        end: 'bottom bottom',
        onUpdate: (self) => {
          const p = self.progress;
          let active = 0;
          ACTS.forEach((act, i) => { if (p >= act.show[0]) active = i; });
          setCurrentAct(active);
          // Fade bar out over the last 10% of the hero scroll
          setBarOpacity(p > 0.90 ? Math.max(0, 1 - (p - 0.90) / 0.10) : 1);
        },
      });

      // Acts 1–5: explicit fromTo so bidirectional scrub is clean
      ACTS.slice(1).forEach((act, idx) => {
        const i = idx + 1;
        const el = actRefs.current[i];
        if (!el) return;
        const isLastAct = i === ACTS.length - 1;
        const [start, end] = [
          mobile && isLastAct ? 0.75 : act.show[0],
          act.show[1],
        ];

        tl.fromTo(
          el,
          { opacity: 0, y: 36 },
          { opacity: 1, y: 0, duration: FADE, ease: 'power2.out' },
          start
        );
        if (i < ACTS.length - 1) {
          tl.to(el, { opacity: 0, y: -24, duration: FADE, ease: 'power2.in' }, end - FADE);
        }
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  // Gradient values that transition with lightPhase
  const leftVignette = lightPhase
    ? 'linear-gradient(to right, rgba(245,242,239,0.90) 0%, rgba(245,242,239,0.65) 45%, rgba(245,242,239,0.15) 65%, transparent 100%)'
    : 'linear-gradient(to right, rgba(15,20,25,0.88) 0%, rgba(15,20,25,0.72) 40%, rgba(15,20,25,0.20) 65%, transparent 100%)';
  const edgeVignette = lightPhase
    ? 'radial-gradient(ellipse at center, transparent 40%, rgba(245,242,239,0.45) 100%)'
    : 'radial-gradient(ellipse at center, transparent 40%, rgba(15,20,25,0.55) 100%)';
  const bottomFade = lightPhase
    ? `linear-gradient(to bottom, transparent, ${C.bgWhite})`
    : 'linear-gradient(to bottom, transparent, #0F1419)';

  return (
    // 500vh desktop / 550vh mobile — extra height ensures Act 5 has ~88vh dwell before section ends
    <div ref={containerRef} style={{ position: 'relative', height: isMobile ? '550vh' : '500vh' }}>

      {/* Route progress bar — sticky sibling, outside overflow:hidden viewport */}
      <div
        style={{
          position: 'sticky',
          top: 76,
          height: 0,
          zIndex: 100,
          opacity: barOpacity,
          pointerEvents: barOpacity < 0.05 ? 'none' : 'auto',
          transition: 'opacity 0.1s ease',
        }}
      >
        <RouteProgressBar currentAct={currentAct} onActClick={scrollToAct} />
      </div>

      {/* Sticky viewport */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          height: '100dvh',
          overflow: 'hidden',
          background: '#0F1419',
        }}
      >
        {/* Three.js hero — lorry on curved route with 6-act camera */}
        <ThreeHero containerRef={containerRef} onReady={onReady} />

        {/* Left-side gradient vignette — transitions dark→light with scroll */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: leftVignette,
            transition: 'background 1.2s ease',
            zIndex: 3,
            pointerEvents: 'none',
          }}
        />

        {/* Edge vignette for overall depth */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: edgeVignette,
            transition: 'background 1.2s ease',
            zIndex: 2,
            pointerEvents: 'none',
          }}
        />

        {/* Text acts — left-aligned at ~8% from left */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            paddingLeft: '8%',
          }}
        >
          {ACTS.map((act, i) => {
            const textColor = act.lightBg ? '#1e1e1e' : '#F5F2EF';
            const subColor  = act.lightBg ? 'rgba(20,20,20,0.95)' : 'rgba(245,242,239,0.85)';
            const shadow    = act.lightBg ? 'none' : '0 2px 20px rgba(15,20,25,0.9)';
            // Wide warm-white glow lifts dark sub text off the dark road — invisible on the cream vignette
            const subShadow = act.lightBg
              ? '0 0 10px rgba(245,242,239,0.9), 0 0 22px rgba(245,242,239,0.75), 0 0 38px rgba(245,242,239,0.5)'
              : '0 2px 18px rgba(15,20,25,0.95)';
            return (
              <div
                key={act.id}
                ref={(el) => { actRefs.current[i] = el; }}
                style={{
                  position: 'absolute',
                  maxWidth: 'min(600px, 88vw)',
                  textAlign: 'left',
                  willChange: 'opacity, transform',
                }}
              >
                {act.badge && (
                  <div style={{
                    display: 'inline-block',
                    fontFamily: FONT,
                    fontSize: '0.7rem',
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: C.accent,
                    background: 'rgba(232,97,45,0.12)',
                    border: '1px solid rgba(232,97,45,0.25)',
                    padding: '5px 16px',
                    borderRadius: 6,
                    fontWeight: 700,
                    marginBottom: 20,
                  }}>
                    {act.badge}
                  </div>
                )}

                <h1
                  style={{
                    fontFamily: FONT,
                    fontSize: 'clamp(2rem, 5vw, 3.3rem)',
                    fontWeight: 900,
                    color: textColor,
                    lineHeight: 1.1,
                    margin: '0 0 14px',
                    letterSpacing: '-0.025em',
                    textShadow: shadow,
                  }}
                >
                  {act.headline}{' '}
                  <span style={{ color: C.accent }}>{act.highlight}</span>
                </h1>

                <p
                  style={{
                    fontFamily: FONT,
                    fontSize: 'clamp(0.90rem, 2.8vw, 1.05rem)',
                    color: subColor,
                    lineHeight: 1.65,
                    maxWidth: 520,
                    margin: '0 0 32px',
                    textShadow: subShadow,
                  }}
                >
                  {act.sub}
                </p>

                {act.showCTA && (
                  <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', flexDirection: isMobile ? 'column' : 'row' }}>
                    <HeroLink href="/assessment" primary fullWidth={isMobile}>Find Out What&apos;s Possible →</HeroLink>
                    <HeroLink onClick={openCalendly} dark={act.lightBg} fullWidth={isMobile}>Book a Straight Conversation</HeroLink>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {!isMobile && <ScrollIndicator ref={scrollIndicatorRef} />}

        {/* Fade into next section */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 120,
            background: bottomFade,
            transition: 'background 1.2s ease',
            zIndex: 5,
            pointerEvents: 'none',
          }}
        />
      </div>
    </div>
  );
}

// ── Route progress bar ────────────────────────────────────────────────────────

function buildWavyPath(width: number, y: number): string {
  const n = ACTS.length - 1;
  const seg = width / n;
  const amp = 10;
  let d = `M 0,${y}`;
  for (let i = 0; i < n; i++) {
    const x1 = (i + 1) * seg;
    const cpX = i * seg + seg * 0.5;
    const cpY = y + (i % 2 === 0 ? -amp : amp);
    d += ` C ${cpX},${cpY} ${cpX},${cpY} ${x1},${y}`;
  }
  return d;
}

function RouteProgressBar({
  currentAct,
  onActClick,
}: {
  currentAct: number;
  onActClick: (i: number) => void;
}) {
  const Y = 22;
  const SVG_H = 56;
  const [hoveredStop, setHoveredStop] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [svgWidth, setSvgWidth] = useState(400);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setSvgWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const stops = ACTS.map((_, i) => (i / (ACTS.length - 1)) * svgWidth);
  const wavyD = buildWavyPath(svgWidth, Y);

  return (
    <div
      ref={wrapRef}
      style={{ position: 'absolute', top: 0, left: 80, right: 80, zIndex: 11 }}
    >
      <style>{`
        @keyframes dashMove { to { stroke-dashoffset: -24; } }
        @keyframes stopPulse {
          0%   { transform: scale(0.6); opacity: 0.6; }
          100% { transform: scale(2.2); opacity: 0; }
        }
      `}</style>

      {/* SVG — viewBox matches exact pixel dimensions, scale always 1.0 */}
      <svg
        viewBox={`0 0 ${svgWidth} ${SVG_H}`}
        style={{ width: '100%', height: SVG_H, overflow: 'visible', display: 'block' }}
      >
        {/* Layer 1: faint grey track */}
        <path d={wavyD} fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth="2.5" />

        {/* Layer 2: animated orange route dashes */}
        <path
          d={wavyD}
          fill="none"
          stroke="rgba(232,97,45,0.65)"
          strokeWidth="3.5"
          strokeDasharray="8 6"
          style={{ animation: 'dashMove 0.9s linear infinite' }}
        />

        {stops.map((x, i) => {
          const isActive  = i === currentAct;
          const isVisited = i < currentAct;
          const isHovered = hoveredStop === i;
          const act       = ACTS[i];

          // Node radius
          const dotR = isActive ? 10 : isHovered && !isActive ? 9.5 : isVisited ? 8 : 6;

          // Label styles by state
          const labelFill = isActive
            ? '#2D8B8B'
            : isHovered && !isActive
              ? '#2D8B8B'
              : isVisited
                ? 'rgba(45,139,139,0.55)'
                : 'rgba(255,255,255,0.22)';
          const labelSize = isActive || (isHovered && !isActive) ? '8.5' : isVisited ? '8' : '7.5';
          const labelWeight = isActive || (isHovered && !isActive) ? '800' : isVisited ? '700' : '600';
          const labelSpacing = isActive || (isHovered && !isActive) ? '0.12em' : isVisited ? '0.1em' : '0.08em';

          return (
            <g
              key={i}
              onClick={() => onActClick(i)}
              onMouseEnter={() => setHoveredStop(i)}
              onMouseLeave={() => setHoveredStop(null)}
              style={{ cursor: 'pointer' }}
            >
              {/* Hit area */}
              <circle cx={x} cy={Y} r={16} fill="transparent" />

              {/* Pulse ring — active only */}
              {isActive && (
                <circle
                  cx={x} cy={Y} r={18}
                  style={{
                    fill: 'rgba(45,139,139,0.15)',
                    transformBox: 'fill-box' as React.CSSProperties['transformBox'],
                    transformOrigin: 'center',
                    animation: 'stopPulse 2s ease-out infinite',
                  }}
                />
              )}

              {/* Glow ring — active only */}
              {isActive && (
                <circle
                  cx={x} cy={Y} r={14}
                  fill="none"
                  stroke="rgba(45,139,139,0.35)"
                  strokeWidth="1.5"
                  style={{ filter: 'blur(2px)' }}
                />
              )}

              {/* Hover ring — hovered non-active */}
              {isHovered && !isActive && (
                <circle cx={x} cy={Y} r={14} fill="none"
                  stroke="rgba(45,139,139,0.3)" strokeWidth="1.5"
                  style={{ filter: 'blur(1px)' }}
                />
              )}

              {/* Main dot */}
              <circle
                cx={x} cy={Y} r={dotR}
                fill={isActive || isVisited || isHovered ? (isHovered && !isActive ? 'rgba(45,139,139,0.9)' : '#2D8B8B') : 'none'}
                stroke={!isActive && !isVisited && !isHovered ? 'rgba(45,139,139,0.28)' : 'none'}
                strokeWidth={1.5}
                opacity={isVisited && !isActive && !isHovered ? 0.65 : 1}
                style={isActive
                  ? { filter: 'drop-shadow(0 0 12px rgba(45,139,139,1)) drop-shadow(0 0 4px rgba(45,139,139,0.9))' }
                  : isHovered && !isActive
                    ? { filter: 'drop-shadow(0 0 7px rgba(45,139,139,0.7))' }
                    : {}}
              />

              {/* Inner highlight — active only, gives lit/3D look */}
              {isActive && (
                <circle
                  cx={x - 2} cy={Y - 2} r={3.5}
                  fill="rgba(255,255,255,0.55)"
                />
              )}

              {/* Label below dot — all stops, three tiers of opacity */}
              <text
                x={x}
                y={Y + 22}
                textAnchor="middle"
                fontSize={labelSize}
                fontFamily={FONT}
                fontWeight={labelWeight}
                letterSpacing={labelSpacing}
                fill={labelFill}
                style={{ pointerEvents: 'none', userSelect: 'none', textTransform: 'uppercase' }}
              >
                {act.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── Scroll indicator ──────────────────────────────────────────────────────────
const ScrollIndicator = forwardRef<HTMLDivElement>(function ScrollIndicator(_, ref) {
  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        bottom: 140,
        left: '8%',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 8,
        pointerEvents: 'none',
      }}
    >
      <span style={{
        fontFamily: FONT,
        fontSize: '0.64rem',
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        color: 'rgba(245,242,239,0.28)',
        fontWeight: 700,
      }}>
        Scroll to explore
      </span>
      <div style={{
        width: 22,
        height: 36,
        border: '1.5px solid rgba(245,242,239,0.14)',
        borderRadius: 11,
        display: 'flex',
        justifyContent: 'center',
        paddingTop: 5,
        overflow: 'hidden',
      }}>
        <style>{`
          @keyframes scrollDot {
            0% { transform: translateY(0); opacity: 1; }
            100% { transform: translateY(14px); opacity: 0; }
          }
        `}</style>
        <div style={{
          width: 3,
          height: 3,
          borderRadius: '50%',
          background: C.accent,
          animation: 'scrollDot 1.7s ease infinite',
        }} />
      </div>
    </div>
  );
});

// ── Hero link button ──────────────────────────────────────────────────────────
function HeroLink({ children, href, onClick, primary, dark, fullWidth }: { children: React.ReactNode; href?: string; onClick?: () => void; primary?: boolean; dark?: boolean; fullWidth?: boolean }) {
  const styles: React.CSSProperties = {
    display: 'block',
    width: fullWidth ? '100%' : 'auto',
    textAlign: 'center',
    fontFamily: FONT,
    fontSize: '0.95rem',
    fontWeight: 700,
    padding: '14px 32px',
    borderRadius: 8,
    textDecoration: 'none',
    letterSpacing: '0.01em',
    transition: 'all 0.2s ease',
    cursor: 'pointer',
    ...(primary
      ? { background: C.accent, color: '#FFFFFF', border: 'none' }
      : {
          background: dark ? 'transparent' : 'transparent',
          color: '#E8612D',
          border: '1.5px solid rgba(232,97,45,0.55)',
        }),
  };

  if (href) {
    return <Link href={href} style={styles}>{children}</Link>;
  }
  return <button onClick={onClick} style={styles}>{children}</button>;
}
