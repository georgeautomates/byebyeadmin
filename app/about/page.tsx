'use client';

import { useState, useEffect } from 'react';
import { Fade, Btn, Section, Card, Tag, Quote, H2, P, Strong, Acc } from '@/components/ui';
import { C, FONT } from '@/lib/constants';
import Link from 'next/link';
import { useCalendly } from '@/lib/calendly-context';

function TornPhoto() {
  return (
    <svg
      viewBox="0 0 400 520"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        width: '100%',
        display: 'block',
        overflow: 'visible',
        filter: 'drop-shadow(0px 16px 32px rgba(31,41,55,0.15)) drop-shadow(0px 4px 10px rgba(232,97,45,0.06))',
      }}
    >
      <defs>
        <clipPath id="photo-inset">
          <rect x="24" y="24" width="352" height="472" />
        </clipPath>
      </defs>
      {/* White torn-paper shape — the visible "paper" border */}
      <path
        fill="white"
        d="M 16,14 L 30,7 L 44,14 L 58,8 L 72,15 L 86,6 L 100,14 L 115,8 L 130,16 L 144,7 L 158,14 L 172,8 L 186,15 L 200,6 L 214,14 L 228,8 L 242,16 L 256,7 L 270,13 L 285,8 L 300,15 L 314,6 L 328,14 L 342,8 L 356,16 L 370,7 L 384,13 L 394,28 L 388,44 L 396,60 L 390,76 L 395,92 L 387,108 L 396,124 L 390,140 L 394,156 L 388,172 L 396,188 L 390,204 L 394,220 L 387,236 L 396,252 L 390,268 L 395,284 L 388,300 L 396,316 L 390,332 L 394,348 L 388,364 L 396,380 L 390,396 L 394,412 L 387,428 L 396,444 L 390,460 L 394,476 L 387,492 L 395,508 L 378,518 L 362,510 L 346,520 L 328,512 L 312,522 L 294,510 L 276,520 L 258,512 L 240,522 L 222,510 L 204,520 L 186,510 L 168,520 L 150,510 L 132,520 L 114,510 L 96,518 L 78,510 L 60,520 L 42,510 L 24,518 L 8,512 L 12,496 L 6,480 L 14,464 L 8,448 L 14,432 L 7,416 L 14,400 L 8,384 L 14,368 L 7,352 L 14,336 L 8,320 L 14,304 L 7,288 L 14,272 L 8,256 L 14,240 L 7,224 L 14,208 L 8,192 L 14,176 L 7,160 L 14,144 L 8,128 L 14,112 L 7,96 L 14,80 L 8,64 L 14,48 L 7,32 L 14,16 Z"
      />
      {/* Photo inset ~24px on all sides, sitting on the white paper */}
      <image
        href="/george.jpg"
        x="24"
        y="24"
        width="352"
        height="472"
        clipPath="url(#photo-inset)"
        preserveAspectRatio="xMidYMin slice"
      />
    </svg>
  );
}

