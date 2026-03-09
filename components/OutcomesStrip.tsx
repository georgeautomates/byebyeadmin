'use client';

import { Fade, Section } from '@/components/ui';
import { C, FONT, MONO } from '@/lib/constants';

const OUTCOMES = [
  {
    value: '60 hrs',
    unit: 'per month',
    desc: 'Admin hours given back to every operator we work with.',
    color: C.accent,
  },
  {
    value: 'Same day',
    unit: 'invoicing',
    desc: 'Invoices raised and sent the moment the job is done.',
    color: C.teal,
  },
  {
    value: '< 3 sec',
    unit: 'per order',
    desc: 'Every inbound order read, structured, and confirmed.',
    color: C.accent,
  },
  {
    value: 'Zero',
    unit: 'compliance gaps',
    desc: 'Driver hours and O-licence deadlines monitored automatically.',
    color: C.teal,
  },
  {
    value: '9 weeks',
    unit: 'to fully live',
    desc: 'From first conversation to the system running on its own.',
    color: C.accent,
  },
];

export function OutcomesStrip() {
  return (
    <div style={{ background: C.bgDark, position: 'relative', overflow: 'hidden' }}>

      {/* Subtle grid */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(45,139,139,0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(45,139,139,0.05) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
          pointerEvents: 'none',
        }}
      />

      <Section style={{ position: 'relative', zIndex: 1, paddingTop: 'clamp(56px, 7vw, 88px)', paddingBottom: 'clamp(56px, 7vw, 88px)' }}>

        {/* Header */}
        <Fade>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div
              style={{
                display: 'inline-block',
                fontFamily: MONO,
                fontSize: '0.7rem',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: C.accent,
                background: 'rgba(232,97,45,0.1)',
                border: '1px solid rgba(232,97,45,0.25)',
                padding: '5px 16px',
                borderRadius: 6,
                fontWeight: 700,
                marginBottom: 16,
              }}
            >
              What operators get
            </div>
            <h2
              style={{
                fontFamily: FONT,
                fontSize: 'clamp(1.4rem, 3.5vw, 2rem)',
                fontWeight: 900,
                color: '#F5F2EF',
                margin: 0,
                letterSpacing: '-0.02em',
              }}
            >
              Real numbers, from a real operation.
            </h2>
          </div>
        </Fade>

        {/* Stat grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 20,
          }}
        >
          {OUTCOMES.map((o, i) => (
            <Fade key={o.value} delay={i * 0.07}>
              <div
                style={{
                  background: 'rgba(245,242,239,0.04)',
                  border: `1px solid ${o.color}25`,
                  borderRadius: 12,
                  padding: '24px 22px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <div
                  style={{
                    fontFamily: FONT,
                    fontSize: 'clamp(1.6rem, 3.5vw, 2rem)',
                    fontWeight: 900,
                    color: o.color,
                    lineHeight: 1,
                    letterSpacing: '-0.02em',
                  }}
                >
                  {o.value}
                </div>
                <div
                  style={{
                    fontFamily: MONO,
                    fontSize: '0.64rem',
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: 'rgba(245,242,239,0.4)',
                  }}
                >
                  {o.unit}
                </div>
                <div
                  style={{
                    fontFamily: FONT,
                    fontSize: '0.85rem',
                    color: 'rgba(245,242,239,0.55)',
                    lineHeight: 1.55,
                    marginTop: 4,
                  }}
                >
                  {o.desc}
                </div>
              </div>
            </Fade>
          ))}
        </div>
      </Section>
    </div>
  );
}
