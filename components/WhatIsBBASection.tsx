'use client';

import { Fade, Section } from '@/components/ui';
import { C, FONT, MONO } from '@/lib/constants';

const CHIPS = [
  'We do the work, not you',
  'Haulage only',
  'UK operators, 3\u2013100 vehicles',
];

export function WhatIsBBASection() {
  return (
    <div style={{ background: C.bgWhite }}>
      <Section style={{ textAlign: 'center', paddingTop: 'clamp(60px, 8vw, 96px)', paddingBottom: 'clamp(60px, 8vw, 96px)' }}>
        <Fade>
          {/* Category label */}
          <div
            style={{
              display: 'inline-block',
              fontFamily: MONO,
              fontSize: '0.7rem',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: C.teal,
              background: C.tealDim,
              border: `1px solid ${C.teal}30`,
              padding: '5px 16px',
              borderRadius: 6,
              fontWeight: 700,
              marginBottom: 24,
            }}
          >
            What we are
          </div>

          {/* Headline */}
          <h2
            style={{
              fontFamily: FONT,
              fontSize: 'clamp(1.7rem, 4vw, 2.6rem)',
              fontWeight: 900,
              color: C.text,
              lineHeight: 1.12,
              letterSpacing: '-0.025em',
              margin: '0 0 20px',
              maxWidth: 760,
              marginLeft: 'auto',
              marginRight: 'auto',
            }}
          >
            Bye Bye Admin is{' '}
            <span style={{ color: C.accent }}>the AI automation partner</span>{' '}
            for UK haulage operators.
          </h2>

          {/* Sub */}
          <p
            style={{
              fontFamily: FONT,
              fontSize: 'clamp(0.95rem, 2.2vw, 1.1rem)',
              color: C.textMid,
              lineHeight: 1.65,
              maxWidth: 620,
              margin: '0 auto 32px',
            }}
          >
            We handle it all for you. We set it up, we run it, we manage it:
            reading your emails, matching your PODs, raising your invoices,
            while your team gets on with running the fleet.
          </p>

          {/* Chips */}
          <div
            style={{
              display: 'flex',
              gap: 10,
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
            {CHIPS.map((chip) => (
              <span
                key={chip}
                style={{
                  fontFamily: MONO,
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  color: C.text,
                  background: C.accentDim,
                  border: `1px solid ${C.accent}30`,
                  borderRadius: 20,
                  padding: '7px 18px',
                }}
              >
                {chip}
              </span>
            ))}
          </div>
        </Fade>
      </Section>
    </div>
  );
}
