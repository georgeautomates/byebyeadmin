'use client';

import { useState, useEffect, useRef } from 'react';
import { notFound, useParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Btn, Tag } from '@/components/ui';
import { C, FONT, MONO } from '@/lib/constants';
import { POSTS, getPost, getRelatedPosts, type Block, type Post } from '@/lib/blog-posts';
import { ReadingProgress } from '@/components/ReadingProgress';

gsap.registerPlugin(ScrollTrigger);

const OUTFIT = "'Outfit', sans-serif";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function getTocHeadings(content: Block[]): { id: string; text: string }[] {
  return content
    .filter((b): b is Extract<Block, { type: 'h2' }> => b.type === 'h2')
    .map((b) => ({ id: slugify(b.text), text: b.text }));
}

function useCalendlyOrNoop() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useCalendly } = require('@/lib/calendly-context');
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useCalendly();
  } catch {
    return { openCalendly: () => {} };
  }
}

// ─── Content block renderer ───────────────────────────────────────────────────

function BlockRenderer({
  block,
  isFirst,
  openCalendly,
}: {
  block: Block;
  isFirst: boolean;
  openCalendly: () => void;
}) {
  switch (block.type) {
    case 'p': {
      if (isFirst) {
        // Drop cap on first paragraph
        const first = block.text[0];
        const rest = block.text.slice(1);
        return (
          <p
            style={{
              fontFamily: FONT,
              fontSize: '1.08rem',
              lineHeight: 1.85,
              color: C.textMid,
              margin: '0 0 22px',
            }}
          >
            <span
              style={{
                float: 'left',
                fontFamily: OUTFIT,
                fontWeight: 900,
                fontSize: 'clamp(3.2rem, 7vw, 4.5rem)',
                lineHeight: 0.82,
                color: C.accent,
                marginRight: '0.07em',
                marginTop: '0.06em',
                marginBottom: '-0.15em',
              }}
            >
              {first}
            </span>
            {rest}
          </p>
        );
      }
      return (
        <p
          style={{
            fontFamily: FONT,
            fontSize: '1.08rem',
            lineHeight: 1.85,
            color: C.textMid,
            margin: '0 0 22px',
          }}
        >
          {block.text}
        </p>
      );
    }

    case 'h2':
      return (
        <h2
          id={slugify(block.text)}
          style={{
            fontFamily: OUTFIT,
            fontSize: 'clamp(1.3rem, 3vw, 1.7rem)',
            fontWeight: 800,
            color: C.text,
            lineHeight: 1.2,
            margin: '48px 0 16px',
            scrollMarginTop: 100,
          }}
        >
          {block.text}
        </h2>
      );

    case 'h3':
      return (
        <h3
          id={slugify(block.text)}
          style={{
            fontFamily: OUTFIT,
            fontSize: 'clamp(1.05rem, 2.5vw, 1.25rem)',
            fontWeight: 700,
            color: C.text,
            lineHeight: 1.3,
            margin: '36px 0 12px',
            scrollMarginTop: 100,
          }}
        >
          {block.text}
        </h3>
      );

    case 'quote':
      return (
        <blockquote
          style={{
            margin: '36px -32px',
            padding: '24px 32px 24px 56px',
            borderLeft: 'none',
            position: 'relative',
            background: 'rgba(232,97,45,0.035)',
            borderRadius: 4,
          }}
        >
          {/* Large decorative quote mark */}
          <span
            style={{
              position: 'absolute',
              left: 12,
              top: 4,
              fontFamily: OUTFIT,
              fontSize: '4rem',
              fontWeight: 900,
              color: C.accent,
              lineHeight: 1,
              opacity: 0.35,
            }}
          >
            &ldquo;
          </span>
          <p
            style={{
              fontFamily: OUTFIT,
              fontSize: 'clamp(1.1rem, 3vw, 1.45rem)',
              fontWeight: 700,
              fontStyle: 'normal',
              color: C.text,
              lineHeight: 1.4,
              margin: 0,
            }}
          >
            {block.text}
          </p>
          {block.attribution && (
            <p
              style={{
                fontFamily: MONO,
                fontSize: '0.75rem',
                color: C.textDim,
                margin: '10px 0 0',
                letterSpacing: '0.06em',
              }}
            >
              — {block.attribution}
            </p>
          )}
        </blockquote>
      );

    case 'callout':
      return (
        <div
          data-callout="true"
          style={{
            background: block.accent ? C.bgDark : 'rgba(45,139,139,0.05)',
            borderLeft: `4px solid ${block.accent ? C.accent : C.teal}`,
            borderRadius: '0 10px 10px 0',
            padding: '18px 22px',
            margin: '32px 0',
          }}
        >
          <p
            style={{
              fontFamily: MONO,
              fontSize: '0.62rem',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: block.accent ? C.accent : C.teal,
              margin: '0 0 8px',
              fontWeight: 700,
            }}
          >
            {block.accent ? 'Key figure' : 'Note'}
          </p>
          <p
            style={{
              fontFamily: FONT,
              fontSize: '1rem',
              lineHeight: 1.72,
              color: block.accent ? '#F5F2EF' : C.textMid,
              fontWeight: block.accent ? 600 : 400,
              margin: 0,
            }}
          >
            {block.text}
          </p>
        </div>
      );

    case 'list':
      return (
        <ul style={{ margin: '16px 0 22px', paddingLeft: 0, listStyle: 'none' }}>
          {block.items.map((item, i) => (
            <li
              key={i}
              style={{
                fontFamily: FONT,
                fontSize: '1.04rem',
                lineHeight: 1.75,
                color: C.textMid,
                padding: '5px 0 5px 22px',
                position: 'relative',
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  left: 0,
                  top: '0.65em',
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  background: C.accent,
                  display: 'block',
                  flexShrink: 0,
                }}
              />
              {item}
            </li>
          ))}
        </ul>
      );

    case 'number-list':
      return (
        <ol style={{ margin: '16px 0 22px', paddingLeft: 0, listStyle: 'none' }}>
          {block.items.map((item, i) => (
            <li
              key={i}
              style={{
                fontFamily: FONT,
                fontSize: '1.04rem',
                lineHeight: 1.75,
                color: C.textMid,
                padding: '5px 0 5px 36px',
                position: 'relative',
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  left: 0,
                  top: '0.35em',
                  fontFamily: MONO,
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  color: C.accent,
                  background: C.accentDim,
                  borderRadius: 4,
                  width: 24,
                  height: 24,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {i + 1}
              </span>
              {item}
            </li>
          ))}
        </ol>
      );

    case 'divider':
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '40px 0' }}>
          <div style={{ height: 1, flex: 1, background: C.borderLight }} />
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: C.accent, opacity: 0.4 }} />
          <div style={{ height: 1, flex: 1, background: C.borderLight }} />
        </div>
      );

    case 'cta':
      return (
        <div
          style={{
            background: C.bgDark,
            borderRadius: 12,
            padding: 'clamp(28px, 4vw, 40px) clamp(20px, 4vw, 36px)',
            margin: '40px 0',
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Faint accent corner */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: 120,
              height: 120,
              background: `radial-gradient(circle at top right, rgba(232,97,45,0.08), transparent 70%)`,
              pointerEvents: 'none',
            }}
          />
          {block.subtext && (
            <p
              style={{
                fontFamily: FONT,
                color: 'rgba(245,242,239,0.55)',
                fontSize: '0.95rem',
                lineHeight: 1.65,
                margin: '0 0 20px',
                position: 'relative',
                zIndex: 1,
              }}
            >
              {block.subtext}
            </p>
          )}
          <div
            style={{
              display: 'flex',
              gap: 12,
              justifyContent: 'center',
              flexWrap: 'wrap',
              position: 'relative',
              zIndex: 1,
            }}
          >
            <Link href={block.href}>
              <Btn primary>{block.label} →</Btn>
            </Link>
            <Btn onClick={openCalendly}>Book a Call</Btn>
          </div>
        </div>
      );

    default:
      return null;
  }
}

