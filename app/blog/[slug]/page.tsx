'use client';

import { useState, useEffect, useRef } from 'react';
import { notFound, useParams } from 'next/navigation';
import Link from 'next/link';
import { Fade, Btn, Tag, Quote, P } from '@/components/ui';
import { C, FONT, MONO } from '@/lib/constants';
import { getPost, getRelatedPosts, type Block, type Post } from '@/lib/blog-posts';
import { ReadingProgress } from '@/components/ReadingProgress';

// ─── Helpers ────────────────────────────────────────────────────────────────

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

// ─── Content block renderer ──────────────────────────────────────────────────

function BlockRenderer({ block }: { block: Block }) {
  const { openCalendly } = useCalendlyOrNoop();

  switch (block.type) {
    case 'p':
      return (
        <p
          style={{
            fontFamily: FONT,
            fontSize: '1.05rem',
            lineHeight: 1.82,
            color: C.textMid,
            margin: '0 0 20px',
          }}
        >
          {block.text}
        </p>
      );

    case 'h2':
      return (
        <h2
          id={slugify(block.text)}
          style={{
            fontFamily: FONT,
            fontSize: 'clamp(1.25rem, 3vw, 1.65rem)',
            fontWeight: 800,
            color: C.text,
            lineHeight: 1.25,
            margin: '44px 0 16px',
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
            fontFamily: FONT,
            fontSize: 'clamp(1.05rem, 2.5vw, 1.25rem)',
            fontWeight: 700,
            color: C.text,
            lineHeight: 1.3,
            margin: '32px 0 12px',
            scrollMarginTop: 100,
          }}
        >
          {block.text}
        </h3>
      );

    case 'quote':
      return <Quote>{block.text}</Quote>;

    case 'callout':
      return (
        <div
          style={{
            background: block.accent ? C.accentDim : 'rgba(45,139,139,0.06)',
            borderLeft: `3px solid ${block.accent ? C.accent : C.teal}`,
            borderRadius: '0 8px 8px 0',
            padding: '16px 20px',
            margin: '24px 0',
          }}
        >
          <p
            style={{
              fontFamily: FONT,
              fontSize: '0.97rem',
              lineHeight: 1.72,
              color: block.accent ? C.text : C.textMid,
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
        <ul style={{ margin: '16px 0 20px', paddingLeft: 0, listStyle: 'none' }}>
          {block.items.map((item, i) => (
            <li
              key={i}
              style={{
                fontFamily: FONT,
                fontSize: '1.02rem',
                lineHeight: 1.72,
                color: C.textMid,
                padding: '5px 0 5px 24px',
                position: 'relative',
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  left: 0,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: C.accent,
                  display: 'block',
                  marginTop: 1,
                }}
              />
              {item}
            </li>
          ))}
        </ul>
      );

    case 'number-list':
      return (
        <ol style={{ margin: '16px 0 20px', paddingLeft: 0, listStyle: 'none', counterReset: 'ol' }}>
          {block.items.map((item, i) => (
            <li
              key={i}
              style={{
                fontFamily: FONT,
                fontSize: '1.02rem',
                lineHeight: 1.72,
                color: C.textMid,
                padding: '5px 0 5px 32px',
                position: 'relative',
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  left: 0,
                  top: '7px',
                  fontFamily: MONO,
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: C.accent,
                  background: C.accentDim,
                  borderRadius: 4,
                  width: 22,
                  height: 22,
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
        <div
          style={{
            height: 1,
            background: C.borderLight,
            margin: '40px auto',
            maxWidth: 120,
          }}
        />
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
          }}
        >
          {block.subtext && (
            <p
              style={{
                fontFamily: FONT,
                color: 'rgba(245,242,239,0.6)',
                fontSize: '0.92rem',
                lineHeight: 1.65,
                margin: '0 0 20px',
              }}
            >
              {block.subtext}
            </p>
          )}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
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

// Thin wrapper so BlockRenderer works even without the Calendly context
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

// ─── Table of contents ───────────────────────────────────────────────────────

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
          fontSize: '0.68rem',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: C.textLight,
          margin: '0 0 12px',
        }}
      >
        In this article
      </p>
      <nav>
        {headings.map((h) => {
          const active = h.id === activeId;
          return (
            <a
              key={h.id}
              href={`#${h.id}`}
              style={{
                display: 'block',
                fontFamily: FONT,
                fontSize: '0.82rem',
                lineHeight: 1.4,
                color: active ? C.accent : C.textDim,
                fontWeight: active ? 700 : 500,
                textDecoration: 'none',
                padding: '5px 0 5px 10px',
                borderLeft: `2px solid ${active ? C.accent : C.borderLight}`,
                marginBottom: 2,
                transition: 'color 0.15s, border-color 0.15s',
              }}
            >
              {h.text}
            </a>
          );
        })}
      </nav>
    </div>
  );
}

// ─── Mobile TOC ──────────────────────────────────────────────────────────────

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
          fontFamily: FONT,
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
          {headings.map((h) => (
            <a
              key={h.id}
              href={`#${h.id}`}
              onClick={() => setOpen(false)}
              style={{
                display: 'block',
                fontFamily: FONT,
                fontSize: '0.88rem',
                color: C.textMid,
                textDecoration: 'none',
                padding: '6px 0',
                borderBottom: `1px solid ${C.borderLight}`,
              }}
            >
              {h.text}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Newsletter inline CTA ───────────────────────────────────────────────────

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
      }}
    >
      <p
        style={{
          fontFamily: MONO,
          fontSize: '0.68rem',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: C.teal,
          margin: '0 0 10px',
        }}
      >
        Monthly briefing
      </p>
      <p
        style={{
          fontFamily: FONT,
          fontSize: 'clamp(1rem, 2.5vw, 1.2rem)',
          fontWeight: 800,
          color: '#F5F2EF',
          margin: '0 0 8px',
        }}
      >
        Practical AI updates for UK fleet operators.
      </p>
      <p
        style={{
          fontFamily: FONT,
          color: 'rgba(245,242,239,0.5)',
          fontSize: '0.88rem',
          margin: '0 0 20px',
        }}
      >
        No fluff. Once a month.
      </p>
      {submitted ? (
        <p style={{ fontFamily: FONT, color: C.accent, fontWeight: 700 }}>
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
              border: '1px solid rgba(245,242,239,0.15)',
              background: 'rgba(255,255,255,0.07)',
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

// ─── Related post card ───────────────────────────────────────────────────────

function RelatedCard({ post }: { post: Post }) {
  const [hovered, setHovered] = useState(false);
  return (
    <Link
      href={`/blog/${post.slug}`}
      style={{ textDecoration: 'none', display: 'block', height: '100%' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        style={{
          background: C.bgWhite,
          border: `1px solid ${hovered ? C.accentBorder : C.border}`,
          borderRadius: 12,
          padding: '24px 20px',
          height: '100%',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          transition: 'border-color 0.2s, box-shadow 0.2s, transform 0.2s',
          boxShadow: hovered ? '0 4px 20px rgba(31,41,55,0.08)' : 'none',
          transform: hovered ? 'translateY(-2px)' : 'none',
        }}
      >
        <Tag teal={post.category === 'Compliance'}>{post.category}</Tag>
        <h3
          style={{
            fontFamily: FONT,
            fontSize: '1.02rem',
            fontWeight: 800,
            color: C.text,
            lineHeight: 1.3,
            margin: 0,
            flex: 1,
          }}
        >
          {post.title}
        </h3>
        <p
          style={{
            fontFamily: FONT,
            fontSize: '0.88rem',
            color: C.textMid,
            lineHeight: 1.6,
            margin: 0,
          }}
        >
          {post.excerpt.slice(0, 100)}...
        </p>
        <span
          style={{
            fontFamily: FONT,
            fontSize: '0.85rem',
            fontWeight: 700,
            color: hovered ? C.accentHover : C.accent,
            transition: 'color 0.2s',
          }}
        >
          Read →
        </span>
      </div>
    </Link>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ArticlePage() {
  const params = useParams();
  const slug = typeof params?.slug === 'string' ? params.slug : '';
  const post = getPost(slug);

  if (!post) return notFound();

  const related = getRelatedPosts(slug);
  const toc = getTocHeadings(post.content);
  const [activeId, setActiveId] = useState('');
  const [wide, setWide] = useState(false);
  const articleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fn = () => setWide(window.innerWidth >= 900);
    fn();
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);

  // Active heading tracker for TOC
  useEffect(() => {
    if (toc.length === 0) return;
    const headingEls = toc
      .map(({ id }) => document.getElementById(id))
      .filter(Boolean) as HTMLElement[];

    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: '-20% 0px -60% 0px' }
    );

    headingEls.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [toc]);

  // Insert newsletter CTA after the 60% mark of content blocks
  const insertAt = Math.floor(post.content.length * 0.6);
  const blocksWithNewsletter: (Block | { type: '__newsletter' })[] = [
    ...post.content.slice(0, insertAt),
    { type: '__newsletter' },
    ...post.content.slice(insertAt),
  ];

  const { openCalendly } = useCalendlyOrNoop();

  return (
    <div style={{ paddingTop: 80, background: C.bg, minHeight: '100vh' }}>
      <ReadingProgress />

      {/* Dark masthead */}
      <div style={{ background: C.bgDark }}>
        <div
          style={{
            maxWidth: 860,
            margin: '0 auto',
            padding: 'clamp(40px, 6vw, 72px) clamp(16px, 5vw, 24px)',
          }}
        >
          <Fade>
            <Tag>{post.category}</Tag>
            <h1
              style={{
                fontFamily: FONT,
                fontSize: 'clamp(1.7rem, 4.5vw, 2.6rem)',
                fontWeight: 900,
                color: '#F5F2EF',
                lineHeight: 1.15,
                margin: '16px 0 20px',
              }}
            >
              {post.title}
            </h1>
            <div
              style={{
                display: 'flex',
                gap: 16,
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              {/* Author avatar */}
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: C.accent,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: FONT,
                  fontWeight: 800,
                  fontSize: '0.8rem',
                  color: '#FFFFFF',
                  flexShrink: 0,
                }}
              >
                G
              </div>
              <span
                style={{
                  fontFamily: FONT,
                  fontSize: '0.85rem',
                  color: 'rgba(245,242,239,0.55)',
                }}
              >
                George, ByeByeAdmin
              </span>
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: '0.78rem',
                  color: 'rgba(245,242,239,0.35)',
                }}
              >
                {formatDate(post.date)}
              </span>
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: '0.78rem',
                  color: 'rgba(245,242,239,0.35)',
                }}
              >
                {post.readTime}
              </span>
            </div>
          </Fade>
        </div>
      </div>

      {/* Body */}
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
        {/* TOC — desktop sticky */}
        {wide && (
          <div style={{ position: 'sticky', top: 100 }}>
            <TOC headings={toc} activeId={activeId} />
          </div>
        )}

        {/* Article content */}
        <div ref={articleRef} style={{ maxWidth: 680 }}>
          {/* TOC — mobile collapsed */}
          {!wide && <MobileTOC headings={toc} />}

          {blocksWithNewsletter.map((block, i) => {
            if (block.type === '__newsletter') {
              return <InlineNewsletter key="newsletter" />;
            }
            return <BlockRenderer key={i} block={block as Block} />;
          })}

          {/* Author block */}
          <div
            style={{
              borderTop: `1px solid ${C.border}`,
              marginTop: 48,
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
                fontFamily: FONT,
                fontWeight: 800,
                fontSize: '1.1rem',
                color: '#FFFFFF',
                flexShrink: 0,
              }}
            >
              G
            </div>
            <div>
              <p
                style={{
                  fontFamily: FONT,
                  fontSize: '0.95rem',
                  fontWeight: 800,
                  color: C.text,
                  margin: 0,
                }}
              >
                George
              </p>
              <p
                style={{
                  fontFamily: FONT,
                  fontSize: '0.82rem',
                  color: C.textDim,
                  margin: '2px 0 0',
                }}
              >
                Founder, ByeByeAdmin. Building AI automation for UK haulage operators.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Related posts */}
      {related.length > 0 && (
        <div style={{ background: C.bgWhite, borderTop: `1px solid ${C.border}` }}>
          <div
            style={{
              maxWidth: 900,
              margin: '0 auto',
              padding: 'clamp(36px, 5vw, 56px) clamp(16px, 5vw, 24px)',
            }}
          >
            <Fade>
              <h2
                style={{
                  fontFamily: FONT,
                  fontSize: 'clamp(1.2rem, 3vw, 1.5rem)',
                  fontWeight: 800,
                  color: C.text,
                  margin: '0 0 24px',
                }}
              >
                More from the blog
              </h2>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: 20,
                }}
              >
                {related.map((p) => (
                  <RelatedCard key={p.slug} post={p} />
                ))}
              </div>
            </Fade>
          </div>
        </div>
      )}

      {/* Bottom CTA */}
      <div style={{ background: C.bgDark }}>
        <div
          style={{
            maxWidth: 680,
            margin: '0 auto',
            padding: 'clamp(48px, 7vw, 80px) clamp(16px, 5vw, 24px)',
            textAlign: 'center',
          }}
        >
          <Fade>
            <Tag teal>Next step</Tag>
            <h2
              style={{
                fontFamily: FONT,
                fontSize: 'clamp(1.4rem, 4vw, 2rem)',
                fontWeight: 900,
                color: '#F5F2EF',
                margin: '16px 0 12px',
                lineHeight: 1.2,
              }}
            >
              Ready to remove the admin from your operation?
            </h2>
            <p
              style={{
                fontFamily: FONT,
                color: 'rgba(245,242,239,0.55)',
                fontSize: '0.97rem',
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
          </Fade>
        </div>
      </div>
    </div>
  );
}
