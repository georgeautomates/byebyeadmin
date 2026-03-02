import { Fade, Btn, Section, Card, Divider, Tag, Quote, H2, P, Strong, Acc } from '@/components/ui';
import { C, FONT } from '@/lib/constants';
import Link from 'next/link';

export default function AboutPage() {
  return (
    <div style={{ paddingTop: 80 }}>
      {/* ── Founder story ── */}
      <div style={{ background: C.bg }}>
        <Section>
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
              I Didn&apos;t Set Out to Build AI Automation for Haulage.{' '}
              <Acc>But I Couldn&apos;t Not Do It.</Acc>
            </h1>
          </Fade>
          <Fade delay={0.1}>
            <P>
              I got into haulage because it was there. Discovered two things: the people are brilliant &mdash; resourceful,
              tough, pragmatic. And <Strong>the admin is absolutely crushing them.</Strong>
            </P>
            <P>
              I watched operators plan 40 drops across 15 vehicles in their head then spend three hours typing orders
              into spreadsheets. Owner-operators working six-day weeks &mdash; not because of driving work, but paperwork.
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
            <Divider />
          </Fade>

          {/* Credentials grid */}
          <Fade delay={0.25}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
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
          <Fade delay={0.3}>
            <P>
              <Strong>
                I&apos;m early. I&apos;d rather be honest about that than oversell it. But what I&apos;m building works
                &mdash; and I&apos;m building it for the people who need it most.
              </Strong>
            </P>
          </Fade>
        </Section>
      </div>

      {/* ── How It Works ── */}
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
                d: '5 minutes. Get your specific numbers — hours lost, cost of admin, what\'s actually possible for your fleet.',
                color: C.accent,
              },
              {
                s: '2',
                t: 'Honest Conversation',
                d: '15 minutes. I\'ll tell you honestly whether AI automation would make sense for your operation right now.',
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
                d: 'Week 9+. Handles the jobs it\'s confident on autonomously. Flags anything uncertain for human sign-off. You stay in control.',
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
          <Fade delay={0.45}>
            <P style={{ fontStyle: 'italic', color: C.textMid }}>
              If at any point it&apos;s not working for you, you stop. No contract. No exit fee.
            </P>
          </Fade>
          <div style={{ textAlign: 'center', marginTop: 32, paddingBottom: 40 }}>
            <Fade delay={0.5}>
              <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
                <Link href="/assessment"><Btn primary>Take the Free Assessment →</Btn></Link>
                <Link href="/contact"><Btn>Book a 15-Minute Call</Btn></Link>
              </div>
            </Fade>
          </div>
        </Section>
      </div>
    </div>
  );
}
