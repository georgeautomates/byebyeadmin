'use client';

import { MONO } from '@/lib/constants';

const CHAOS_WORDS = [
  'INVOICE', 'ORDER ENTRY', 'PORTAL', 'SPREADSHEET', 'COMPLIANCE',
  'CONFIRMATION', 'CHASE', 'UPDATE', 'MANUAL', 'DEADLINE',
  'TACHO', 'POD', 'EMAIL', 'PAPERWORK', 'QUERY',
  'CUSTOMS', 'RATE CARD', 'BOOKING', 'MANIFEST', 'DELIVERY NOTE',
];

// Random stable positions (avoid hydration issues by not using Math.random() in render)
const WORD_CONFIGS = [
  { left: '8%',  top: '12%', rotate: '-8deg',  opacity: 0.028, size: '0.6rem', delay: '0s',   duration: '18s' },
  { left: '22%', top: '5%',  rotate: '3deg',   opacity: 0.022, size: '0.55rem',delay: '2.1s', duration: '22s' },
  { left: '55%', top: '8%',  rotate: '-3deg',  opacity: 0.032, size: '0.65rem',delay: '0.7s', duration: '16s' },
  { left: '75%', top: '15%', rotate: '6deg',   opacity: 0.024, size: '0.58rem',delay: '3.4s', duration: '20s' },
  { left: '88%', top: '4%',  rotate: '-11deg', opacity: 0.026, size: '0.52rem',delay: '1.2s', duration: '25s' },
  { left: '4%',  top: '35%', rotate: '9deg',   opacity: 0.03,  size: '0.62rem',delay: '4.5s', duration: '19s' },
  { left: '33%', top: '30%', rotate: '-5deg',  opacity: 0.02,  size: '0.54rem',delay: '0.3s', duration: '24s' },
  { left: '68%', top: '28%', rotate: '12deg',  opacity: 0.028, size: '0.6rem', delay: '5.1s', duration: '17s' },
  { left: '90%', top: '40%', rotate: '-7deg',  opacity: 0.022, size: '0.56rem',delay: '2.8s', duration: '21s' },
  { left: '15%', top: '55%', rotate: '4deg',   opacity: 0.03,  size: '0.64rem',delay: '1.8s', duration: '23s' },
  { left: '45%', top: '60%', rotate: '-9deg',  opacity: 0.024, size: '0.58rem',delay: '6.2s', duration: '15s' },
  { left: '78%', top: '55%', rotate: '7deg',   opacity: 0.026, size: '0.6rem', delay: '3.9s', duration: '26s' },
  { left: '6%',  top: '72%', rotate: '-4deg',  opacity: 0.02,  size: '0.55rem',delay: '0.9s', duration: '20s' },
  { left: '28%', top: '78%', rotate: '10deg',  opacity: 0.028, size: '0.62rem',delay: '4.2s', duration: '18s' },
  { left: '60%', top: '75%', rotate: '-6deg',  opacity: 0.022, size: '0.56rem',delay: '2.5s', duration: '22s' },
  { left: '85%', top: '70%', rotate: '5deg',   opacity: 0.03,  size: '0.6rem', delay: '7.0s', duration: '16s' },
  { left: '40%', top: '88%', rotate: '-12deg', opacity: 0.024, size: '0.54rem',delay: '1.5s', duration: '24s' },
  { left: '70%', top: '90%', rotate: '8deg',   opacity: 0.026, size: '0.58rem',delay: '5.7s', duration: '19s' },
  { left: '18%', top: '92%', rotate: '-3deg',  opacity: 0.02,  size: '0.52rem',delay: '3.1s', duration: '28s' },
  { left: '92%', top: '82%', rotate: '14deg',  opacity: 0.028, size: '0.62rem',delay: '0.5s', duration: '21s' },
];

/**
 * ChaosWordField
 *
 * Pure CSS component — 20 haulage-admin words drifting slowly upward behind
 * the Problem section content. Very low opacity (0.02–0.032) to stay subtle.
 * aria-hidden so screen readers ignore it.
 */
export function ChaosWordField() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      <style>{`
        @keyframes chaosWordDrift {
          0%   { transform: translateY(0) rotate(var(--r)); opacity: var(--o); }
          80%  { opacity: var(--o); }
          100% { transform: translateY(-130px) rotate(calc(var(--r) + 5deg)); opacity: 0; }
        }
      `}</style>
      {WORD_CONFIGS.map((cfg, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: cfg.left,
            top: cfg.top,
            fontFamily: MONO,
            fontSize: cfg.size,
            fontWeight: 700,
            letterSpacing: '0.12em',
            color: '#1F2937',
            opacity: cfg.opacity,
            animation: `chaosWordDrift ${cfg.duration} linear ${cfg.delay} infinite`,
            // CSS custom properties for the keyframe
            ['--r' as string]: cfg.rotate,
            ['--o' as string]: String(cfg.opacity),
            whiteSpace: 'nowrap',
          }}
        >
          {CHAOS_WORDS[i % CHAOS_WORDS.length]}
        </div>
      ))}
    </div>
  );
}