// ─── Inline newsletter ────────────────────────────────────────────────────────

function InlineNewsletter() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  return (
    <div
      style={{
        background: C.bgDark,
        borderRadius: 12,
        padding: 'clamp(24px, 4vw, 36px)',
        margin: '40px 0',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 2,
          background: `linear-gradient(90deg, ${C.teal}, transparent)`,
          opacity: 0.4,
        }}
      />
      <p
        style={{
          fontFamily: MONO,
          fontSize: '0.65rem',
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: C.teal,
          margin: '0 0 10px',
        }}
      >
        The Dispatch
      </p>
      <p
        style={{
          fontFamily: OUTFIT,
          fontSize: 'clamp(1rem, 2.5vw, 1.25rem)',
          fontWeight: 800,
          color: '#F5F2EF',
          margin: '0 0 6px',
        }}
      >
        Practical AI updates for UK fleet operators.
      </p>
      <p
        style={{
          fontFamily: FONT,
          color: 'rgba(245,242,239,0.45)',
          fontSize: '0.88rem',
          margin: '0 0 20px',
        }}
      >
        No fluff. Once a month.
      </p>
      {submitted ? (
        <p style={{ fontFamily: OUTFIT, color: C.accent, fontWeight: 700 }}>
          You are on the list.
        </p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (email) setSubmitted(true);
          }}
          style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}
        >
          <input
            type="email"
            required
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              fontFamily: FONT,
              fontSize: '0.9rem',
              padding: '11px 15px',
              borderRadius: 8,
              border: '1px solid rgba(245,242,239,0.12)',
              background: 'rgba(255,255,255,0.06)',
              color: '#F5F2EF',
              outline: 'none',
              minWidth: 220,
              flex: '1 1 auto',
              maxWidth: 280,
            }}
          />
          <Btn primary type="submit">Subscribe</Btn>
        </form>
      )}
    </div>
  );
}

