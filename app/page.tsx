'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { HeroScroll } from '@/components/HeroScroll';
import { LoadingScreen } from '@/components/LoadingScreen';
import { AgentShowcaseScroll } from '@/components/AgentShowcaseScroll';
import { FAQSection } from '@/components/FAQSection';
import { DemosSection } from '@/components/DemosSection';
import { WhatIsBBASection } from '@/components/WhatIsBBASection';
import { Fade, Btn, Section } from '@/components/ui';
import { C, FONT } from '@/lib/constants';
import Link from 'next/link';
import { useCalendly } from '@/lib/calendly-context';

// Dynamic imports for canvas-heavy components (browser-only)
const CTAParticleCanvas = dynamic(
  () => import('@/components/CTAParticleCanvas').then((m) => m.CTAParticleCanvas),
  { ssr: false, loading: () => null }
);


export default function HomePage() {
  const [heroReady, setHeroReady] = useState(false);
  const { openCalendly } = useCalendly();

  return (
    <div>
      <LoadingScreen loaded={heroReady} />

      {/* ── 3D scroll-driven hero (500vh tall) ── */}
      <HeroScroll onReady={() => setHeroReady(true)} />

      {/* ── What is BBA — company definition anchor ── */}
      <WhatIsBBASection />

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