export default function AboutPage() {
  const { openCalendly } = useCalendly();
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const fn = () => setNarrow(window.innerWidth < 720);
    fn();
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);

  return (
    <div style={{ paddingTop: 80 }}>

      {/* ── Section A: Founder story ── */}
      <div style={{ background: C.bg }}>
        <div
          style={{
            padding: 'clamp(40px, 6vw, 80px) clamp(16px, 5vw, 24px)',
            maxWidth: 1300,
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: narrow ? '1fr' : 'minmax(0, 1fr) 420px',
            gap: narrow ? 0 : 56,
            alignItems: 'flex-start',
          }}
        >
            {/* Left: text */}
            <div>
              <Fade>
                <Tag teal>About</Tag>
                <h1
                  style={{
                    fontFamily: FONT,
                    fontSize: 'clamp(2rem, 4.5vw, 2.8rem)',
                    fontWeight: 900,
                    color: C.text,
                    lineHeight: 1.12,
                    margin: '16px 0 24px',
                  }}
                >
                  I Didn&apos;t Set Out to Build AI Automation for Haulage.<br />
                  <Acc>But I Couldn&apos;t Not Do It.</Acc>
                </h1>
              </Fade>
              <Fade delay={0.1}>
                <P>
                  I got into haulage because it was there. Discovered two things: the people are brilliant: resourceful,
                  tough, pragmatic. And <Strong>the admin is absolutely crushing them.</Strong>
                </P>
                <P>
                  I watched operators plan 40 drops across 15 vehicles in their head then spend three hours typing orders
                  into spreadsheets. Owner-operators working six-day weeks, not because of driving work, but paperwork.
                </P>
              </Fade>
              <Fade delay={0.15}>
                <P>I left. King&apos;s College London. Tech. Automation. But I never stopped thinking about haulage.</P>
                <Quote>
                  Part of me felt like I was running away. I&apos;d seen this massive problem and instead of fixing it,
                  gone off to help marketing agencies save 3 hours a week.
                </Quote>
              </Fade>
              <Fade delay={0.2}>
                <P>
                  Then AI got good enough.{' '}
                  <Strong>
                    &quot;I know exactly which industry needs this most. If I don&apos;t do this, who will?&quot;
                  </Strong>{' '}
                  So I went all in. Everyone thought I was mad.
                </P>
                <P>
                  Over a thousand haulage businesses have closed since 2019. Not because the operators weren&apos;t good
                  enough. Because the admin was too much. The technology exists. It&apos;s just not reaching the people
                  who need it most.
                </P>
              </Fade>
            </div>

            {/* Right: sticky torn-paper photo (desktop only) */}
            {!narrow && (
              <Fade delay={0.05}>
                <div style={{ position: 'sticky', top: 108, alignSelf: 'flex-start' }}>
                  <TornPhoto />
                </div>
              </Fade>
            )}
        </div>
      </div>

      {/* ── Section B: Credentials ── */}
      <div style={{ background: C.bgWhite }}>
        <Section>
          <Fade>
            <Tag teal>Credentials</Tag>
            <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
              <Card>
                <h3 style={{ color: C.teal, fontSize: '0.95rem', fontWeight: 800, margin: '0 0 12px' }}>
                  What I&apos;ve Got
                </h3>
                {[
                  'Haulage industry experience',
                  "King's College London",
                  '12 months haulage AI only',
                  'Systems tested on a live 70-vehicle Kent operation',
                ].map((item, i) => (
                  <div
                    key={i}
                    style={{ color: C.textMid, fontSize: '0.88rem', padding: '7px 0', borderBottom: `1px solid ${C.borderLight}` }}
                  >
                    <span style={{ color: C.teal }}>✓</span> {item}
                  </div>
                ))}
              </Card>
              <Card>
                <h3 style={{ color: C.textDim, fontSize: '0.95rem', fontWeight: 800, margin: '0 0 12px' }}>
                  What I Haven&apos;t Got (Yet)
                </h3>
                {[
                  'Hundreds of case studies',
                  'A fancy office',
                  'A team of 50',
                  '20 years in automation',
                ].map((item, i) => (
                  <div
                    key={i}
                    style={{ color: C.textDim, fontSize: '0.88rem', padding: '7px 0', borderBottom: `1px solid ${C.borderLight}` }}
                  >
                    - {item}
                  </div>
                ))}
              </Card>
            </div>
          </Fade>
          <Fade delay={0.1}>
            <P style={{ marginTop: 24 }}>
              <Strong>
                I&apos;m early. I&apos;d rather be honest about that than oversell it. But what I&apos;m building works
                and I&apos;m building it for the people who need it most.
              </Strong>
            </P>
          </Fade>
        </Section>
      </div>

      {/* ── Section C: Numbers strip ── */}
      <div style={{ background: C.bgDark }}>
        <Section>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 32, textAlign: 'center' }}>
            {[
              {
                num: '1 industry',
                desc: 'The only sector I build for. Not a generalist platform retrofitted to haulage.',
              },
              {
                num: '12 months',
                desc: 'Focused solely on haulage AI before taking a single client. Nothing else.',
              },
              {
                num: '70 vehicles',
                desc: 'Live operation tested on before launch. Real jobs, real routes, real pressure.',
              },
            ].map((stat, i) => (
              <Fade key={i} delay={i * 0.08}>
                <div style={{ fontFamily: FONT, fontSize: 'clamp(1.6rem, 5vw, 2.2rem)', fontWeight: 900, color: C.accent, lineHeight: 1, marginBottom: 12 }}>
                  {stat.num}
                </div>
                <div style={{ fontSize: '0.88rem', color: 'rgba(245,242,239,0.6)', lineHeight: 1.6 }}>
                  {stat.desc}
                </div>
              </Fade>
            ))}
          </div>
        </Section>
      </div>

      {/* ── Section D: How It Works ── */}
      <div style={{ background: C.bg }}>
        <Section>
          <Fade>
            <Tag teal>How It Works</Tag>
            <H2>Five steps. Nothing goes live until you&apos;ve watched it work.</H2>
          </Fade>
          <div style={{ marginTop: 24 }}>
            {[
              {
                s: '1',
                t: 'Free Assessment',
                d: "5 minutes. Get your specific numbers: hours lost, cost of admin, what's actually possible for your fleet.",
                color: C.accent,
              },
              {
                s: '2',
                t: 'Honest Conversation',
                d: "15 minutes. I'll tell you honestly whether AI automation would make sense for your operation right now.",
                color: C.accent,
              },
              {
                s: '3',
                t: 'Learning Mode',
                d: 'Weeks 1\u20134. It watches your operation. Reads the emails, learns your customers, understands your formats. Touches nothing.',
                color: C.teal,
              },
              {
                s: '4',
                t: 'Review Mode',
                d: 'Weeks 5\u20138. It starts processing. Your team reviews every output before anything goes live. You see it working on your real jobs.',
                color: C.teal,
              },
              {
                s: '5',
                t: 'Running On Its Own',
                d: "Week 9+. Handles the jobs it's confident on autonomously. Flags anything uncertain for human sign-off. You stay in control.",
                color: C.accent,
              },
            ].map((step, i) => (
              <Fade key={i} delay={i * 0.08}>
                <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 20 }}>
                  <div
                    style={{
                      fontFamily: FONT,
                      fontSize: '0.85rem',
                      color: step.color,
                      background: step.color === C.teal ? C.tealDim : C.accentDim,
                      padding: '6px 12px',
                      borderRadius: 6,
                      fontWeight: 800,
                      minWidth: 36,
                      textAlign: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {step.s}
                  </div>
                  <div>
                    <div style={{ fontFamily: FONT, color: C.text, fontWeight: 700, marginBottom: 4 }}>{step.t}</div>
                    <div style={{ color: C.textMid, fontSize: '0.92rem', lineHeight: 1.6 }}>{step.d}</div>
                  </div>
                </div>
              </Fade>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: 32, paddingBottom: 40 }}>
            <Fade delay={0.5}>
              <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
                <Link href="/assessment"><Btn primary>Take the Free Assessment →</Btn></Link>
                <Btn onClick={openCalendly}>Book a 15-Minute Call</Btn>
              </div>
            </Fade>
          </div>
        </Section>
      </div>
    </div>
  );
}
