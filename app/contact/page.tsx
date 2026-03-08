'use client';

import { Fade, Btn, Section, Card, TealCard, Divider, Tag, P, Strong } from '@/components/ui';
import { C, FONT, MONO } from '@/lib/constants';
import Link from 'next/link';
import { useCalendly } from '@/lib/calendly-context';

export default function ContactPage() {
  const { openCalendly } = useCalendly();
  return (
    <div style={{ paddingTop: 80 }}>
      {/* Header */}
      <div style={{ background: C.bg }}>
        <Section>
          <Fade>
            <Tag teal>Get in Touch</Tag>
            <h1
              style={{
                fontFamily: FONT,
                fontSize: 'clamp(2rem, 4.5vw, 2.8rem)',
                fontWeight: 900,
                color: C.text,
                lineHeight: 1.12,
                margin: '16px 0 12px',
              }}
            >
              Let&apos;s Have a Conversation.
            </h1>
            <P style={{ fontSize: '1.1rem' }}>
              No 15-field form. No sales presentation. Just a straight conversation.
            </P>
          </Fade>
        </Section>
      </div>

      {/* Options */}
      <div style={{ background: C.bgWhite }}>
        <Section>
          <Fade delay={0.1}>
            <div style={{ display: 'grid', gap: 16 }}>
              {/* Option 1 — Assessment first */}
              <Card accent>
                <Tag>Recommended</Tag>
                <h3 style={{ color: C.text, fontSize: '1.1rem', fontWeight: 800, margin: '12px 0 8px' }}>
                  Option 1: Take the Assessment First
                </h3>
                <P style={{ margin: '0 0 16px' }}>
                  When we talk, you&apos;ll already have your numbers. People who take it first get 3× more out of
                  the conversation.
                </P>
                <Link href="/assessment">
                  <Btn primary>Take the Assessment →</Btn>
                </Link>
              </Card>

              {/* Option 2 — Book a call */}
              <Card>
                <h3 style={{ color: C.text, fontSize: '1.1rem', fontWeight: 800, margin: '0 0 8px' }}>
                  Option 2: Book a Call Directly
                </h3>
                <P style={{ margin: '0 0 16px' }}>
                  15 minutes. I&apos;ll tell you honestly whether AI automation would help right now.
                </P>
                <Btn teal onClick={openCalendly}>Book a 15-Minute Call →</Btn>
              </Card>

              {/* Option 3 — Email */}
              <Card>
                <h3 style={{ color: C.text, fontSize: '1.1rem', fontWeight: 800, margin: '0 0 8px' }}>
                  Option 3: Just Email Me
                </h3>
                <P style={{ margin: '0 0 4px' }}>
                  <a
                    href="mailto:george@byebyeadmin.com"
                    style={{ fontFamily: MONO, color: C.teal, fontWeight: 600, textDecoration: 'none' }}
                  >
                    george@byebyeadmin.com
                  </a>
                </P>
                <P style={{ margin: 0 }}>24-hour response, usually faster. No mailing list.</P>
              </Card>
            </div>
          </Fade>

          <Fade delay={0.2}>
            <P style={{ marginTop: 24, color: C.textLight }}>Based in Kent. Work UK-wide.</P>
          </Fade>

          <Divider />

          <Fade delay={0.25}>
            <TealCard style={{ textAlign: 'center' }}>
              <h3 style={{ color: C.text, fontSize: '1.1rem', fontWeight: 800, margin: '0 0 12px' }}>
                Picture this.
              </h3>
              <P>
                You take the assessment. We talk. Within 6–8 weeks, AI automation is handling your order entry and invoicing.
              </P>
              <P>
                <Strong>What does your Monday morning look like then?</Strong>
              </P>
              <P>
                No more 5 AM emails. No more Friday invoice marathons. Your admin person handles relationships, not
                data entry.
              </P>
              <P style={{ color: C.teal, fontWeight: 800, marginBottom: 0 }}>
                What would you do with an extra 60 hours a month?
              </P>
            </TealCard>
          </Fade>

          <Fade delay={0.3}>
            <P style={{ textAlign: 'center', marginTop: 20 }}>
              Not technology. Not AI. <Strong>Time. Your time. Back where it belongs.</Strong>
            </P>
          </Fade>
        </Section>
      </div>
    </div>
  );
}