// ─── Desktop TOC ──────────────────────────────────────────────────────────────

function TOC({
  headings,
  activeId,
}: {
  headings: { id: string; text: string }[];
  activeId: string;
}) {
  if (headings.length === 0) return null;
  return (
    <div>
      <p
        style={{
          fontFamily: MONO,
          fontSize: '0.63rem',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: C.textLight,
          margin: '0 0 14px',
        }}
      >
        In this article
      </p>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {headings.map((h, i) => {
          const active = h.id === activeId;
          return (
            <a
              key={h.id}
              href={`#${h.id}`}
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'flex-start',
                padding: '5px 0 5px 10px',
                textDecoration: 'none',
                borderLeft: `2px solid ${active ? C.accent : C.borderLight}`,
                transition: 'border-color 0.15s',
              }}
            >
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: '0.6rem',
                  color: active ? C.accent : C.textLight,
                  fontWeight: 700,
                  flexShrink: 0,
                  marginTop: 3,
                  transition: 'color 0.15s',
                }}
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <span
                style={{
                  fontFamily: FONT,
                  fontSize: '0.79rem',
                  lineHeight: 1.4,
                  color: active ? C.accent : C.textDim,
                  fontWeight: active ? 700 : 500,
                  transition: 'color 0.15s',
                }}
              >
                {h.text}
              </span>
            </a>
          );
        })}
      </nav>
    </div>
  );
}

// ─── Mobile TOC ───────────────────────────────────────────────────────────────

