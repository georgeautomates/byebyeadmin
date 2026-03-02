'use client';

import { C, FONT, MONO } from '@/lib/constants';

interface LoadingScreenProps {
  loaded: boolean;
}

export function LoadingScreen({ loaded }: LoadingScreenProps) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: C.bg,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 28,
        opacity: loaded ? 0 : 1,
        pointerEvents: loaded ? 'none' : 'all',
        transition: 'opacity 0.6s ease 0.2s',
      }}
    >
      {/* Wordmark */}
      <div style={{
        fontFamily: FONT,
        fontSize: '1.25rem',
        fontWeight: 900,
        color: C.text,
        letterSpacing: '-0.02em',
      }}>
        byebye<span style={{ color: C.accent }}>admin</span>
      </div>

      {/* Truck + road animation */}
      <div style={{ position: 'relative', width: 200, height: 64 }}>
        <style>{`
          @keyframes loadWheelSpin {
            from { transform: rotate(0deg); }
            to   { transform: rotate(360deg); }
          }
          @keyframes loadRoadScroll {
            from { transform: translateX(0); }
            to   { transform: translateX(-50%); }
          }
        `}</style>

        {/* Road dashes */}
        <div style={{
          position: 'absolute',
          bottom: 8,
          left: 0,
          right: 0,
          overflow: 'hidden',
          height: 3,
        }}>
          <div style={{
            display: 'flex',
            gap: 10,
            animation: 'loadRoadScroll 0.6s linear infinite',
            width: '200%',
          }}>
            {Array.from({ length: 24 }).map((_, i) => (
              <div key={i} style={{
                width: 18,
                height: 3,
                borderRadius: 2,
                background: C.border,
                flexShrink: 0,
              }} />
            ))}
          </div>
        </div>

        {/* Truck silhouette — stationary, centred, wheels spin in sync with road */}
        <div style={{
          position: 'absolute',
          bottom: 11,
          left: 64,
        }}>
          <svg width="72" height="40" viewBox="0 0 72 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Trailer */}
            <rect x="0" y="4" width="44" height="26" rx="2" fill={C.text} />
            {/* Cab */}
            <rect x="44" y="10" width="20" height="20" rx="2" fill={C.textMid} />
            {/* Cab window */}
            <rect x="47" y="13" width="10" height="8" rx="1" fill="rgba(232,97,45,0.35)" />
            {/* Exhaust */}
            <rect x="60" y="6" width="3" height="8" rx="1" fill={C.textMid} />
            {/* Rear wheel */}
            <g style={{ transformOrigin: '14px 33px', animation: 'loadWheelSpin 0.9s linear infinite' }}>
              <circle cx="14" cy="33" r="7" fill={C.textDim} />
              <circle cx="14" cy="33" r="3" fill={C.border} />
            </g>
            {/* Front wheel */}
            <g style={{ transformOrigin: '56px 33px', animation: 'loadWheelSpin 0.9s linear infinite' }}>
              <circle cx="56" cy="33" r="7" fill={C.textDim} />
              <circle cx="56" cy="33" r="3" fill={C.border} />
            </g>
          </svg>
        </div>
      </div>

    </div>
  );
}
