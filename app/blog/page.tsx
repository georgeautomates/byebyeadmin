'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Btn } from '@/components/ui';
import { C, FONT, MONO } from '@/lib/constants';
import { POSTS, CATEGORIES, type Post } from '@/lib/blog-posts';

const OUTFIT = "'Outfit', sans-serif";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// ─── Route map SVG decoration ─────────────────────────────────────────────────

function RouteMapSVG() {
  return (
    <svg
      viewBox="0 0 320 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: '100%', maxWidth: 320, display: 'block', margin: '0 auto 20px' }}
    >
      <line x1="0" y1="12" x2="320" y2="12" stroke={C.teal} strokeWidth="1.5" strokeOpacity="0.3" strokeDasharray="4 3" />
      {[0, 160, 320].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy="12" r="5" fill="none" stroke={C.teal} strokeWidth="1.5" strokeOpacity="0.5" />
          <circle cx={cx} cy="12" r="2" fill={C.teal} fillOpacity="0.5" />
        </g>
      ))}
    </svg>
  );
}

// ─── Article strip ────────────────────────────────────────────────────────────

function ArticleStrip({ post, index }: { post: Post; index: number }) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: '-32px' }}
      transition={{ duration: 0.5, delay: index * 0.07, ease: [0.16, 1, 0.3, 1] }}
    >
      <Link href={`/blog/${post.slug}`} style={{ textDecoration: 'none', display: 'block' }}>
        <article
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            position: 'relative',
            borderBottom: `1px solid ${C.border}`,
            padding: 'clamp(28px, 5vw, 48px) 0',
            overflow: 'hidden',
            cursor: 'pointer',
          }}
        >
          {/* Background article number */}
          <span
            style={{
              position: 'absolute',
              right: 0,
              top: '50%',
              transform: 'translateY(-50%)',
              fontFamily: OUTFIT,
              fontWeight: 900,
              fontSize: 'clamp(5rem, 12vw, 9rem)',
              color: hovered ? 'rgba(232,97,45,0.13)' : 'rgba(232,97,45,0.065)',
              lineHeight: 1,
              pointerEvents: 'none',
              userSelect: 'none',
              transition: 'color 0.35s ease',
            }}
          >
            {String(index + 1).padStart(2, '0')}
          </span>

          {/* Left hover accent bar */}
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
              transition: 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          />

          {/* Content */}
          <div style={{ position: 'relative', zIndex: 1, paddingLeft: hovered ? 14 : 0, transition: 'padding-left 0.35s ease' }}>
            {/* Category + read time */}
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 12 }}>
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: '0.68rem',
                  color: C.accent,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                }}
              >
                {post.category}
              </span>
              <span
                style={{
                  width: 3,
                  height: 3,
                  borderRadius: '50%',
                  background: C.textLight,
                  flexShrink: 0,
                  display: 'inline-block',
                }}
              />
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: '0.68rem',
                  color: C.textLight,
                  letterSpacing: '0.06em',
                }}
              >
                {post.readTime}
              </span>
            </div>

            {/* Title */}
            <h2
              style={{
                fontFamily: OUTFIT,
                fontSize: 'clamp(1.4rem, 3.5vw, 2.2rem)',
                fontWeight: 800,
                color: hovered ? C.accent : C.text,
                lineHeight: 1.12,
                margin: '0 0 10px',
                transition: 'color 0.25s ease',
                maxWidth: '70%',
              }}
            >
              {post.title}
            </h2>

            {/* Excerpt */}
            <p
              style={{
                fontFamily: FONT,
                color: C.textMid,
                fontSize: '0.95rem',
                lineHeight: 1.65,
                margin: '0 0 18px',
                maxWidth: 540,
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {post.excerpt}
            </p>

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '70%' }}>
              <span style={{ fontFamily: MONO, fontSize: '0.7rem', color: C.textLight }}>
                {formatDate(post.date)}
              </span>
              <span
                style={{
                  fontFamily: OUTFIT,
                  fontSize: '0.88rem',
                  fontWeight: 700,
                  color: C.accent,
                  letterSpacing: '0.01em',
                  opacity: hovered ? 1 : 0.7,
                  transition: 'opacity 0.2s ease',
                }}
              >
                Read article →
              </span>
            </div>
          </div>
        </article>
      </Link>
    </motion.div>
  );
}

// ─── Newsletter CTA ───────────────────────────────────────────────────────────

