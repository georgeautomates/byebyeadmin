'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { HeroScroll } from '@/components/HeroScroll';
import { LoadingScreen } from '@/components/LoadingScreen';
import { AgentShowcaseScroll } from '@/components/AgentShowcaseScroll';
import { FAQSection } from '@/components/FAQSection';
import { Fade, Btn, Section, Card, H2, P, Strong } from '@/components/ui';
import { C, FONT } from '@/lib/constants';
import Link from 'next/link';

// Dynamic imports for canvas-heavy components (browser-only)
const CTAParticleCanvas = dynamic(
  () => import('@/components/CTAParticleCanvas').then((m) => m.CTAParticleCanvas),
  { ssr: false, loading: () => null }
);

export default function HomePage() {
  const [heroReady, setHeroReady] = useState(false);

  return (
    <div>
      <LoadingScreen loaded={heroReady} />

      {/* ── 3D scroll-driven hero (500vh tall) ── */}
      <HeroScroll onReady={() => setHeroReady(true)} />

      {/* ── Agent showcase intro ── */}
      <div style={{ background: C.bg }}>
        <Section style={{ textAlign: 'center', paddingBottom: 0 }}>
          <Fade>
            <H2>Six things we automate. While you handle the fleet.</H2>
          </Fade>
          <Fade delay={0.05}>
            <P style={{ color: C.textMid, marginBottom: 0 }}>Each one is a piece of admin your team currently does by hand.</P>
          </Fade>
        </Section>
      </div>

      {/* ── Agent showcase — 400vh sticky scroll ── */}
      <AgentShowcaseScroll />

      {/* ── VSL placeholder ── */}
      <div style={{ background: C.bgWhite }}>
        <Section style={{ textAlign: 'center' }}>
          <Fade>
            <H2>Why we built this. And why it works for fleets your size.</H2>
          </Fade>
          <Fade delay={0.05}>
            <P style={{ color: C.textMid, marginBottom: 28 }}>3 minutes. Plain English.</P>
          </Fade>
          <Fade delay={0.1}>
            <div style={{
              maxWidth: 800, margin: '0 auto 24px',
              aspectRatio: '16/9', background: C.bg,
              border: `2px dashed ${C.border}`, borderRadius: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexDirection: 'column', gap: 12,
            }}>
              <div style={{ fontSize: '2.5rem', color: C.textDim }}>▶</div>
              <P style={{ color: C.textDim, margin: 0, fontSize: '0.9rem' }}>
                Video coming soon — replace with Vimeo embed (autoplay:off, captions:on)
              </P>
            </div>
          </Fade>
          <Fade delay={0.15}>
            <P style={{ color: C.textDim, fontStyle: 'italic', fontSize: '0.9rem' }}>
              Or skip ahead — take the free assessment and get your numbers in 2 minutes.
            </P>
          </Fade>
          <Fade delay={0.2}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              background: C.tealDim,
              border: `1px solid ${C.tealBorder}`,
              borderRadius: 8,
              padding: '10px 18px',
              marginTop: 24,
            }}>
              <span style={{ color: C.teal, fontWeight: 800, fontSize: '1rem' }}>✓</span>
              <span style={{ fontFamily: FONT, color: C.teal, fontWeight: 700, fontSize: '0.92rem' }}>
                Built by someone who came from your industry. Not a tech startup.
              </span>
            </div>
          </Fade>
        </Section>
      </div>

      {/* ── Cost question ── */}
      <div data-section="cost" style={{ background: C.bg }}>
        <Section>
          <Fade>
            <H2>Does the cost stack up?</H2>
          </Fade>
          <Fade delay={0.1}>
            <Card style={{ borderLeft: `4px solid ${C.accent}` }}>
              <P>
                Your admin person costs around £15/hour all-in. At 30 hours a week on order entry, invoicing, and
                portal-checking, that&apos;s roughly £1,800 a month for work that doesn&apos;t need a human brain.
              </P>
              <P>
                AI automation handling that same work costs around a third of that.{' '}
                <Strong>Your admin person keeps their job — they just stop doing the part that was wasting their time.</Strong>
              </P>
              <P style={{ color: C.textMid, fontStyle: 'italic', marginBottom: 0 }}>
                Nothing goes live until you&apos;ve watched it working on your real jobs. The risk sits with us.
              </P>
            </Card>
          </Fade>
        </Section>
      </div>

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
                fontSize: '2.2rem',
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
              <Link href="/contact">
                <Btn style={{ color: '#F5F2EF', borderColor: 'rgba(245,242,239,0.3)' }}>Book a 15-Minute Call</Btn>
              </Link>
            </div>
          </Fade>
        </Section>
      </div>
    </div>
  );
}
