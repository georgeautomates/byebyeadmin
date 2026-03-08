'use client';

import { useEffect, useRef } from 'react';
import { C, FONT } from '@/lib/constants';

interface Props {
  value: string;   // e.g. "60+"
  label: string;   // e.g. "hours saved / month"
  color: string;   // e.g. C.accent
}

const PARTICLE_COUNT = 500;

function smoothstep(x: number) { return x * x * (3 - 2 * x); }
function clamp01(x: number)    { return Math.max(0, Math.min(1, x)); }

/**
 * ParticleCounterCanvas
 *
 * Mini canvas (no bloom, lightweight). On IntersectionObserver fire,
 * particles scatter from random positions → assemble into the digit shape.
 * Uses canvas 2D to sample pixel positions of the text glyphs.
 */
export function ParticleCounterCanvas({ value, label, color }: Props) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggered  = useRef(false);

  useEffect(() => {
    const canvas  = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;

    const W = 220;
    const H = 110;
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width  = `${W}px`;
    canvas.style.height = `${H}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    const canvasCtx = ctx;

    // Sample digit pixel positions from a temporary canvas
    function sampleDigitPositions(): [number, number][] {
      const tmp = document.createElement('canvas');
      tmp.width  = W;
      tmp.height = H;
      const tc = tmp.getContext('2d')!;
      tc.fillStyle = 'white';
      tc.font = `900 72px "${FONT.replace(/'/g, '')}", sans-serif`;
      tc.textAlign    = 'center';
      tc.textBaseline = 'middle';
      tc.fillText(value, W / 2, H / 2 - 4);

      const data = tc.getImageData(0, 0, W, H).data;
      const pts: [number, number][] = [];
      const step = 3; // sample every 3 pixels for density control
      for (let y = 0; y < H; y += step) {
        for (let x = 0; x < W; x += step) {
          if (data[(y * W + x) * 4 + 3] > 128) {
            pts.push([x, y]);
          }
        }
      }
      return pts;
    }

    // Build scatter (random) and target (digit) positions
    function buildPositions() {
      const targets = sampleDigitPositions();

      const scatter: [number, number][] = [];
      const target:  [number, number][] = [];

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        scatter.push([
          Math.random() * W,
          Math.random() * H,
        ]);
        target.push(targets[i % targets.length]);
      }
      return { scatter, target };
    }

    let positions = { scatter: [] as [number,number][], target: [] as [number,number][] };
    let progress  = 0;
    let rafId     = 0;
    let animating = false;

    function startAnimation() {
      document.fonts.ready.then(() => {
        positions = buildPositions();
        animating = true;
        const start = performance.now();
        const dur   = 1600; // ms

        function frame(now: number) {
          if (!animating) return;
          const elapsed = now - start;
          progress = clamp01(elapsed / dur);

          canvasCtx.clearRect(0, 0, W, H);

          const p = smoothstep(progress);

          for (let i = 0; i < PARTICLE_COUNT; i++) {
            const [sx, sy] = positions.scatter[i];
            const [tx, ty] = positions.target[i];
            const x = sx + (tx - sx) * p;
            const y = sy + (ty - sy) * p;

            canvasCtx.fillStyle = color + Math.round(p * 200 + 55).toString(16).padStart(2,'0');
            canvasCtx.beginPath();
            canvasCtx.arc(x, y, 1.2, 0, Math.PI * 2);
            canvasCtx.fill();
          }

          if (progress < 1) {
            rafId = requestAnimationFrame(frame);
          } else {
            animating = false;
          }
        }

        rafId = requestAnimationFrame(frame);
      });
    }

    // IntersectionObserver trigger
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !triggered.current) {
          triggered.current = true;
          startAnimation();
        }
      },
      { threshold: 0.5 }
    );
    obs.observe(wrapper);

    return () => {
      obs.disconnect();
      animating = false;
      cancelAnimationFrame(rafId);
    };
  }, [value, color]);

  return (
    <div
      ref={wrapperRef}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <canvas
        ref={canvasRef}
        width={220}
        height={110}
        style={{ display: 'block', width: 220, height: 110 }}
      />
      <p style={{
        fontFamily: FONT,
        fontSize: '0.82rem',
        color: C.textDim,
        fontWeight: 600,
        textAlign: 'center',
        margin: 0,
        maxWidth: 160,
        lineHeight: 1.4,
      }}>
        {label}
      </p>
    </div>
  );
}
