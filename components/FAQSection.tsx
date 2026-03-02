'use client';

import { useState } from 'react';
import { Fade, Section, H2, P } from '@/components/ui';
import { C, FONT } from '@/lib/constants';

const FAQS = [
  {
    q: 'What does this actually cost?',
    a: "Honestly, it varies depending on your operation — the size of your fleet, how many processes we're automating, and how complex your current setup is. What I can tell you is that for most operators, the system pays for itself within the first few months just from the admin hours it frees up. The free assessment gives you a clear picture of the numbers before any conversation about cost happens. I'm not going to quote you something without actually understanding your operation first.",
  },
  {
    q: 'What if the AI makes a mistake?',
    a: "This is the question I get most often, and it's the right one to ask. So here's how we handle it: the system doesn't just run and hope for the best. It has a confidence threshold built in. If it's confident about a job, it processes it. If it's not confident (maybe the email is ambiguous, or it's something it hasn't seen before) it flags it for your team to review rather than guessing. And in the early weeks, everything goes to your team for review anyway, regardless of confidence. You see every output before anything goes live. The error rate ends up lower than manual entry, but more importantly, the errors that do happen get caught, because the system is designed to catch them.",
  },
  {
    q: "We've already got a TMS. Will this work with it?",
    a: "Almost certainly, yes. The system is built to work alongside whatever you're already using. It's not a replacement for your TMS, it's the layer that sits in front of it and handles the incoming work. So instead of your team logging into portals and typing orders in manually, the system does that for them. Your TMS keeps doing what it does. We just take away the manual input that's eating up your team's time.",
  },
  {
    q: 'My operation is quite specific. Will it understand how we work?',
    a: "This is actually exactly what the learning phase is designed for. The first few weeks, it just watches your operation. It reads your emails, learns your customers, picks up your formats. It works out that certain customers always send jobs a certain way, that your language for specific routes is different from the standard. It learns your operation specifically, not a generic version of haulage. That's the whole point.",
  },
  {
    q: 'What happens to my admin staff?',
    a: "This comes up a lot, and I want to be straight about it. The goal isn't to get rid of your team. It's to stop them spending their days on data entry and repetitive tasks that frankly aren't a good use of anyone's time. The operators I work with tend to find that their admin people end up doing more valuable work — customer relationships, problem-solving, handling the jobs that actually need a human. What you do with the capacity is up to you. Some operators grow their volume without adding headcount. Some redeploy people into other parts of the business. That's a conversation worth having once you know what the automation can actually do for you.",
  },
  {
    q: "I've tried software before and it didn't stick. Why is this different?",
    a: "Because most software still requires your team to work inside it. It moves the admin around rather than actually removing it. What we've built doesn't ask your team to change how they work — it works in the background and handles the tasks automatically. Your team interacts with it when something needs a decision, not to do the data entry. That's the fundamental difference, and it's why it tends to stick where other things haven't.",
  },
  {
    q: 'How long does it take to get set up?',
    a: "Usually six to eight weeks from the initial conversation to the system running on its own. The first four weeks are learning mode — it watches, doesn't touch anything, and your team carries on as normal. Weeks five to eight are review mode — it starts processing, your team checks every output. By week nine, it's handling the jobs it's confident on autonomously. It's a deliberate pace because rushing it doesn't serve anyone.",
  },
  {
    q: 'Do I have to sign a long contract?',
    a: "No. There's no long contract and no exit fee. If at any point it's not working for you, you stop. I'd rather earn your trust by the system actually working than lock you into something. That's not how I want to work, and honestly it's not how you'd want it either.",
  },
  {
    q: 'You mentioned you tested this on a seventy-vehicle operation. Does it work for smaller fleets?',
    a: "Yes, and in some ways it makes more sense for smaller operators than larger ones. If you're running eight vehicles with one person handling all the admin, that person is probably the most overloaded person in your business. Taking forty hours of manual work off their plate every week has a proportionally bigger impact than it does in a bigger operation with a full admin team. The free assessment will tell you specifically what the numbers look like for your size.",
  },
  {
    q: "What if I'm not sure it's right for me yet?",
    a: "That's completely fine — that's what the free assessment and the fifteen-minute call are for. Take the assessment, get your numbers, and if you want to talk it through, book a call. I'll give you an honest view of whether I think it makes sense for your operation. If I don't think it does, I'll tell you that. There's no pressure and no pitch. Just a conversation.",
  },
];

interface FAQItemProps {
  q: string;
  a: string;
  open: boolean;
  onToggle: () => void;
  isLast: boolean;
}

function FAQItem({ q, a, open, onToggle, isLast }: FAQItemProps) {
  return (
    <div style={{ borderBottom: isLast ? 'none' : `1px solid ${C.border}` }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
          padding: '20px 0',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          minHeight: 44,
        }}
        aria-expanded={open}
      >
        <span
          style={{
            fontFamily: FONT,
            fontWeight: 700,
            color: C.text,
            fontSize: '1rem',
            lineHeight: 1.4,
          }}
        >
          {q}
        </span>
        <span
          style={{
            fontFamily: FONT,
            fontWeight: 800,
            fontSize: '1.4rem',
            color: C.accent,
            lineHeight: 1,
            flexShrink: 0,
            transition: 'transform 0.3s ease',
            transform: open ? 'rotate(45deg)' : 'rotate(0deg)',
            display: 'inline-block',
          }}
          aria-hidden
        >
          +
        </span>
      </button>

      {/* CSS grid open/close trick — no JS height measurement needed */}
      <div
        style={{
          display: 'grid',
          gridTemplateRows: open ? '1fr' : '0fr',
          transition: 'grid-template-rows 0.3s ease',
        }}
      >
        <div style={{ overflow: 'hidden' }}>
          <P style={{ color: C.textMid, margin: 0, paddingBottom: 20 }}>{a}</P>
        </div>
      </div>
    </div>
  );
}

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number>(0);

  return (
    <div style={{ background: C.bgWhite }}>
      <Section>
        <Fade>
          <H2>Questions worth asking.</H2>
        </Fade>
        <Fade delay={0.05}>
          <P style={{ color: C.textMid, marginBottom: 32 }}>
            The things most operators ask before they decide.
          </P>
        </Fade>
        <Fade delay={0.1}>
          <div
            style={{
              background: '#FFFFFF',
              border: `1px solid ${C.border}`,
              borderRadius: 12,
              padding: '0 24px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}
          >
            {FAQS.map((faq, i) => (
              <FAQItem
                key={i}
                q={faq.q}
                a={faq.a}
                open={openIndex === i}
                onToggle={() => setOpenIndex(openIndex === i ? -1 : i)}
                isLast={i === FAQS.length - 1}
              />
            ))}
          </div>
        </Fade>
      </Section>
    </div>
  );
}