function MobileTOC({ headings }: { headings: { id: string; text: string }[] }) {
  const [open, setOpen] = useState(false);
  if (headings.length === 0) return null;
  return (
    <div
      style={{
        background: C.bgWhite,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        marginBottom: 32,
        overflow: 'hidden',
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '14px 18px',
          fontFamily: OUTFIT,
          fontSize: '0.88rem',
          fontWeight: 700,
          color: C.text,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        <span>In this article</span>
        <span style={{ color: C.accent, fontSize: '1rem' }}>{open ? '↑' : '↓'}</span>
      </button>
      {open && (
        <div style={{ borderTop: `1px solid ${C.borderLight}`, padding: '12px 18px 16px' }}>
          {headings.map((h, i) => (
            <a
              key={h.id}
              href={`#${h.id}`}
              onClick={() => setOpen(false)}
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                fontFamily: FONT,
                fontSize: '0.88rem',
                color: C.textMid,
                textDecoration: 'none',
                padding: '6px 0',
                borderBottom: `1px solid ${C.borderLight}`,
              }}
            >
              <span style={{ fontFamily: MONO, fontSize: '0.65rem', color: C.accent, fontWeight: 700, flexShrink: 0 }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              {h.text}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Related post strip ───────────────────────────────────────────────────────

function RelatedStrip({ post, index }: { post: Post; index: number }) {
  const [hovered, setHovered] = useState(false);
  return (
    <Link href={`/blog/${post.slug}`} style={{ textDecoration: 'none', display: 'block' }}>
      <article
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          position: 'relative',
          borderBottom: `1px solid ${C.border}`,
          padding: 'clamp(20px, 4vw, 32px) 0',
          overflow: 'hidden',
          cursor: 'pointer',
        }}
      >
        <span
          style={{
            position: 'absolute',
            right: 0,
            top: '50%',
            transform: 'translateY(-50%)',
            fontFamily: OUTFIT,
            fontWeight: 900,
            fontSize: 'clamp(3.5rem, 8vw, 6rem)',
            color: hovered ? 'rgba(232,97,45,0.12)' : 'rgba(232,97,45,0.055)',
            lineHeight: 1,
            pointerEvents: 'none',
            userSelect: 'none',
            transition: 'color 0.3s ease',
          }}
        >
          {String(index + 1).padStart(2, '0')}
        </span>
        <div
          style={{
            position: 'absolute',
            left: -2,
            top: 0,
            bottom: 0,
            width: 3,
            background: C.accent,
            transform: hovered ? 'scaleY(1)' : 'scaleY(0)',
            transformOrigin: 'top',
            transition: 'transform 0.3s ease',
          }}
        />
        <div style={{ position: 'relative', zIndex: 1, paddingLeft: hovered ? 12 : 0, transition: 'padding-left 0.3s ease' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontFamily: MONO, fontSize: '0.65rem', color: C.accent, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700 }}>
              {post.category}
            </span>
            <span style={{ fontFamily: MONO, fontSize: '0.65rem', color: C.textLight }}>{post.readTime}</span>
          </div>
          <h3
            style={{
              fontFamily: OUTFIT,
              fontSize: 'clamp(1rem, 2.5vw, 1.3rem)',
              fontWeight: 800,
              color: hovered ? C.accent : C.text,
              lineHeight: 1.2,
              margin: '0 0 6px',
              transition: 'color 0.2s ease',
              maxWidth: '75%',
            }}
          >
            {post.title}
          </h3>
          <span style={{ fontFamily: OUTFIT, fontSize: '0.85rem', fontWeight: 700, color: C.accent, opacity: hovered ? 1 : 0.6, transition: 'opacity 0.2s' }}>
            Read →
          </span>
        </div>
      </article>
    </Link>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ArticlePage() {
  const params = useParams();
  const slug = typeof params?.slug === 'string' ? params.slug : '';
  const post = getPost(slug);

  if (!post) return notFound();

  const related = getRelatedPosts(slug);
  const toc = getTocHeadings(post.content);
  const postIndex = POSTS.findIndex((p) => p.slug === slug);

  const [activeId, setActiveId] = useState('');
  const [wide, setWide] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const { openCalendly } = useCalendlyOrNoop();

  useEffect(() => {
    const fn = () => setWide(window.innerWidth >= 900);
    fn();
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);

  // Active TOC heading tracker
  useEffect(() => {
    if (toc.length === 0) return;
    const els = toc.map(({ id }) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) setActiveId(visible[0].target.id);
      },
      { rootMargin: '-20% 0px -60% 0px' }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [toc]);

  // GSAP ScrollTrigger for article elements
  useEffect(() => {
    if (!contentRef.current) return;
    const ctx = gsap.context(() => {
      // H2 headings: slide in from left
      gsap.utils.toArray<HTMLElement>('h2', contentRef.current!).forEach((el) => {
        gsap.fromTo(
          el,
          { opacity: 0, x: -20 },
          {
            opacity: 1,
            x: 0,
            duration: 0.55,
            ease: 'power2.out',
            scrollTrigger: { trigger: el, start: 'top 88%', once: true },
          }
        );
      });
      // List items: stagger upward
      gsap.utils.toArray<HTMLElement>('li', contentRef.current!).forEach((el, i) => {
        gsap.fromTo(
          el,
          { opacity: 0, y: 14 },
          {
            opacity: 1,
            y: 0,
            duration: 0.4,
            ease: 'power2.out',
            delay: (i % 5) * 0.055,
            scrollTrigger: { trigger: el, start: 'top 90%', once: true },
          }
        );
      });
      // Callout blocks: scale up
      gsap.utils.toArray<HTMLElement>('[data-callout]', contentRef.current!).forEach((el) => {
        gsap.fromTo(
          el,
          { opacity: 0, scale: 0.975, y: 10 },
          {
            opacity: 1,
            scale: 1,
            y: 0,
            duration: 0.5,
            ease: 'power2.out',
            scrollTrigger: { trigger: el, start: 'top 87%', once: true },
          }
        );
      });
    }, contentRef);
    return () => ctx.revert();
  }, []);

  // Insert newsletter CTA after 60% of content blocks
  const insertAt = Math.floor(post.content.length * 0.6);
  const blocksWithNewsletter: (Block | { type: '__newsletter' })[] = [
    ...post.content.slice(0, insertAt),
    { type: '__newsletter' },
    ...post.content.slice(insertAt),
  ];

  // Framer Motion variants for title word-by-word reveal
  const titleContainer = {
    hidden: {},
    show: { transition: { staggerChildren: 0.055, delayChildren: 0.15 } },
  };
  const titleWord = {
    hidden: { opacity: 0, y: 22, filter: 'blur(4px)' },
    show: {
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
    },
  };

  return (
    <div style={{ paddingTop: 80, background: C.bg, minHeight: '100vh' }}>
      <ReadingProgress />

      {/* ── Dark masthead ── */}
      <div style={{ background: C.bgDark, position: 'relative', overflow: 'hidden' }}>

        {/* Faded post number decoration */}
        <div
          style={{
            position: 'absolute',
            right: 'clamp(8px, 4vw, 48px)',
            top: 0,
            fontFamily: OUTFIT,
            fontWeight: 900,
            fontSize: 'clamp(7rem, 18vw, 15rem)',
            color: 'rgba(245,242,239,0.03)',
            lineHeight: 0.85,
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          {String(postIndex + 1).padStart(2, '0')}
        </div>

        {/* Subtle radial glow */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: '20%',
            width: 500,
            height: 300,
            background: 'radial-gradient(ellipse, rgba(232,97,45,0.06) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />

        <div
          style={{
            maxWidth: 860,
            margin: '0 auto',
            padding: 'clamp(44px, 7vw, 80px) clamp(16px, 5vw, 24px)',
            position: 'relative',
            zIndex: 1,
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <Tag>{post.category}</Tag>
          </motion.div>

          {/* Word-by-word title reveal */}
          <motion.h1
            variants={titleContainer}
            initial="hidden"
            animate="show"
            style={{
              fontFamily: OUTFIT,
              fontSize: 'clamp(1.9rem, 5vw, 3.4rem)',
              fontWeight: 900,
              color: '#F5F2EF',
              lineHeight: 1.1,
              margin: '16px 0 22px',
              display: 'block',
            }}
          >
            {post.title.split(' ').map((word, i) => (
              <motion.span
                key={i}
                variants={titleWord}
                style={{ display: 'inline-block', marginRight: '0.28em' }}
              >
                {word}
              </motion.span>
            ))}
          </motion.h1>

          {/* Meta row */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}
          >
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: '50%',
                background: C.accent,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: OUTFIT,
                fontWeight: 800,
                fontSize: '0.75rem',
                color: '#FFFFFF',
                flexShrink: 0,
              }}
            >
              G
            </div>
            <span style={{ fontFamily: FONT, fontSize: '0.82rem', color: 'rgba(245,242,239,0.5)' }}>
              George, ByeByeAdmin
            </span>
            <span style={{ color: 'rgba(245,242,239,0.2)', fontFamily: MONO, fontSize: '0.7rem' }}>·</span>
            <span style={{ fontFamily: MONO, fontSize: '0.72rem', color: 'rgba(245,242,239,0.35)' }}>
              {formatDate(post.date)}
            </span>
            <span style={{ color: 'rgba(245,242,239,0.2)', fontFamily: MONO, fontSize: '0.7rem' }}>·</span>
            <span style={{ fontFamily: MONO, fontSize: '0.72rem', color: 'rgba(245,242,239,0.35)' }}>
              {post.readTime}
            </span>
          </motion.div>

          {/* Animated entry rule */}
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.75, delay: 0.75, ease: [0.16, 1, 0.3, 1] }}
            style={{
              height: 2,
              background: C.accent,
              transformOrigin: 'left',
              marginTop: 24,
            }}
          />
        </div>
      </div>

      {/* ── Body ── */}
      <div
        style={{
          maxWidth: 980,
          margin: '0 auto',
          padding: 'clamp(36px, 5vw, 56px) clamp(16px, 5vw, 24px)',
          display: wide ? 'grid' : 'block',
          gridTemplateColumns: wide ? '200px 1fr' : undefined,
          gap: wide ? 48 : undefined,
          alignItems: 'start',
        }}
      >
        {/* TOC — sticky desktop */}
        {wide && (
          <div style={{ position: 'sticky', top: 100 }}>
            <TOC headings={toc} activeId={activeId} />
          </div>
        )}

        {/* Article content */}
        <div ref={contentRef} style={{ maxWidth: 660 }}>
          {!wide && <MobileTOC headings={toc} />}

          {blocksWithNewsletter.map((block, i) => {
            if (block.type === '__newsletter') {
              return <InlineNewsletter key="newsletter" />;
            }
            // Find the index among only 'p' blocks to detect the first one
            const pBlocksBefore = blocksWithNewsletter
              .slice(0, i)
              .filter((b) => b.type !== '__newsletter' && (b as Block).type === 'p').length;
            const isFirst = (block as Block).type === 'p' && pBlocksBefore === 0;
            return (
              <BlockRenderer
                key={i}
                block={block as Block}
                isFirst={isFirst}
                openCalendly={openCalendly}
              />
            );
          })}

          {/* Author section */}
          <div
            style={{
              borderTop: `1px solid ${C.border}`,
              marginTop: 52,
              paddingTop: 32,
              display: 'flex',
              gap: 16,
              alignItems: 'center',
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: C.accent,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: OUTFIT,
                fontWeight: 900,
                fontSize: '1.1rem',
                color: '#FFFFFF',
                flexShrink: 0,
              }}
            >
              G
            </div>
            <div>
              <p style={{ fontFamily: OUTFIT, fontSize: '0.95rem', fontWeight: 800, color: C.text, margin: 0 }}>
                George
              </p>
              <p style={{ fontFamily: FONT, fontSize: '0.82rem', color: C.textDim, margin: '2px 0 0' }}>
                Founder, ByeByeAdmin. Building AI automation for UK haulage operators.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Related posts ── */}
      {related.length > 0 && (
        <div style={{ background: C.bgWhite, borderTop: `1px solid ${C.border}` }}>
          <div
            style={{
              maxWidth: 900,
              margin: '0 auto',
              padding: 'clamp(36px, 5vw, 52px) clamp(16px, 5vw, 24px)',
            }}
          >
            <p
              style={{
                fontFamily: MONO,
                fontSize: '0.65rem',
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: C.textLight,
                margin: '0 0 4px',
              }}
            >
              Keep reading
            </p>
            <h2
              style={{
                fontFamily: OUTFIT,
                fontSize: 'clamp(1.1rem, 3vw, 1.5rem)',
                fontWeight: 800,
                color: C.text,
                margin: '0 0 8px',
              }}
            >
              More from the Dispatch
            </h2>
            {related.map((p, i) => (
              <RelatedStrip key={p.slug} post={p} index={i} />
            ))}
          </div>
        </div>
      )}

      {/* ── Bottom CTA ── */}
      <div style={{ background: C.bgDark }}>
        <div
          style={{
            maxWidth: 680,
            margin: '0 auto',
            padding: 'clamp(48px, 7vw, 80px) clamp(16px, 5vw, 24px)',
            textAlign: 'center',
          }}
        >
          <p
            style={{
              fontFamily: MONO,
              fontSize: '0.65rem',
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: C.teal,
              margin: '0 0 12px',
            }}
          >
            Next step
          </p>
          <h2
            style={{
              fontFamily: OUTFIT,
              fontSize: 'clamp(1.5rem, 4vw, 2.2rem)',
              fontWeight: 900,
              color: '#F5F2EF',
              margin: '0 0 12px',
              lineHeight: 1.15,
            }}
          >
            Ready to remove the admin from your operation?
          </h2>
          <p
            style={{
              fontFamily: FONT,
              color: 'rgba(245,242,239,0.5)',
              fontSize: '0.95rem',
              lineHeight: 1.65,
              margin: '0 0 28px',
            }}
          >
            Take the free 5-minute assessment and see exactly how much your fleet could save.
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/assessment">
              <Btn primary>Take the Free Assessment →</Btn>
            </Link>
            <Btn onClick={openCalendly}>Book a 15-Minute Call</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}
