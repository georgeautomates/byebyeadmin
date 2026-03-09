'use client';

import { Fade, Section } from '@/components/ui';
import { C, FONT, MONO } from '@/lib/constants';

const TRUST_ITEMS = [
  {
    icon: '✓',
    label: 'No long contract',
    desc: 'Stop any time. No exit fees.',
    color: C.teal,
  },
  {
    icon: '✓',
    label: 'Free to assess',
    desc: 'See your numbers before any cost conversation.',
    color: C.teal,
  },
  {
    icon: '✓',
    label: 'Your team reviews every output first',
    desc: 'Nothing goes live until you have seen it work.',
    color: C.teal,
  },
  {
    icon: '✓',
    label: 'Works with your existing TMS',
    desc: 'Not a replacement. The layer that removes the manual input.',
    color: C.teal,
  },
];

export function TrustStrip() {
  return (
    <div style={{ background: C.bg }}>
      <Section style={{ paddingTop: 'clamp(48px, 6vw, 72px)', paddingBottom: 'clamp(48px, 6vw, 72px)' }}>
        <Fade>
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <span
              style={{
                fontFamily: MONO,
                fontSize: '0.7rem',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: C.teal,
                fontWeight: 700,
              }}
            >
              How we work
            </span>
          </div>
        </Fade>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 16,
          }}
        >
          {TRUST_ITEMS.map((item, i) => (
            <Fade key={item.label} delay={i * 0.06}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 14,
                  background: '#FFFFFF',
                  border: `1px solid ${C.borderLight}`,
                  borderRadius: 10,
                  padding: '18px 20px',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                }}
              >
                <span
                  style={{
                    fontFamily: FONT,
                    fontSize: '0.9rem',
                    fontWeight: 800,
                    color: item.color,
                    flexShrink: 0,
                    marginTop: 1,
                  }}
                >
                  {item.icon}
                </span>
                <div>
                  <div
                    style={{
                      fontFamily: FONT,
                      fontWeight: 800,
                      fontSize: '0.92rem',
                      color: C.text,
                      marginBottom: 4,
                      lineHeight: 1.3,
                    }}
                  >
                    {item.label}
                  </div>
                  <div
                    style={{
                      fontFamily: FONT,
                      fontSize: '0.82rem',
                      color: C.textMid,
                      lineHeight: 1.5,
                    }}
                  >
                    {item.desc}
                  </div>
                </div>
              </div>
            </Fade>
          ))}
        </div>
      </Section>
    </div>
  );
}
