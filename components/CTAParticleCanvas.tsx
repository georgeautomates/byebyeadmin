'use client';

import { useEffect, useRef } from 'react';

/**
 * CTAParticleCanvas
 *
 * Full-width 2D canvas background for the CTA section.
 * 1,500 particles loop: scatter → converge to centre → "pulse" flash → scatter.
 * Uses canvas 2D (no Three.js / WebGL) — keeps it lightweight for a footer section.
 */

const PARTICLE_COUNT = 1_500;
const CYCLE_DURATION = 4_000; // ms per full cycle

function smoothstep(x: number) { return x * x * (3 - 2 * x); }
function clamp01(x: number)    { return Math.max(0, Math.min(1, x)); }

// Alternating orange / teal
const COLORS = ['#E8612D', '#2D8B8B', '#E8612D', '#2D8B8B', '#FFFFFF'];

export function CTAParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    let W = canvas.offsetWidth;
    let H = canvas.offsetHeight;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // ctx is guaranteed non-null below this point
    const canvasCtx = ctx;

    // Particle state
    const px    = new Float32Array(PARTICLE_COUNT);
    const py    = new Float32Array(PARTICLE_COUNT);
    const vx    = new Float32Array(PARTICLE_COUNT);
    const vy    = new Float32Array(PARTICLE_COUNT);
    const col   = new Array<string>(PARTICLE_COUNT);
    const sizes = new Float32Array(PARTICLE_COUNT);

    function reset(i: number) {
      const angle = Math.random() * Math.PI * 2;
      const dist  = W * 0.5 + Math.random() * W * 0.3;
      px[i] = W / 2 + Math.cos(angle) * dist;
      py[i] = H / 2 + Math.sin(angle) * dist * 0.6;
      vx[i] = 0;
      vy[i] = 0;
      col[i]   = COLORS[Math.floor(Math.random() * COLORS.length)];
      sizes[i] = 0.8 + Math.random() * 2.4;
    }

    for (let i = 0; i < PARTICLE_COUNT; i++) reset(i);

    let rafId    = 0;
    let startTime = performance.now();
    let cycling  = true;

    function frame(now: number) {
      if (!cycling) return;
      rafId = requestAnimationFrame(frame);

      const elapsed = (now - startTime) % CYCLE_DURATION;
      const t = elapsed / CYCLE_DURATION; // 0..1

      // Phase breakdown:
      //   0.0–0.6: converge (smoothstep)
      //   0.6–0.7: hold/flash
      //   0.7–1.0: scatter (instant reset)
      const cx = W / 2;
      const cy = H / 2;

      canvasCtx.clearRect(0, 0, W, H);

      // Flash ring at pulse point
      if (t > 0.62 && t < 0.72) {
        const ring = smoothstep(clamp01((t - 0.62) / 0.05));
        const fade = 1 - smoothstep(clamp01((t - 0.67) / 0.05));
        canvasCtx.beginPath();
        canvasCtx.arc(cx, cy, ring * W * 0.35, 0, Math.PI * 2);
        canvasCtx.strokeStyle = `rgba(232, 97, 45, ${fade * 0.7})`;
        canvasCtx.lineWidth = 2;
        canvasCtx.stroke();
      }

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        let x: number;
        let y: number;
        let alpha: number;

        if (t < 0.62) {
          // Converge phase
          const p = smoothstep(clamp01(t / 0.6));
          const angle = Math.atan2(py[i] - cy, px[i] - cx);
          const origDist = Math.hypot(px[i] - cx, py[i] - cy);
          const dist = origDist * (1 - p);
          x = cx + Math.cos(angle) * Math.max(dist, 0);
          y = cy + Math.sin(angle) * Math.max(dist, 0);
          alpha = 0.35 + p * 0.55;
        } else if (t < 0.72) {
          // Pulse hold — all at centre
          x = cx + (Math.random() - 0.5) * 4;
          y = cy + (Math.random() - 0.5) * 4;
          alpha = 0.9;
        } else {
          // Scatter — reset to new random scatter pos
          if (t > 0.73 && vx[i] === 0) {
            const angle = Math.random() * Math.PI * 2;
            vx[i] = Math.cos(angle) * (2 + Math.random() * 5);
            vy[i] = Math.sin(angle) * (2 + Math.random() * 3);
          }
          x = cx + vx[i] * ((t - 0.72) / 0.28) * W * 0.5;
          y = cy + vy[i] * ((t - 0.72) / 0.28) * H * 0.4;
          alpha = 1 - smoothstep(clamp01((t - 0.72) / 0.28));
          if (t > 0.98) { vx[i] = 0; vy[i] = 0; reset(i); }
        }

        canvasCtx.globalAlpha = Math.max(0, Math.min(1, alpha));
        canvasCtx.fillStyle = col[i];
        canvasCtx.beginPath();
        canvasCtx.arc(x, y, sizes[i], 0, Math.PI * 2);
        canvasCtx.fill();
      }

      canvasCtx.globalAlpha = 1;
    }

    rafId = requestAnimationFrame(frame);

    const obs = new ResizeObserver(() => {
      W = canvas.offsetWidth;
      H = canvas.offsetHeight;
      canvas.width  = W * dpr;
      canvas.height = H * dpr;
      canvasCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    });
    obs.observe(canvas);

    return () => {
      cycling = false;
      cancelAnimationFrame(rafId);
      obs.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        opacity: 0.45,
      }}
    />
  );
}