function NewsletterCTA() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  return (
    <div style={{ background: C.bgDark }}>
      <div
        style={{
          maxWidth: 900,
          margin: '0 auto',
          padding: 'clamp(48px, 7vw, 72px) clamp(16px, 5vw, 24px)',
          textAlign: 'center',
        }}
      >
        <RouteMapSVG />
        <p
          style={{
            fontFamily: MONO,
            fontSize: '0.68rem',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: C.teal,
            margin: '0 0 12px',
          }}
        >
          The Dispatch
        </p>
        <h2
          style={{
            fontFamily: OUTFIT,
            fontSize: 'clamp(1.4rem, 4vw, 2rem)',
            fontWeight: 800,
            color: '#F5F2EF',
            margin: '0 0 10px',
            lineHeight: 1.2,
          }}
        >
          Get the monthly briefing for UK fleet operators.
        </h2>
        <p
          style={{
            fontFamily: FONT,
            color: 'rgba(245,242,239,0.5)',
            fontSize: '0.95rem',
            lineHeight: 1.6,
            margin: '0 0 28px',
          }}
        >
          Practical AI updates. No fluff. Straight to your inbox once a month.
        </p>
        {submitted ? (
          <p style={{ fontFamily: OUTFIT, color: C.accent, fontWeight: 700, fontSize: '1.05rem' }}>
            You are on the list. See you in your inbox.
          </p>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (email) setSubmitted(true);
            }}
            style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}
          >
            <input
              type="email"
              required
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                fontFamily: FONT,
                fontSize: '0.92rem',
                padding: '13px 16px',
                borderRadius: 8,
                border: '1px solid rgba(245,242,239,0.12)',
                background: 'rgba(255,255,255,0.06)',
                color: '#F5F2EF',
                outline: 'none',
                minWidth: 240,
                flex: '1 1 auto',
                maxWidth: 320,
              }}
            />
            <Btn primary type="submit">
              Subscribe
            </Btn>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BlogPage() {
  const [activeCategory, setActiveCategory] = useState('All');

  const filtered =
    activeCategory === 'All'
      ? POSTS
      : POSTS.filter((p) => p.category === activeCategory);

  return (
    <div style={{ paddingTop: 80, background: C.bg, minHeight: '100vh' }}>

      {/* ── Masthead ── */}
      <div style={{ background: C.bgDark, position: 'relative', overflow: 'hidden' }}>

        {/* Faint decorative number behind masthead */}
        <div
          style={{
            position: 'absolute',
            right: 'clamp(-20px, 5vw, 60px)',
            bottom: -20,
            fontFamily: OUTFIT,
            fontWeight: 900,
            fontSize: 'clamp(8rem, 22vw, 18rem)',
            color: 'rgba(255,255,255,0.02)',
            lineHeight: 1,
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          BBA
        </div>

        <div
          style={{
            maxWidth: 900,
            margin: '0 auto',
            padding: 'clamp(44px, 7vw, 80px) clamp(16px, 5vw, 24px)',
            position: 'relative',
            zIndex: 1,
          }}
        >
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <p
              style={{
                fontFamily: MONO,
                fontSize: '0.68rem',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: C.teal,
                margin: '0 0 4px',
              }}
            >
              The Dispatch
            </p>
            <p
              style={{
                fontFamily: MONO,
                fontSize: '0.65rem',
                letterSpacing: '0.1em',
                color: 'rgba(245,242,239,0.2)',
                margin: '0 0 20px',
              }}
            >
              VOL. I — 2026
            </p>
            <h1
              style={{
                fontFamily: OUTFIT,
                fontSize: 'clamp(2.4rem, 6vw, 4.2rem)',
                fontWeight: 900,
                color: '#F5F2EF',
                lineHeight: 1.0,
                margin: '0 0 16px',
              }}
            >
              Straight talk on<br />
              <span style={{ color: C.accent }}>haulage AI.</span>
            </h1>
            <p
              style={{
                fontFamily: FONT,
                color: 'rgba(245,242,239,0.45)',
                fontSize: 'clamp(0.9rem, 2.5vw, 1.05rem)',
                lineHeight: 1.65,
                margin: 0,
                maxWidth: 480,
              }}
            >
              Practical guides for UK fleet operators. No hype, no jargon.
              Just what actually works.
            </p>
          </motion.div>

          {/* Animated entry rule */}
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.8, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
            style={{
              height: 2,
              background: C.accent,
              transformOrigin: 'left',
              marginTop: 28,
            }}
          />
        </div>
      </div>

      {/* ── Category filter ── */}
      <div style={{ background: C.bgWhite, borderBottom: `1px solid ${C.border}` }}>
        <div
          style={{
            maxWidth: 900,
            margin: '0 auto',
            padding: '0 clamp(16px, 5vw, 24px)',
            display: 'flex',
            gap: 4,
            overflowX: 'auto',
            scrollbarWidth: 'none',
          }}
        >
          {CATEGORIES.map((cat) => {
            const active = cat === activeCategory;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                style={{
                  fontFamily: OUTFIT,
                  fontSize: '0.82rem',
                  fontWeight: active ? 700 : 600,
                  color: active ? '#FFFFFF' : C.textDim,
                  background: active ? C.accent : 'transparent',
                  border: 'none',
                  borderRadius: 6,
                  padding: '13px 18px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  letterSpacing: '0.02em',
                }}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Article list ── */}
      <div
        style={{
          maxWidth: 900,
          margin: '0 auto',
          padding: 'clamp(8px, 3vw, 24px) clamp(16px, 5vw, 24px) clamp(40px, 6vw, 64px)',
        }}
      >
        {filtered.length === 0 ? (
          <p
            style={{
              fontFamily: FONT,
              color: C.textDim,
              textAlign: 'center',
              padding: '60px 0',
            }}
          >
            No posts in this category yet.
          </p>
        ) : (
          filtered.map((post, i) => (
            <ArticleStrip key={post.slug} post={post} index={i} />
          ))
        )}
      </div>

      {/* ── Newsletter CTA ── */}
      <NewsletterCTA />
    </div>
  );
}
